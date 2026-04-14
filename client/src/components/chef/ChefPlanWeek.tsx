// ============================================================
//  ChefPlanWeek — Plan semanal
//
//  Pipeline: idle → loading → ready → error
//  Mobile: scroll horizontal de columnas (días) × filas (comidas).
//  Desktop: grid completa sin scroll.
//  Tap celda → modal con detalle + "Registrar este".
//  Cache localStorage con expiración al cambio de lunes.
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

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

type Day = {
  date: string;        // YYYY-MM-DD
  day_name: string;    // "lunes", ...
  meals: Meal[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
};

type WeekPlanData = {
  days: Day[];
  week_totals: { kcal: number; protein: number; carbs: number; fat: number };
};

type Status = 'idle' | 'loading' | 'ready' | 'error';

const CHEF_BG = 'var(--bg)';
const CHEF_INK = '#1f1a12';

const STORAGE_KEY = 'caliro_week_plan';

const MEAL_ORDER: string[] = ['desayuno', 'comida', 'merienda', 'cena'];
const MEAL_LABELS: Record<string, string> = {
  desayuno: 'DESAYUNO',
  comida: 'COMIDA',
  merienda: 'MERIENDA',
  cena: 'CENA',
};
const MEAL_LABELS_CAP: Record<string, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};

// Fila del grid: row-label vertical + N celdas (una por día).
function FragmentRow({
  mealType,
  days,
  todayISO,
  findMeal,
  onCellTap,
}: {
  mealType: string;
  days: Day[];
  todayISO: string;
  findMeal: (day: Day, type: string) => Meal | null;
  onCellTap: (meal: Meal, day: Day) => void;
}) {
  return (
    <>
      <div style={{
        fontSize: 8,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#1f1a12',
        fontWeight: 700,
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 0',
      }}>
        {MEAL_LABELS_CAP[mealType]}
      </div>
      {days.map(day => {
        const meal = findMeal(day, mealType);
        const isToday = day.date === todayISO;
        if (!meal) {
          return (
            <div key={`${mealType}-${day.date}`} className="chef-week-cell-empty">
              {isToday ? 'ya reg.' : '—'}
            </div>
          );
        }
        return (
          <button
            type="button"
            key={`${mealType}-${day.date}`}
            className={`chef-week-cell${isToday ? ' today' : ''}`}
            onClick={() => onCellTap(meal, day)}
          >
            <div className="name">{meal.name}</div>
            <div className="kcal">{meal.kcal}</div>
          </button>
        );
      })}
    </>
  );
}

// Devuelve el lunes de la semana en curso (YYYY-MM-DD).
function currentWeekStart(): string {
  const d = new Date();
  const dow = d.getDay(); // 0=dom
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA');
}

function loadCachedPlan(): { plan: WeekPlanData; targetKcal: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.weekStart !== currentWeekStart() || !cached.plan) return null;
    return { plan: cached.plan, targetKcal: cached.targetKcal || 0 };
  } catch {
    return null;
  }
}

function savePlanToCache(plan: WeekPlanData, targetKcal: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      weekStart: currentWeekStart(),
      targetKcal,
      plan,
    }));
  } catch { /* silent */ }
}

function clearPlanCache() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export default function ChefPlanWeek() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const cached = loadCachedPlan();
  const [status, setStatus] = useState<Status>(cached ? 'ready' : 'idle');
  const [plan, setPlan] = useState<WeekPlanData | null>(cached?.plan || null);
  const [targetKcal, setTargetKcal] = useState<number>(cached?.targetKcal || 0);
  const [error, setError] = useState('');
  const [context, setContext] = useState('');
  const [modalMeal, setModalMeal] = useState<{ meal: Meal; day: Day } | null>(null);

  const todayISO = new Date().toLocaleDateString('en-CA');

  // Cross-device sync: fetch el plan semanal guardado al montar.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.chefGetCurrentWeek(token);
        if (cancelled) return;
        if (res?.plan) {
          setPlan(res.plan);
          const tk = res.target_kcal || 0;
          setTargetKcal(tk);
          savePlanToCache(res.plan, tk);
          setStatus('ready');
        } else if (!cached) {
          setStatus('idle');
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleGenerate() {
    setStatus('loading');
    setError('');
    try {
      const res = await api.chefPlanWeek({ context: context || undefined }, token);
      if (res?.plan) {
        setPlan(res.plan);
        const tk = res.target_kcal || 0;
        setTargetKcal(tk);
        savePlanToCache(res.plan, tk);
        setStatus('ready');
      } else {
        throw new Error(res?.error || 'No se recibió un plan válido');
      }
    } catch (err: any) {
      setError(err?.message || 'Error al generar el plan semanal');
      setStatus('error');
    }
  }

  function handleRegister(meal: Meal) {
    setModalMeal(null);
    navigate('/calculator', {
      state: {
        prefill: {
          name: meal.name,
          calories: String(meal.kcal),
          protein: String(meal.protein),
          carbs: String(meal.carbs),
          fat: String(meal.fat),
        },
      },
    });
  }

  // ── Shared wrapper for empty/loading/error ──
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
      }}>{children}</div>
    </div>
  );

  // ── IDLE ──
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
        <div style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 22px 28px',
          maxWidth: 420,
          width: '100%',
          margin: '0 auto',
        }}>
          {/* Header */}
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
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="8" y1="3" x2="8" y2="7" />
                <line x1="16" y1="3" x2="16" y2="7" />
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
                Plan semanal
              </h2>
              <div style={{
                fontSize: 10,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginTop: 4,
              }}>
                Hasta el domingo
              </div>
            </div>
          </div>

          <p style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            margin: '0 0 20px',
          }}>
            Plan personalizado para los días que faltan de la semana. Respeta tus frecuentes, preferencias y lo que ya has comido hoy.
          </p>

          <div style={{ height: '0.5px', background: 'var(--border)', marginBottom: 18 }} />

          {/* Context input */}
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
              placeholder="Semana ligera, viajo jueves y viernes, batch-cooking el domingo…"
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

          <button
            type="button"
            onClick={handleGenerate}
            style={{
              width: '100%',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '13px 24px',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(45,106,79,0.2)',
            }}
          >
            Generar plan semanal
          </button>
        </div>

        <p style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          textAlign: 'center',
          marginTop: 16,
          lineHeight: 1.5,
          fontStyle: 'italic',
        }}>
          Usa contexto rico: últimos 14 días, 20 comidas frecuentes, patrones reales
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
        Pensando tu semana…
      </p>
      <p style={{
        fontSize: 11,
        color: 'var(--text-tertiary)',
        margin: 0,
      }}>
        Analizando 14 días de patrones y priorizando variedad. Puede tardar 8–12 segundos.
      </p>
    </>);
  }

  // ── ERROR ──
  if (status === 'error') {
    return stateWrapper(<>
      <p style={{
        fontSize: 13,
        color: 'var(--accent-2)',
        margin: '0 0 16px',
        lineHeight: 1.5,
      }}>
        {error || 'No se pudo generar el plan semanal. Inténtalo de nuevo.'}
      </p>
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
        Reintentar
      </button>
    </>);
  }

  // ── READY ──
  if (!plan || !plan.days?.length) return null;

  const wt = plan.week_totals || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const avgKcal = plan.days.length > 0 ? Math.round(wt.kcal / plan.days.length) : 0;

  // Col head: abreviatura del día
  const DOW_SHORT: Record<string, string> = {
    lunes: 'Lun', martes: 'Mar', 'miércoles': 'Mié', jueves: 'Jue',
    viernes: 'Vie', 'sábado': 'Sáb', domingo: 'Dom',
  };

  // Rango de fechas para el subtítulo ("14 — 20 de abril")
  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const firstD = new Date(plan.days[0].date + 'T00:00:00');
  const lastD  = new Date(plan.days[plan.days.length - 1].date + 'T00:00:00');
  const dateRange = firstD.getMonth() === lastD.getMonth()
    ? `${firstD.getDate()} — ${lastD.getDate()} de ${MONTHS[lastD.getMonth()]}`
    : `${firstD.getDate()} ${MONTHS[firstD.getMonth()]} — ${lastD.getDate()} ${MONTHS[lastD.getMonth()]}`;

  const N = plan.days.length;
  // minmax(75, 110): mobile puede comprimir a 75 (con scroll), desktop/zoom
  // nunca hincha las celdas por encima de 110px. Grid con maxWidth + margin
  // auto → se centra cuando sobra espacio (zoom alto, monitor ancho).
  const gridTemplateColumns = `34px repeat(${N}, minmax(75px, 110px))`;
  const gridMinWidth = 34 + N * 75 + (N + 1) * 5;
  const gridMaxWidth = 34 + N * 110 + (N + 1) * 5;
  const needsHorizontalScroll = gridMinWidth > 610;

  // Meal type normalization (Claude puede devolver inglés o español)
  const normalizeType = (t: string): string => {
    const k = (t || '').toLowerCase();
    if (k === 'breakfast') return 'desayuno';
    if (k === 'lunch') return 'comida';
    if (k === 'snack') return 'merienda';
    if (k === 'dinner') return 'cena';
    return k;
  };
  const findMealByNormalizedType = (day: Day, type: string): Meal | null => {
    for (const m of day.meals || []) {
      if (normalizeType(m.type) === type) return m;
    }
    return null;
  };

  return (
    <div style={{
      flex: 1,
      background: CHEF_BG,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      <style>{`
        @keyframes chefFadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .chef-week-cell {
          background: #fdf9ed;
          border: 0.5px solid rgba(31,26,18,0.08);
          border-radius: 8px;
          padding: 8px 9px;
          min-height: 64px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          font-family: inherit;
          text-align: left;
        }
        .chef-week-cell:hover { border-color: rgba(31,26,18,0.25); }
        .chef-week-cell.today { border-color: var(--accent); background: #fdfaf0; }
        .chef-week-cell .name {
          font-family: var(--font-serif);
          font-style: italic;
          font-size: 12px;
          line-height: 1.2;
          color: ${CHEF_INK};
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .chef-week-cell .kcal {
          font-size: 9px;
          color: ${CHEF_INK};
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          margin-top: 4px;
        }
        .chef-week-cell-empty {
          background: rgba(0,0,0,0.015);
          border: 0.5px dashed rgba(31,26,18,0.12);
          border-radius: 8px;
          min-height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-style: italic;
          color: rgba(31,26,18,0.3);
          padding: 4px;
          text-align: center;
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '20px 22px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexShrink: 0,
      }}>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 28,
            color: CHEF_INK,
            margin: 0,
            lineHeight: 1,
          }}>
            Plan semanal
          </h2>
          <div style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginTop: 4,
            fontWeight: 500,
          }}>
            {dateRange}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setPlan(null); clearPlanCache(); setStatus('idle'); }}
          style={{
            fontSize: 10,
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: '0.5px solid rgba(31,26,18,0.2)',
            borderRadius: 'var(--radius-full)',
            padding: '5px 11px',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Regenerar
        </button>
      </div>

      {/* Scroll hint — solo si el grid excede el contenedor (típico móvil) */}
      {needsHorizontalScroll && (
        <div style={{
          fontSize: 9,
          color: 'var(--text-tertiary)',
          textAlign: 'right',
          padding: '0 22px 4px',
          fontStyle: 'italic',
          flexShrink: 0,
        }}>
          desliza →
        </div>
      )}

      {/* Grid wrap — scroll horizontal solo cuando hace falta */}
      <div style={{
        overflowX: 'auto',
        padding: '0 14px 20px',
        opacity: 0,
        animation: 'chefFadeInUp 0.3s ease forwards',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns,
          gap: 5,
          minWidth: gridMinWidth,
          maxWidth: gridMaxWidth,
          margin: '0 auto',
        }}>
          {/* Row 1: empty top-left + col heads */}
          <div />
          {plan.days.map(day => {
            const isToday = day.date === todayISO;
            const d = new Date(day.date + 'T00:00:00');
            return (
              <div key={`head-${day.date}`} style={{
                textAlign: 'center',
                padding: '6px 4px 10px',
              }}>
                <div style={{
                  fontSize: 8,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: isToday ? 'var(--accent)' : 'var(--text-tertiary)',
                  fontWeight: 600,
                }}>
                  {DOW_SHORT[day.day_name.toLowerCase()] || day.day_name.slice(0, 3)}
                </div>
                <span style={{
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: 20,
                  color: isToday ? 'var(--accent)' : CHEF_INK,
                  display: 'block',
                  lineHeight: 1,
                  marginTop: 2,
                }}>
                  {d.getDate()}
                </span>
              </div>
            );
          })}

          {/* Rows: row-label + N cells */}
          {MEAL_ORDER.map(mealType => (
            <FragmentRow
              key={mealType}
              mealType={mealType}
              days={plan.days}
              todayISO={todayISO}
              findMeal={findMealByNormalizedType}
              onCellTap={(meal, day) => setModalMeal({ meal, day })}
            />
          ))}
        </div>
      </div>

      {/* Footer — chef-ink, compact */}
      <div style={{
        padding: '14px 22px',
        background: CHEF_INK,
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div>
          <div style={{
            fontSize: 8,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.45)',
            fontWeight: 600,
            marginBottom: 2,
          }}>
            Total semana
          </div>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 18,
          }}>
            {wt.kcal.toLocaleString('es-ES')} kcal
          </div>
        </div>
        <div style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.55)',
          textAlign: 'right',
          fontStyle: 'italic',
          lineHeight: 1.4,
        }}>
          {avgKcal} kcal/día<br />
          {targetKcal > 0 && <span style={{ opacity: 0.75 }}>obj. {targetKcal}</span>}
        </div>
      </div>

      {/* Modal detalle */}
      {modalMeal && (
        <div
          onClick={() => setModalMeal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px 22px',
              width: '100%',
              maxWidth: 420,
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-md)',
              animation: 'chefFadeInUp 0.25s ease forwards',
            }}
          >
            {/* Day + meal type */}
            <div style={{
              fontSize: 9,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              fontWeight: 700,
              marginBottom: 6,
            }}>
              {modalMeal.day.day_name} · {MEAL_LABELS[modalMeal.meal.type?.toLowerCase()] || modalMeal.meal.type}
              {modalMeal.meal.time && ` · ${modalMeal.meal.time}`}
            </div>

            <h3 style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 22,
              color: CHEF_INK,
              lineHeight: 1.2,
              margin: '0 0 10px',
              fontWeight: 400,
            }}>
              {modalMeal.meal.name}
            </h3>

            <div style={{
              fontSize: 13,
              color: CHEF_INK,
              fontWeight: 600,
              marginBottom: 14,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {modalMeal.meal.kcal} kcal
            </div>

            {modalMeal.meal.ingredients && (
              <div style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                lineHeight: 1.5,
                marginBottom: 16,
                padding: '10px 12px',
                background: 'var(--bg)',
                borderRadius: 'var(--radius-md)',
                border: '0.5px solid var(--border)',
              }}>
                {modalMeal.meal.ingredients}
              </div>
            )}

            {/* Macros */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginBottom: 18,
            }}>
              {[
                { label: 'Prot', value: modalMeal.meal.protein, color: '#2d6a4f' },
                { label: 'Carb', value: modalMeal.meal.carbs,   color: '#d4a017' },
                { label: 'Grasa',value: modalMeal.meal.fat,     color: '#5b8dd9' },
              ].map(m => (
                <div key={m.label} style={{
                  padding: '10px 8px',
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius-md)',
                  border: '0.5px solid var(--border)',
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--text-tertiary)',
                    fontWeight: 600,
                    marginBottom: 2,
                  }}>
                    {m.label}
                  </div>
                  <div style={{
                    fontSize: 15,
                    color: m.color,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {m.value}g
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalMeal(null)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius-full)',
                  padding: '11px 18px',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => handleRegister(modalMeal.meal)}
                style={{
                  flex: 1,
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: '11px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(45,106,79,0.2)',
                }}
              >
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
