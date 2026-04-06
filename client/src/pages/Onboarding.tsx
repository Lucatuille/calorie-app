import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { calculateTDEE, calculateTargetCalories, calculateMonthsToGoal } from '../utils/tdeeCalculator';
import { calculateMacros } from '../utils/tdee';

const GOALS = [
  { key: 'lose',     icon: '📉', label: 'Perder peso',   subtitle: 'Déficit moderado y sostenible' },
  { key: 'maintain', icon: '⚖️', label: 'Mantenerme',    subtitle: 'Equilibrio calórico' },
  { key: 'gain',     icon: '💪', label: 'Ganar músculo', subtitle: 'Superávit controlado' },
];

const ACTIVITIES = [
  { key: 'sedentary',   label: 'Sedentario',  sub: 'Trabajo de oficina, poco movimiento' },
  { key: 'light',       label: 'Ligero',       sub: '1–2 días de ejercicio por semana' },
  { key: 'moderate',    label: 'Moderado',     sub: '3–5 días de ejercicio por semana' },
  { key: 'active',      label: 'Activo',       sub: '6–7 días de ejercicio por semana' },
  { key: 'very_active', label: 'Muy activo',   sub: 'Atleta o trabajo físico intenso' },
];

const GOAL_TITLES = {
  lose:     'Cuéntanos sobre ti para calcular tu déficit',
  maintain: 'Cuéntanos sobre ti para calcular tu objetivo',
  gain:     'Cuéntanos sobre ti para calcular tu superávit',
};

const inputStyle = {
  background: 'var(--surface)',
  border: '0.5px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 12px',
  fontSize: 14,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const microLabel = {
  fontSize: 10,
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-sans)',
  marginBottom: 5,
  display: 'block',
  fontWeight: 500,
};

// cardStyle → uses .card .card-padded .card-bordered classes

export default function Onboarding() {
  const { user, token, updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    goal: null,
    gender:     user?.gender || 'male',
    age:        user?.age    ? String(user.age)    : '',
    weight:     user?.weight ? String(user.weight) : '',
    height:     user?.height ? String(user.height) : '',
    activity: null, goal_weight: '',
  });
  const [tdee, setTdee]                 = useState(null);
  const [targetCalories, setTargetCal]  = useState(null);
  const [monthsToGoal, setMonthsToGoal] = useState(null);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState(false);

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  const ageNum = Number(data.age);
  const ageTooYoung = data.age && ageNum < 16;
  const canProceed = data.gender && data.age && !ageTooYoung && data.weight && data.height && data.activity;

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
    setSaveError(false);
    try {
      const macros = calculateMacros(targetCalories, data.goal);
      await api.updateProfile({
        name: user.name,
        age: data.age, weight: data.weight, height: data.height,
        gender: data.gender, goal_weight: data.goal_weight || null,
        target_calories: targetCalories, tdee, formula_used: 'mifflin',
        target_protein: macros.protein,
        target_carbs:   macros.carbs,
        target_fat:     macros.fat,
        onboarding_completed: 1,
      }, token);
      updateUser({ ...user, age: Number(data.age), weight: Number(data.weight), height: Number(data.height), gender: data.gender, goal_weight: data.goal_weight || null, target_calories: targetCalories, target_protein: macros.protein, target_carbs: macros.carbs, target_fat: macros.fat, onboarding_completed: 1 });
    } catch {
      setSaveError(true);
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ padding: '20px 20px 0', maxWidth: 520, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <span style={{
          fontFamily: 'var(--font-serif)', fontStyle: 'italic',
          fontSize: 20, color: 'var(--text-primary)',
        }}>
          Caliro
        </span>

        {/* Barra de progreso */}
        <div style={{ display: 'flex', gap: 4, marginTop: 18 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              flex: 1, height: 2, borderRadius: 100,
              background: i <= step ? 'var(--accent)' : 'var(--surface-3)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, padding: '0 16px 32px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: 520, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

          {/* Botón volver */}
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} style={{
              background: 'none', border: 'none', fontSize: 13,
              color: 'var(--text-secondary)', cursor: 'pointer',
              padding: '16px 0 0', fontFamily: 'var(--font-sans)',
              alignSelf: 'flex-start',
            }}>
              ← Volver
            </button>
          )}

          {/* ── PASO 1: Objetivo ── */}
          {step === 1 && (
            <div style={{ paddingTop: 32, flex: 1 }}>
              <h1 style={{
                fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                fontSize: 30, fontWeight: 400, color: 'var(--text-primary)',
                margin: '0 0 6px', lineHeight: 1.2,
              }}>
                ¿Qué quieres conseguir?
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 24px', fontFamily: 'var(--font-sans)' }}>
                Tu objetivo define tu plan nutricional.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {GOALS.map(g => (
                  <button key={g.key}
                    onClick={() => { set('goal', g.key); setStep(2); }}
                    className="card card-padded card-bordered"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color 0.15s, transform 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = ''; }}
                  >
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{g.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
                        {g.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
                        {g.subtitle}
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 16, flexShrink: 0 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── PASO 2: Datos personales ── */}
          {step === 2 && (
            <div style={{ paddingTop: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h1 style={{
                fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                fontSize: 24, fontWeight: 400, color: 'var(--text-primary)',
                margin: '0 0 20px', lineHeight: 1.3,
              }}>
                {GOAL_TITLES[data.goal]}
              </h1>

              <div className="card card-padded card-bordered">

                {/* Género */}
                <div style={{ marginBottom: 16 }}>
                  <span style={microLabel}>Sexo</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['male', 'Hombre'], ['female', 'Mujer']].map(([val, label]) => {
                      const active = data.gender === val;
                      return (
                        <button key={val} type="button" onClick={() => set('gender', val)} style={{
                          flex: 1, padding: '9px 0', fontSize: 13,
                          fontFamily: 'var(--font-sans)',
                          fontWeight: active ? 600 : 400,
                          color: active ? 'var(--accent)' : 'var(--text-secondary)',
                          background: active ? 'rgba(45,106,79,0.08)' : 'transparent',
                          border: `0.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.15s',
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
                    { k: 'age',    label: 'Edad',        placeholder: '25' },
                    { k: 'weight', label: 'Peso (kg)',    placeholder: '70' },
                    { k: 'height', label: 'Altura (cm)',  placeholder: '175' },
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

                {ageTooYoung && (
                  <div style={{
                    padding: '10px 14px', marginBottom: 16,
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                    borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#b91c1c',
                    lineHeight: 1.5,
                  }}>
                    Caliro está diseñado para mayores de 16 años. Si tienes menos de 16, consulta con un adulto o profesional de salud antes de hacer seguimiento calórico.
                  </div>
                )}

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

                {/* Actividad — ghost pills */}
                <div>
                  <span style={microLabel}>Nivel de actividad</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ACTIVITIES.map(a => {
                      const active = data.activity === a.key;
                      return (
                        <button key={a.key} type="button" onClick={() => set('activity', a.key)} style={{
                          background: active ? 'rgba(45,106,79,0.06)' : 'var(--surface-2)',
                          border: `0.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-md)', padding: '10px 12px',
                          cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                        }}>
                          <div style={{
                            fontSize: 13, fontWeight: active ? 500 : 400,
                            color: active ? 'var(--accent)' : 'var(--text-primary)',
                            fontFamily: 'var(--font-sans)',
                          }}>
                            {a.label}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1, fontFamily: 'var(--font-sans)' }}>
                            {a.sub}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button onClick={computeAndAdvance} disabled={!canProceed} style={{
                padding: '13px', width: '100%', marginTop: 12,
                background: canProceed ? 'var(--accent)' : 'var(--surface-3)',
                color: canProceed ? 'white' : 'var(--text-tertiary)',
                border: 'none', borderRadius: 'var(--radius-full)',
                fontSize: 13, fontWeight: 500, cursor: canProceed ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
              }}>
                Calcular mi objetivo →
              </button>
            </div>
          )}

          {/* ── PASO 3: Proyección ── */}
          {step === 3 && (
            <div style={{ paddingTop: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>

              {/* Hero número */}
              <div style={{ padding: '0 4px', marginBottom: 24 }}>
                <span style={{
                  fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.7px',
                  fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
                }}>
                  Tu objetivo diario
                </span>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                  fontSize: 64, fontWeight: 400, lineHeight: 1,
                  color: 'var(--text-primary)', letterSpacing: '-3px',
                  marginTop: 4,
                }}>
                  {targetCalories?.toLocaleString('es')}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginTop: 4 }}>
                  kcal/día
                </div>
              </div>

              {/* Card detalles */}
              <div className="card card-padded card-bordered">
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                    Tu TDEE estimado
                  </span>
                  <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', marginTop: 3 }}>
                    {tdee?.toLocaleString('es')} kcal/día
                  </div>
                </div>

                <div style={{ height: '0.5px', background: 'var(--border)', marginBottom: 12 }} />

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', margin: 0, lineHeight: 1.55 }}>
                  {data.goal === 'lose' && monthsToGoal
                    ? `Con este déficit de 400 kcal/día, podrías llegar a ${data.goal_weight} kg en aproximadamente ${monthsToGoal} ${monthsToGoal === 1 ? 'mes' : 'meses'}.`
                    : data.goal === 'lose'
                    ? 'Con este déficit de 400 kcal/día perderás ~0,5 kg por semana de forma sostenible.'
                    : data.goal === 'maintain'
                    ? `Comer alrededor de ${targetCalories?.toLocaleString('es')} kcal/día mantendrá tu peso actual.`
                    : 'Con este superávit de 300 kcal/día ganarás músculo de forma progresiva.'}
                </p>
              </div>

              <p style={{
                fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)',
                lineHeight: 1.55, margin: '16px 4px 0',
              }}>
                Calculado con la fórmula Mifflin-St Jeor, el estándar clínico más preciso.
                Puedes ajustarlo en tu perfil en cualquier momento.
              </p>

              {saveError && (
                <p style={{
                  fontSize: 12, color: 'var(--accent-2)',
                  fontFamily: 'var(--font-sans)', textAlign: 'center',
                  margin: '16px 0 0',
                }}>
                  No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.
                </p>
              )}
              <button onClick={handleFinish} disabled={saving} style={{
                padding: '13px', width: '100%',
                background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: 'var(--radius-full)',
                fontSize: 13, fontWeight: 500,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)', marginTop: 16,
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
