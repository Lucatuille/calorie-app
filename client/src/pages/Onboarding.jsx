import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { calculateTDEE, calculateTargetCalories, calculateMonthsToGoal } from '../utils/tdeeCalculator';

const GOALS = [
  { key: 'lose',     icon: '📉', label: 'Perder peso',   subtitle: 'Déficit moderado y sostenible' },
  { key: 'maintain', icon: '⚖️', label: 'Mantenerme',    subtitle: 'Equilibrio calórico' },
  { key: 'gain',     icon: '💪', label: 'Ganar músculo', subtitle: 'Superávit controlado' },
];

const ACTIVITIES = [
  { key: 'sedentary',   label: 'Sedentario',   sub: 'Trabajo de oficina, poco movimiento' },
  { key: 'light',       label: 'Ligero',        sub: '1–2 días de ejercicio por semana' },
  { key: 'moderate',    label: 'Moderado',      sub: '3–5 días de ejercicio por semana' },
  { key: 'active',      label: 'Activo',        sub: '6–7 días de ejercicio por semana' },
  { key: 'very_active', label: 'Muy activo',    sub: 'Atleta o trabajo físico intenso' },
];

const GOAL_TITLES = {
  lose:     'Cuéntanos sobre ti para calcular tu déficit',
  maintain: 'Cuéntanos sobre ti para calcular tu objetivo',
  gain:     'Cuéntanos sobre ti para calcular tu superávit',
};

const inputStyle = {
  background: 'var(--surface, #fff)',
  border: '0.5px solid var(--border, #e5e7eb)',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 15,
  color: 'var(--text-primary, #111)',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const microLabel = {
  fontSize: 11,
  color: 'var(--text-2, #6b7280)',
  marginBottom: 5,
  display: 'block',
  fontWeight: 500,
};

export default function Onboarding() {
  const { user, token, updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    goal: null, gender: 'male', age: '', weight: '', height: '',
    activity: null, goal_weight: '',
  });
  const [tdee, setTdee]                   = useState(null);
  const [targetCalories, setTargetCal]    = useState(null);
  const [monthsToGoal, setMonthsToGoal]   = useState(null);
  const [saving, setSaving]               = useState(false);

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const canProceed = data.gender && data.age && data.weight && data.height && data.activity;

  function computeAndAdvance() {
    const tdeeVal   = calculateTDEE({
      gender: data.gender, age: Number(data.age),
      weight: Number(data.weight), height: Number(data.height),
      activity: data.activity,
    });
    const targetCal = calculateTargetCalories(tdeeVal, data.goal);
    const deficit   = tdeeVal - targetCal;
    const months    = calculateMonthsToGoal(Number(data.weight), Number(data.goal_weight), deficit);
    setTdee(tdeeVal);
    setTargetCal(targetCal);
    setMonthsToGoal(months);
    setStep(3);
  }

  async function handleFinish() {
    setSaving(true);
    try {
      await api.updateProfile({
        age: data.age, weight: data.weight, height: data.height,
        gender: data.gender, goal_weight: data.goal_weight || null,
        target_calories: targetCalories, tdee, formula_used: 'mifflin',
        onboarding_completed: 1,
      }, token);
      updateUser({ ...user, target_calories: targetCalories, onboarding_completed: 1 });
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  }

  const accent   = 'var(--accent, #2d6a4f)';
  const surface2 = 'var(--surface-2, #f9fafb)';
  const border   = 'var(--border, #e5e7eb)';
  const textSecondary = 'var(--text-2, #6b7280)';
  const textTertiary  = 'var(--text-3, #9ca3af)';

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg, #f5f5f0)', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ padding: '20px 20px 0', maxWidth: 520, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <span style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontStyle: 'italic', fontSize: 20, color: 'var(--text-primary, #111)' }}>
          kcal
        </span>
        <div style={{ display: 'flex', gap: 4, marginTop: 18 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              flex: 1, height: 2, borderRadius: 100,
              background: i <= step ? accent : 'var(--surface-3, #e5e7eb)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '0 20px 32px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: 520, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

          {/* Back button */}
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} style={{
              background: 'none', border: 'none', fontSize: 13,
              color: textSecondary, cursor: 'pointer',
              padding: '16px 0 0', fontFamily: 'inherit', alignSelf: 'flex-start',
            }}>
              ← Volver
            </button>
          )}

          {/* ── STEP 1: Objetivo ── */}
          {step === 1 && (
            <div style={{ paddingTop: 32, flex: 1 }}>
              <h1 style={{
                fontFamily: 'Instrument Serif, Georgia, serif', fontStyle: 'italic',
                fontSize: 30, fontWeight: 400, color: 'var(--text-primary, #111)',
                margin: '0 0 6px', lineHeight: 1.2,
              }}>
                ¿Qué quieres conseguir?
              </h1>
              <p style={{ fontSize: 13, color: textSecondary, margin: '0 0 28px', fontFamily: 'inherit' }}>
                Tu objetivo define tu plan nutricional.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {GOALS.map(g => (
                  <button key={g.key}
                    onClick={() => { set('goal', g.key); setStep(2); }}
                    style={{
                      background: 'var(--surface, #fff)',
                      border: `0.5px solid ${border}`,
                      borderRadius: 12, padding: '16px',
                      display: 'flex', alignItems: 'center', gap: 14,
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color 0.15s, transform 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <span style={{ fontSize: 26, flexShrink: 0 }}>{g.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #111)', fontFamily: 'inherit' }}>
                        {g.label}
                      </div>
                      <div style={{ fontSize: 12, color: textSecondary, marginTop: 2, fontFamily: 'inherit' }}>
                        {g.subtitle}
                      </div>
                    </div>
                    <span style={{ color: textTertiary, fontSize: 18, flexShrink: 0 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2: Datos personales ── */}
          {step === 2 && (
            <div style={{ paddingTop: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h1 style={{
                fontFamily: 'Instrument Serif, Georgia, serif', fontStyle: 'italic',
                fontSize: 24, fontWeight: 400, color: 'var(--text-primary, #111)',
                margin: '0 0 24px', lineHeight: 1.3,
              }}>
                {GOAL_TITLES[data.goal]}
              </h1>

              {/* Género */}
              <div style={{ marginBottom: 16 }}>
                <span style={microLabel}>Sexo</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['male', 'Hombre'], ['female', 'Mujer']].map(([val, label]) => {
                    const active = data.gender === val;
                    return (
                      <button key={val} type="button" onClick={() => set('gender', val)} style={{
                        flex: 1, padding: '10px 0', fontSize: 14, fontFamily: 'inherit',
                        fontWeight: active ? 600 : 400,
                        color: active ? accent : textSecondary,
                        background: active ? 'rgba(45,106,79,0.08)' : 'transparent',
                        border: `0.5px solid ${active ? accent : border}`,
                        borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Edad / Peso / Altura */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { k: 'age', label: 'Edad', placeholder: '25' },
                  { k: 'weight', label: 'Peso (kg)', placeholder: '70' },
                  { k: 'height', label: 'Altura (cm)', placeholder: '175' },
                ].map(({ k, label, placeholder }) => (
                  <div key={k}>
                    <span style={microLabel}>{label}</span>
                    <input
                      type="number" placeholder={placeholder}
                      value={data[k]} onChange={e => set(k, e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>

              {/* Peso objetivo — solo si goal=lose */}
              {data.goal === 'lose' && (
                <div style={{ marginBottom: 16 }}>
                  <span style={microLabel}>Peso objetivo (kg) — opcional</span>
                  <input
                    type="number" step="0.1" placeholder="65"
                    value={data.goal_weight} onChange={e => set('goal_weight', e.target.value)}
                    style={{ ...inputStyle, maxWidth: 120 }}
                  />
                </div>
              )}

              {/* Actividad */}
              <div style={{ marginBottom: 24 }}>
                <span style={microLabel}>Nivel de actividad</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ACTIVITIES.map(a => {
                    const active = data.activity === a.key;
                    return (
                      <button key={a.key} type="button" onClick={() => set('activity', a.key)} style={{
                        background: active ? 'rgba(45,106,79,0.06)' : 'var(--surface, #fff)',
                        border: `0.5px solid ${active ? accent : border}`,
                        borderRadius: 8, padding: '10px 14px',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? accent : 'var(--text-primary, #111)', fontFamily: 'inherit' }}>
                          {a.label}
                        </div>
                        <div style={{ fontSize: 11, color: textSecondary, marginTop: 1, fontFamily: 'inherit' }}>
                          {a.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button onClick={computeAndAdvance} disabled={!canProceed} style={{
                padding: '13px', width: '100%',
                background: canProceed ? accent : 'var(--surface-3, #e5e7eb)',
                color: canProceed ? 'white' : textTertiary,
                border: 'none', borderRadius: 99,
                fontSize: 14, fontWeight: 600, cursor: canProceed ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}>
                Calcular mi objetivo →
              </button>
            </div>
          )}

          {/* ── STEP 3: Proyección ── */}
          {step === 3 && (
            <div style={{ paddingTop: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <p style={{ fontSize: 11, color: textSecondary, fontFamily: 'inherit', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>
                Tu objetivo diario
              </p>

              <div style={{
                fontFamily: 'Instrument Serif, Georgia, serif', fontStyle: 'italic',
                fontSize: 68, fontWeight: 400, lineHeight: 1,
                color: 'var(--text-primary, #111)', letterSpacing: '-3px',
                marginBottom: 6,
              }}>
                {targetCalories?.toLocaleString('es')}
              </div>
              <p style={{ fontSize: 14, color: textSecondary, fontFamily: 'inherit', margin: '0 0 28px' }}>
                kcal/día
              </p>

              <div style={{ height: '0.5px', background: border, marginBottom: 20 }} />

              {/* Card de detalles */}
              <div style={{ background: surface2, borderRadius: 12, padding: '16px', marginBottom: 16, border: `0.5px solid ${border}` }}>
                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 11, color: textTertiary, fontFamily: 'inherit', fontWeight: 500 }}>Tu TDEE estimado</span>
                  <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary, #111)', fontFamily: 'inherit', marginTop: 3 }}>
                    {tdee?.toLocaleString('es')} kcal/día
                  </div>
                </div>

                <div style={{ height: '0.5px', background: border, marginBottom: 14 }} />

                <p style={{ fontSize: 13, color: textSecondary, fontFamily: 'inherit', margin: 0, lineHeight: 1.55 }}>
                  {data.goal === 'lose' && monthsToGoal
                    ? `Con este déficit de 400 kcal/día, podrías llegar a ${data.goal_weight} kg en aproximadamente ${monthsToGoal} ${monthsToGoal === 1 ? 'mes' : 'meses'}.`
                    : data.goal === 'lose'
                    ? 'Con este déficit de 400 kcal/día perderás ~0,5 kg por semana de forma sostenible.'
                    : data.goal === 'maintain'
                    ? `Comer alrededor de ${targetCalories?.toLocaleString('es')} kcal/día mantendrá tu peso actual.`
                    : 'Con este superávit de 300 kcal/día ganarás músculo de forma progresiva.'}
                </p>
              </div>

              <p style={{ fontSize: 11, color: textTertiary, fontFamily: 'inherit', lineHeight: 1.55, margin: '0 0 auto' }}>
                ⓘ Calculado con la fórmula Mifflin-St Jeor, el estándar clínico más preciso.
                Puedes ajustarlo en tu perfil en cualquier momento.
              </p>

              <button onClick={handleFinish} disabled={saving} style={{
                padding: '13px', width: '100%',
                background: accent, color: 'white',
                border: 'none', borderRadius: 99,
                fontSize: 14, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', marginTop: 24,
                opacity: saving ? 0.7 : 1, transition: 'opacity 0.2s',
              }}>
                {saving ? 'Guardando…' : 'Empezar a registrar →'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
