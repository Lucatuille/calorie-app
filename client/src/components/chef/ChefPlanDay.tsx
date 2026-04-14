// ============================================================
//  ChefPlanDay — Plan del día
//
//  Pipeline: empty state → loading → plan generado → error
//  Layout P13 clean para el plan generado.
//  Fase 2b: mock data con simulación de delay.
//  Fase 2d: se conectará al backend real.
// ============================================================

import { useState } from 'react';
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

type PlanData = {
  meals: Meal[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
};

type Status = 'idle' | 'loading' | 'ready' | 'error';

// Mock — se reemplazará por POST /api/planner/day en Fase 2d
const MOCK_PLAN: PlanData = {
  meals: [
    { type: 'Desayuno', time: '~ 7:30', name: 'Avena con plátano y yogur griego', kcal: 420, ingredients: '60g avena · 1 plátano · 150g yogur · 1 cdta miel', protein: 22, carbs: 58, fat: 6 },
    { type: 'Comida', time: '~ 14:00', name: 'Pechuga con arroz y brócoli', kcal: 580, ingredients: '180g pollo · 90g arroz · 200g brócoli · aceite oliva', protein: 48, carbs: 62, fat: 12 },
    { type: 'Merienda', time: '~ 18:00', name: 'Tostada integral con atún', kcal: 280, ingredients: '60g pan integral · 1 lata atún · tomate · orégano', protein: 22, carbs: 28, fat: 8 },
    { type: 'Cena', time: '~ 21:00', name: 'Merluza al horno con patata', kcal: 490, ingredients: '250g merluza · 150g patata · limón · perejil', protein: 45, carbs: 32, fat: 8 },
  ],
  totals: { kcal: 1770, protein: 137, carbs: 180, fat: 34 },
};

let TARGET_KCAL = 1812; // Se actualiza con el valor real del backend

// Colores Chef
const CHEF_BG = 'var(--bg)';
const CHEF_INK = '#1f1a12';

const STORAGE_KEY = 'caliro_day_plan';

function loadCachedPlan(): { plan: PlanData; status: Status } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    // Solo válido si es de hoy
    const today = new Date().toLocaleDateString('en-CA');
    if (cached.date !== today || !cached.plan) return null;
    return { plan: cached.plan, status: 'ready' };
  } catch {
    return null;
  }
}

function savePlanToCache(plan: PlanData) {
  try {
    const today = new Date().toLocaleDateString('en-CA');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, plan }));
  } catch { /* silent — localStorage full or unavailable */ }
}

function clearPlanCache() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export default function ChefPlanDay() {
  const navigate = useNavigate();
  const { token, user: authUser } = useAuth();
  const cached = loadCachedPlan();
  const [status, setStatus] = useState<Status>(cached?.status || 'idle');
  const [plan, setPlan] = useState<PlanData | null>(cached?.plan || null);
  const [error, setError] = useState('');
  const [context, setContext] = useState(''); // input de contexto opcional

  const today = new Date();
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dateStr = `${dayNames[today.getDay()]} ${today.getDate()} de ${monthNames[today.getMonth()]}`;

  async function handleGenerate() {
    setStatus('loading');
    setError('');
    try {
      const res = await api.chefPlanDay({ context: context || undefined }, token);
      if (res.plan) {
        setPlan(res.plan);
        savePlanToCache(res.plan);
        if (res.target_kcal) TARGET_KCAL = res.target_kcal;
        setStatus('ready');
      } else {
        throw new Error(res.error || 'No se recibió un plan válido');
      }
    } catch (err: any) {
      setError(err?.message || 'Error al generar el plan');
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
        },
      },
    });
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
            Generar plan
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
          Basado en tu objetivo de {TARGET_KCAL} kcal y tus preferencias dietéticas
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
    return stateWrapper(<>
        <p style={{
          fontSize: 13,
          color: 'var(--accent-2)',
          margin: '0 0 16px',
          lineHeight: 1.5,
        }}>
          {error || 'No se pudo generar el plan. Inténtalo de nuevo.'}
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

  // ── READY: Plan generado (layout P13 clean) ──
  // Stagger animation: each meal fades in with slight delay
  const staggerStyle = (i: number): React.CSSProperties => ({
    opacity: 0,
    animation: 'chefFadeInUp 0.35s ease forwards',
    animationDelay: `${i * 0.1}s`,
  });

  if (!plan) return null;

  const diff = plan.totals.kcal - TARGET_KCAL;
  const diffLabel = diff <= 0
    ? `−${Math.abs(diff)} kcal (dentro del rango)`
    : `+${diff} kcal sobre objetivo`;

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
        borderBottom: '0.5px solid rgba(31,26,18,0.12)',
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
          Regenerar todo
        </button>
      </div>

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
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    marginTop: 8,
                    cursor: 'pointer',
                    display: 'inline-block',
                  }}
                >
                  Regenerar
                </span>
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
              background: 'rgba(31,26,18,0.1)',
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
        background: '#1a1a1a',
        color: '#fff',
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
          <div style={{ width: `${pPct}%`, height: '100%', background: '#2d6a4f' }} />
          <div style={{ width: `${cPct}%`, height: '100%', background: '#d4a017' }} />
          <div style={{ width: `${fPct}%`, height: '100%', background: '#5b8dd9' }} />
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
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '0.5px dashed rgba(255,255,255,0.15)',
          fontSize: 10,
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'center',
          fontStyle: 'italic',
        }}>
          Objetivo {TARGET_KCAL} kcal · {diffLabel}
        </div>
      </div>
    </div>
  );
}
