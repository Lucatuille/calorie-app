// ============================================================
//  ChefPlanDay — Plan del día (Fase 2b: datos mock)
//
//  Layout P13 clean: nombre serif + kcal olive + ingredientes
//  gray + botón circular verde + footer negro con macros.
//  Se conectará al backend en Fase 2d.
// ============================================================

import { useNavigate } from 'react-router-dom';

// Mock data — se reemplazará por datos reales de POST /api/planner/day
const MOCK_MEALS = [
  {
    type: 'Desayuno',
    time: '~ 7:30',
    name: 'Avena con plátano y yogur griego',
    kcal: 420,
    ingredients: '60g avena · 1 plátano · 150g yogur · 1 cdta miel',
    protein: 22, carbs: 58, fat: 6,
  },
  {
    type: 'Comida',
    time: '~ 14:00',
    name: 'Pechuga con arroz y brócoli',
    kcal: 580,
    ingredients: '180g pollo · 90g arroz · 200g brócoli · aceite oliva',
    protein: 48, carbs: 62, fat: 12,
  },
  {
    type: 'Merienda',
    time: '~ 18:00',
    name: 'Tostada integral con atún',
    kcal: 280,
    ingredients: '60g pan integral · 1 lata atún · tomate · orégano',
    protein: 22, carbs: 28, fat: 8,
  },
  {
    type: 'Cena',
    time: '~ 21:00',
    name: 'Merluza al horno con patata',
    kcal: 490,
    ingredients: '250g merluza · 150g patata · limón · perejil',
    protein: 45, carbs: 32, fat: 8,
  },
];

const MOCK_TOTALS = {
  kcal: 1770,
  protein: 137,
  carbs: 180,
  fat: 34,
  targetKcal: 1812,
};

// Colores Chef
const CHEF_BG = '#faf4e6';
const CHEF_INK = '#1f1a12';
const OLIVE = '#556b2f';
const PROTEIN_C = '#2d6a4f';
const CARBS_C = '#d4a017';
const FAT_C = '#5b8dd9';

export default function ChefPlanDay() {
  const navigate = useNavigate();
  const today = new Date();
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dateStr = `${dayNames[today.getDay()]} ${today.getDate()} de ${monthNames[today.getMonth()]}`;

  const diff = MOCK_TOTALS.kcal - MOCK_TOTALS.targetKcal;
  const diffLabel = diff <= 0
    ? `−${Math.abs(diff)} kcal (dentro del rango)`
    : `+${diff} kcal sobre objetivo`;

  const totalMacroG = MOCK_TOTALS.protein + MOCK_TOTALS.carbs + MOCK_TOTALS.fat;
  const pPct = totalMacroG > 0 ? (MOCK_TOTALS.protein / totalMacroG) * 100 : 33;
  const cPct = totalMacroG > 0 ? (MOCK_TOTALS.carbs / totalMacroG) * 100 : 34;
  const fPct = 100 - pPct - cPct;

  function handleRegister(meal: typeof MOCK_MEALS[0]) {
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

  return (
    <div style={{
      flex: 1,
      background: CHEF_BG,
      overflowY: 'auto',
      padding: '20px 22px 24px',
    }}>
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
      {MOCK_MEALS.map((meal, i) => (
        <div key={i}>
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
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Dish name */}
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

                {/* Kcal */}
                <div style={{
                  fontSize: 12,
                  color: OLIVE,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: 6,
                }}>
                  {meal.kcal} kcal
                </div>

                {/* Ingredients */}
                <div style={{
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}>
                  {meal.ingredients}
                </div>

                {/* Regenerar link */}
                <span style={{
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  marginTop: 8,
                  cursor: 'pointer',
                  display: 'inline-block',
                }}>
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
          {i < MOCK_MEALS.length - 1 && (
            <div style={{
              height: '0.5px',
              background: 'rgba(31,26,18,0.1)',
              marginBottom: 24,
            }} />
          )}
        </div>
      ))}

      {/* Footer — totals with macro breakdown */}
      <div style={{
        marginTop: 12,
        padding: '16px 18px',
        background: '#1a1a1a',
        color: '#fff',
        borderRadius: 14,
      }}>
        {/* Title + total */}
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
            {MOCK_TOTALS.kcal} kcal
          </span>
        </div>

        {/* Macro bar */}
        <div style={{
          display: 'flex',
          height: 4,
          borderRadius: 2,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.1)',
          marginBottom: 8,
        }}>
          <div style={{ width: `${pPct}%`, height: '100%', background: PROTEIN_C }} />
          <div style={{ width: `${cPct}%`, height: '100%', background: CARBS_C }} />
          <div style={{ width: `${fPct}%`, height: '100%', background: FAT_C }} />
        </div>

        {/* Macro legend */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'rgba(255,255,255,0.6)',
        }}>
          <span><strong style={{ color: '#fff', fontWeight: 600 }}>{MOCK_TOTALS.protein}g</strong> prot</span>
          <span><strong style={{ color: '#fff', fontWeight: 600 }}>{MOCK_TOTALS.carbs}g</strong> carb</span>
          <span><strong style={{ color: '#fff', fontWeight: 600 }}>{MOCK_TOTALS.fat}g</strong> grasa</span>
        </div>

        {/* vs target */}
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '0.5px dashed rgba(255,255,255,0.15)',
          fontSize: 10,
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'center',
          fontStyle: 'italic',
        }}>
          Objetivo {MOCK_TOTALS.targetKcal} kcal · {diffLabel}
        </div>
      </div>
    </div>
  );
}
