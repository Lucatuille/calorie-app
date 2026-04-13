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

const TARGET_KCAL = 1812; // TODO: leer del perfil del usuario en Fase 2d

// Colores Chef
const CHEF_BG = '#faf4e6';
const CHEF_INK = '#1f1a12';
const OLIVE = '#556b2f';

export default function ChefPlanDay() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('idle');
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [error, setError] = useState('');

  const today = new Date();
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dateStr = `${dayNames[today.getDay()]} ${today.getDate()} de ${monthNames[today.getMonth()]}`;

  async function handleGenerate() {
    setStatus('loading');
    setError('');
    try {
      // MOCK: simula 2s de delay como haría Sonnet
      // En Fase 2d: const res = await api.chefPlanDay({}, token);
      await new Promise(r => setTimeout(r, 2000));
      setPlan(MOCK_PLAN);
      setStatus('ready');
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

  // ── IDLE: Empty state (patrón Dashboard) ──
  if (status === 'idle') {
    return (
      <div style={{
        flex: 1,
        background: CHEF_BG,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
        textAlign: 'center',
      }}>
        {/* Icon — documento de plan (4 líneas = 4 comidas) */}
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(45,106,79,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
               stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <line x1="8" y1="8" x2="16" y2="8" />
            <line x1="8" y1="11.5" x2="16" y2="11.5" />
            <line x1="8" y1="15" x2="16" y2="15" />
            <line x1="8" y1="18.5" x2="13" y2="18.5" />
          </svg>
        </div>

        <h2 style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 22,
          color: CHEF_INK,
          margin: '0 0 6px',
          lineHeight: 1.1,
          fontWeight: 400,
        }}>
          Plan del día
        </h2>

        <p style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          maxWidth: 260,
          margin: '0 0 6px',
        }}>
          4 comidas ajustadas a tu objetivo y tus comidas frecuentes.
        </p>

        <p style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          margin: '0 0 24px',
        }}>
          {dateStr}
        </p>

        <button
          type="button"
          onClick={handleGenerate}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            padding: '12px 28px',
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
    );
  }

  // ── LOADING ──
  if (status === 'loading') {
    return (
      <div style={{
        flex: 1,
        background: CHEF_BG,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
        textAlign: 'center',
      }}>
        <div className="spinner" style={{ width: 28, height: 28, marginBottom: 16 }} />
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
      </div>
    );
  }

  // ── ERROR ──
  if (status === 'error') {
    return (
      <div style={{
        flex: 1,
        background: CHEF_BG,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
        textAlign: 'center',
      }}>
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
      </div>
    );
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
          onClick={() => { setPlan(null); setStatus('idle'); }}
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
                color: OLIVE,
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
                  color: OLIVE,
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
