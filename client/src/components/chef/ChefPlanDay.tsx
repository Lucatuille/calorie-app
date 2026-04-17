// ============================================================
//  ChefPlanDay — Plan del día
//
//  Pipeline: empty state → loading → plan generado → error
//  Layout P13 clean. Sonnet genera via POST /api/planner/day.
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { isPro } from '../../utils/levels';
import { describeChefError, formatUsageBadge, type ChefError } from './chefErrors';
import ChefFreeLock from './ChefFreeLock';
import ChefMealEditor, { type EditableMeal } from './ChefMealEditor';
import ChefWarningBanner from './ChefWarningBanner';
import { daySummaryWarnings, type DayWarnings, type BannerData } from './chefWarningMessages';
import { recomputeTotals } from './chefTotals';

type Meal = {
  type: string;
  time: string;
  name: string;
  kcal: number;
  ingredients: string;
  protein: number;
  carbs: number;
  fat: number;
};

type PlanData = {
  meals: Meal[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
};

type Remaining = { kcal: number; protein: number; carbs: number; fat: number };

type Status = 'idle' | 'loading' | 'ready' | 'error';

const CHEF_BG = 'var(--bg)';
const CHEF_INK = 'var(--chef-ink)';

// Clave por-usuario. Crítico: sin el userId, un user A podía ver el
// plan cacheado de un user B en el mismo navegador tras logout/login.
const storageKey = (userId: number | string | undefined) =>
  userId ? `caliro_day_plan_u${userId}` : null;

function loadCachedPlan(userId: number | string | undefined): { plan: PlanData; remaining: Remaining | null; status: Status } | null {
  try {
    const key = storageKey(userId);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    // Solo válido si es de hoy
    const today = new Date().toLocaleDateString('en-CA');
    if (cached.date !== today || !cached.plan) return null;
    return { plan: cached.plan, remaining: cached.remaining || null, status: 'ready' };
  } catch {
    return null;
  }
}

function savePlanToCache(plan: PlanData, userId: number | string | undefined, remaining?: Remaining | null) {
  try {
    const key = storageKey(userId);
    if (!key) return;
    const today = new Date().toLocaleDateString('en-CA');
    localStorage.setItem(key, JSON.stringify({ date: today, plan, remaining: remaining || null }));
  } catch { /* silent — localStorage full or unavailable */ }
}

function clearPlanCache(userId: number | string | undefined) {
  try {
    const key = storageKey(userId);
    if (key) localStorage.removeItem(key);
  } catch {}
}

export default function ChefPlanDay() {
  const navigate = useNavigate();
  const { token, user: authUser } = useAuth();
  const userId = authUser?.id;
  const cached = loadCachedPlan(userId);
  const [status, setStatus] = useState<Status>(cached?.status || 'idle');
  const [plan, setPlan] = useState<PlanData | null>(cached?.plan || null);
  const [error, setError] = useState<ChefError | null>(null);
  const [context, setContext] = useState(''); // input de contexto opcional
  const [remainingDay, setRemainingDay] = useState<number | null>(null);
  const [targetKcal, setTargetKcal] = useState<number>(0);
  // remainingBudget = kcal/macros que le quedaban al user cuando se generó
  // el plan (o cuando se hizo GET current). Null si el plan se cargó de cache
  // sin ese dato. Se usa para calcular el diff honesto en el footer.
  const [remainingBudget, setRemainingBudget] = useState<Remaining | null>(cached?.remaining || null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  // Warnings vienen en la respuesta de generación (POST). GET current no los
  // persiste — si el usuario recarga la página, los banners desaparecen.
  // Aceptable V1: los warnings son más relevantes recién generado el plan.
  const [banners, setBanners] = useState<BannerData[]>([]);

  const today = new Date();
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dateStr = `${dayNames[today.getDay()]} ${today.getDate()} de ${monthNames[today.getMonth()]}`;

  const userIsPro = isPro(authUser?.access_level);

  // Cross-device sync + usage: en mount pide último plan guardado + remaining.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const [planRes, usageRes] = await Promise.all([
          api.chefGetCurrentDay(token),
          api.chefGetUsage(token),
        ]);
        if (cancelled) return;
        if (planRes?.plan) {
          setPlan(planRes.plan);
          if (planRes.target_kcal) setTargetKcal(planRes.target_kcal);
          if (planRes.remaining) setRemainingBudget(planRes.remaining);
          savePlanToCache(planRes.plan, userId, planRes.remaining);
          setStatus('ready');
        } else {
          // Backend confirma que NO hay plan para este user hoy → descartar
          // cualquier cache local (podría ser de otro user en este navegador)
          setPlan(null);
          setRemainingBudget(null);
          clearPlanCache(userId);
          setStatus('idle');
        }
        if (usageRes?.day) {
          setRemainingDay(usageRes.day.remaining_day);
        }
      } catch { /* silent: dejamos el cache local si el fetch falla */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleGenerate() {
    setStatus('loading');
    setError(null);
    setBanners([]);
    try {
      const res = await api.chefPlanDay({ context: context || undefined }, token);
      if (res.plan) {
        setPlan(res.plan);
        // El backend devuelve `remaining_before` al generar (kcal/macros que
        // le quedaban al user en ese momento). Lo guardamos para calcular el
        // diff correcto en el footer — comparar plan vs remaining, no vs total.
        const remaining = res.remaining_before || null;
        setRemainingBudget(remaining);
        savePlanToCache(res.plan, userId, remaining);
        if (res.target_kcal) setTargetKcal(res.target_kcal);
        if (typeof res?.usage?.remaining_day === 'number') {
          setRemainingDay(res.usage.remaining_day);
        }
        // Mapear warnings del backend a banners renderizables.
        setBanners(daySummaryWarnings(res.warnings as DayWarnings | null));
        setStatus('ready');
      } else {
        throw Object.assign(new Error(res.error || 'No se recibió un plan válido'), {
          data: res,
        });
      }
    } catch (err: any) {
      setError(describeChefError(err, 'day'));
      setStatus('error');
    }
  }

  function handleRegister(meal: Meal) {
    navigate('/calculator', {
      state: {
        prefill: {
          name: meal.name,
          calories: String(meal.kcal),
          protein: String(meal.protein),
          carbs: String(meal.carbs),
          fat: String(meal.fat),
          // portion_g → weight si existe (peso total del plato servido)
          weight: (meal as any).portion_g ? String((meal as any).portion_g) : '',
          // type español del plan → Calculator lo mapea a meal_type inglés
          meal_type: meal.type,
          // ingredients como referencia en notes
          ingredients: meal.ingredients || '',
        },
      },
    });
  }

  function handleSaveEdit(updated: EditableMeal) {
    if (editingIdx == null || !plan) return;
    const nextMeals = plan.meals.map((m, i) =>
      i === editingIdx ? { ...m, ...updated } : m
    );
    const nextPlan: PlanData = {
      ...plan,
      meals: nextMeals,
      totals: recomputeTotals(nextMeals),
    };
    setPlan(nextPlan);
    savePlanToCache(nextPlan, userId);
    setEditingIdx(null);
    // Persistir en backend (fire-and-forget — UI ya actualizada)
    api.chefSaveDay(nextPlan, token).catch(() => {});
  }

  // Shared wrapper for non-plan states (card container)
  const stateWrapper = (children: React.ReactNode) => (
    <div style={{
      flex: 1,
      background: CHEF_BG,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '40px 28px',
        textAlign: 'center',
        width: '100%',
        maxWidth: 360,
      }}>
        {children}
      </div>
    </div>
  );

  // ── FREE/WAITLIST: empty state de upgrade en idle + error 429 blocked ──
  if (!userIsPro && (status === 'idle' || (status === 'error' && error?.title === 'Función Pro'))) {
    return <ChefFreeLock feature="day" />;
  }

  // ── IDLE: Action page para generar plan ──
  if (status === 'idle') {
    return (
      <div style={{
        flex: 1,
        background: CHEF_BG,
        overflowY: 'auto',
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Card contenedora */}
        <div style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 22px 28px',
          maxWidth: 420,
          width: '100%',
          margin: '0 auto',
        }}>
          {/* Header: icon + title + date */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(45,106,79,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                   stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <line x1="8" y1="8" x2="16" y2="8" />
                <line x1="8" y1="11.5" x2="16" y2="11.5" />
                <line x1="8" y1="15" x2="16" y2="15" />
                <line x1="8" y1="18.5" x2="13" y2="18.5" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 22,
                color: CHEF_INK,
                margin: 0,
                lineHeight: 1.1,
                fontWeight: 400,
              }}>
                Plan del día
              </h2>
              <div style={{
                fontSize: 10,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginTop: 4,
              }}>
                {dateStr}
                {formatUsageBadge(remainingDay, 'hoy') && (
                  <>
                    {' · '}
                    <span style={{
                      color: remainingDay === 0 ? 'var(--accent-2)' : 'var(--text-tertiary)',
                      fontWeight: 600,
                    }}>
                      {formatUsageBadge(remainingDay, 'hoy')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <p style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            margin: '0 0 20px',
          }}>
            Genera 4 comidas personalizadas basadas en tu objetivo calórico y tus comidas frecuentes.
          </p>

          {/* Separator */}
          <div style={{ height: '0.5px', background: 'var(--border)', marginBottom: 18 }} />

          {/* Context input (optional) */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              fontSize: 10,
              color: 'var(--text-tertiary)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 600,
              display: 'block',
              marginBottom: 6,
            }}>
              Contexto
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 4, color: 'var(--text-tertiary)' }}>
                opcional
              </span>
            </label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Algo rápido, tengo pollo, solo cena, estoy en restaurante…"
              rows={2}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--bg)',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={remainingDay === 0}
            style={{
              width: '100%',
              background: remainingDay === 0 ? 'var(--text-tertiary)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '13px 24px',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: remainingDay === 0 ? 'not-allowed' : 'pointer',
              boxShadow: remainingDay === 0 ? 'none' : '0 2px 8px rgba(45,106,79,0.2)',
              opacity: remainingDay === 0 ? 0.6 : 1,
            }}
          >
            {remainingDay === 0 ? 'Límite diario alcanzado' : 'Generar plan'}
          </button>
        </div>

        {/* Footer context info */}
        <p style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          textAlign: 'center',
          marginTop: 16,
          lineHeight: 1.5,
          fontStyle: 'italic',
        }}>
          {targetKcal > 0
            ? `Basado en tu objetivo de ${targetKcal} kcal y tus preferencias dietéticas`
            : 'Basado en tu objetivo calórico y tus preferencias dietéticas'}
        </p>
      </div>
    );
  }

  // ── LOADING ──
  if (status === 'loading') {
    return stateWrapper(<>
        <div className="spinner" style={{ width: 28, height: 28, marginBottom: 16, marginLeft: 'auto', marginRight: 'auto' }} />
        <p style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 16,
          color: CHEF_INK,
          margin: '0 0 4px',
        }}>
          Preparando tu plan…
        </p>
        <p style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          margin: 0,
        }}>
          Analizando tu objetivo, macros y comidas frecuentes
        </p>
    </>);
  }

  // ── ERROR ──
  if (status === 'error') {
    const toneColor =
      error?.tone === 'info'  ? 'var(--text-secondary)' :
      error?.tone === 'warn'  ? '#c89424' :  /* saffron */
      'var(--accent-2)';
    return stateWrapper(<>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 17,
          color: toneColor,
          marginBottom: 8,
          lineHeight: 1.2,
        }}>
          {error?.title || 'No se pudo generar el plan'}
        </div>
        <p style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          margin: '0 0 18px',
          lineHeight: 1.5,
        }}>
          {error?.detail || 'Inténtalo de nuevo en un momento.'}
        </p>
        {error?.retryLabel && (
          <button
            type="button"
            onClick={handleGenerate}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '10px 24px',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            {error.retryLabel}
          </button>
        )}
        {!error?.retryLabel && (
          <button
            type="button"
            onClick={() => { setError(null); setStatus(plan ? 'ready' : 'idle'); }}
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              padding: '9px 22px',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            Entendido
          </button>
        )}
    </>);
  }

  // ── READY: Plan generado (layout P13 clean) ──
  // Stagger animation: each meal fades in with slight delay
  const staggerStyle = (i: number): React.CSSProperties => ({
    opacity: 0,
    animation: 'chefFadeInUp 0.35s ease forwards',
    animationDelay: `${i * 0.1}s`,
  });

  if (!plan) return null;

  // Footer diff — comparamos contra lo que al user le QUEDA del día, no contra
  // el target total. Si el plan tiene 697 kcal y al user le quedaban 700 tras
  // ya haber comido 1100, eso ES "dentro del rango", aunque el target diario
  // sea 1800. Antes mostrábamos -1115 (dentro del rango) → confuso.
  const planKcal = plan.totals.kcal;
  const hasRemaining = !!(remainingBudget && remainingBudget.kcal > 0 && remainingBudget.kcal < targetKcal);
  const isOverBudget = !!(remainingBudget && remainingBudget.kcal <= 0);
  const reference = hasRemaining ? remainingBudget!.kcal : targetKcal;
  const tolerance = reference * 0.10;
  const diff = reference > 0 ? planKcal - reference : 0;

  // Status pill text
  let footerStatus = '';
  if (isOverBudget) {
    footerStatus = `Ya superaste tu objetivo por ${Math.abs(remainingBudget!.kcal)} kcal`;
  } else if (reference > 0) {
    const sign = diff > 0 ? '+' : '−';
    const absDiff = Math.abs(diff);
    let relation: string;
    if (absDiff <= tolerance) relation = 'dentro del rango';
    else if (diff > 0)         relation = `${sign}${absDiff} kcal sobre`;
    else                       relation = `${sign}${absDiff} kcal por debajo`;
    const refLabel = hasRemaining
      ? `${Math.round(reference)} kcal restantes`
      : `Objetivo ${Math.round(reference)} kcal`;
    footerStatus = `${refLabel} · ${relation}`;
  }

  const totalG = plan.totals.protein + plan.totals.carbs + plan.totals.fat;
  const pPct = totalG > 0 ? (plan.totals.protein / totalG) * 100 : 33;
  const cPct = totalG > 0 ? (plan.totals.carbs / totalG) * 100 : 34;
  const fPct = 100 - pPct - cPct;

  return (
    <div style={{
      flex: 1,
      background: CHEF_BG,
      overflowY: 'auto',
      padding: '20px 22px 24px',
    }}>
      <style>{`
        @keyframes chefFadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingBottom: 16,
        marginBottom: 20,
        borderBottom: '0.5px solid var(--border-strong)',
      }}>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 26,
            color: CHEF_INK,
            margin: 0,
            lineHeight: 1,
          }}>
            Plan del día
          </h2>
          <div style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginTop: 4,
            fontWeight: 500,
          }}>
            {dateStr}
            {formatUsageBadge(remainingDay, 'hoy') && (
              <>
                {' · '}
                <span style={{
                  color: remainingDay === 0 ? 'var(--accent-2)' : 'var(--text-tertiary)',
                  fontWeight: 600,
                }}>
                  {formatUsageBadge(remainingDay, 'hoy')}
                </span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setPlan(null); clearPlanCache(userId); setBanners([]); setRemainingBudget(null); setStatus('idle'); }}
          style={{
            fontSize: 10,
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: '0.5px solid var(--border-strong)',
            borderRadius: 'var(--radius-full)',
            padding: '5px 11px',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Regenerar todo
        </button>
      </div>

      {/* Warnings del backend — stack de banners editoriales (nutritional safety). */}
      {banners.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {banners.map((b, i) => (
            <ChefWarningBanner key={i} tone={b.tone} title={b.title}>
              {b.detail}
            </ChefWarningBanner>
          ))}
        </div>
      )}

      {/* Meals */}
      {plan.meals.map((meal, i) => (
        <div key={i} style={staggerStyle(i)}>
          <div style={{ marginBottom: 24 }}>
            {/* Meal caption */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 6,
            }}>
              <span style={{
                fontSize: 9,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: CHEF_INK,
                fontWeight: 700,
              }}>
                {meal.type}
              </span>
              <span style={{
                fontSize: 10,
                color: 'var(--text-tertiary)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {meal.time}
              </span>
            </div>

            {/* Main row: info + register button */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: 20,
                  color: CHEF_INK,
                  lineHeight: 1.2,
                  margin: '0 0 4px',
                  fontWeight: 400,
                }}>
                  {meal.name}
                </h3>
                <div style={{
                  fontSize: 12,
                  color: CHEF_INK,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: 6,
                }}>
                  {meal.kcal} kcal
                </div>
                <div style={{
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}>
                  {meal.ingredients}
                </div>
                <button
                  type="button"
                  onClick={() => setEditingIdx(i)}
                  style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    marginTop: 8,
                    cursor: 'pointer',
                    display: 'inline-block',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    fontFamily: 'inherit',
                  }}
                >
                  Editar
                </button>
              </div>

              {/* Circular register button */}
              <button
                type="button"
                onClick={() => handleRegister(meal)}
                title="Registrar esta comida"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 4,
                  boxShadow: '0 2px 6px rgba(45,106,79,0.2)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Separator */}
          {i < plan.meals.length - 1 && (
            <div style={{
              height: '0.5px',
              background: 'var(--border)',
              marginBottom: 24,
            }} />
          )}
        </div>
      ))}

      {/* Footer — totals */}
      <div style={{
        ...staggerStyle(plan.meals.length),
        marginTop: 12,
        padding: '16px 18px',
        background: 'var(--chef-footer-bg)',
        color: 'var(--chef-footer-fg)',
        borderRadius: 14,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 10,
        }}>
          <span style={{
            fontSize: 9,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.45)',
            fontWeight: 600,
          }}>
            Total del plan
          </span>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 24,
          }}>
            {plan.totals.kcal} kcal
          </span>
        </div>
        <div style={{
          display: 'flex',
          height: 4,
          borderRadius: 2,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.1)',
          marginBottom: 8,
        }}>
          <div style={{ width: `${pPct}%`, height: '100%', background: 'var(--color-protein)' }} />
          <div style={{ width: `${cPct}%`, height: '100%', background: 'var(--color-carbs)' }} />
          <div style={{ width: `${fPct}%`, height: '100%', background: 'var(--color-fat)' }} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'rgba(255,255,255,0.6)',
        }}>
          <span><strong style={{ color: '#fff', fontWeight: 600 }}>{plan.totals.protein}g</strong> prot</span>
          <span><strong style={{ color: '#fff', fontWeight: 600 }}>{plan.totals.carbs}g</strong> carb</span>
          <span><strong style={{ color: '#fff', fontWeight: 600 }}>{plan.totals.fat}g</strong> grasa</span>
        </div>
        {footerStatus && (
          <div style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '0.5px dashed rgba(255,255,255,0.15)',
            fontSize: 10,
            color: 'rgba(255,255,255,0.5)',
            textAlign: 'center',
            fontStyle: 'italic',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {footerStatus}
          </div>
        )}
      </div>

      {/* Modal de edición de meal */}
      <ChefMealEditor
        meal={editingIdx != null && plan?.meals[editingIdx]
          ? (plan.meals[editingIdx] as EditableMeal)
          : null}
        subtitle={editingIdx != null && plan?.meals[editingIdx]
          ? plan.meals[editingIdx].type
          : undefined}
        onSave={handleSaveEdit}
        onClose={() => setEditingIdx(null)}
      />
    </div>
  );
}
