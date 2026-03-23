import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { calculateResult, LOSE_TABLE, GAIN_TABLE } from '../utils/tdee';
import FocusTrap from './FocusTrap';

// ── Count-up animation ────────────────────────────────────────
function useCountUp(target, active = true, duration = 750) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active || !target) { setVal(target || 0); return; }
    let cur = 0;
    const step = Math.max(1, target / (duration / 16));
    const id = setInterval(() => {
      cur += step;
      if (cur >= target) { setVal(target); clearInterval(id); }
      else setVal(Math.floor(cur));
    }, 16);
    return () => clearInterval(id);
  }, [target, active]);
  return val;
}

// ── Reusable sub-components ───────────────────────────────────
function Stepper({ value, onChange, min, max, suffix }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 22, fontWeight: 300, color: 'var(--text-2)' }}
      >−</button>
      <div style={{ textAlign: 'center', minWidth: 70 }}>
        <span style={{ fontSize: 40, fontWeight: 700, fontFamily: 'Plus Jakarta Sans', letterSpacing: '-0.03em' }}>{value}</span>
        {suffix && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{suffix}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 22, fontWeight: 300, color: 'var(--text-2)' }}
      >+</button>
    </div>
  );
}

function UnitToggle({ value, options, onChange }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--border)', borderRadius: 8, padding: 2 }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            padding: '5px 14px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: value === opt.value ? 'var(--surface)' : 'transparent',
            color: value === opt.value ? 'var(--text-2)' : 'var(--text-3)',
            transition: 'background 0.15s, color 0.15s',
            boxShadow: value === opt.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >{opt.label}</button>
      ))}
    </div>
  );
}

function OptionCard({ selected, onClick, icon, label, sub, wide }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: wide ? '12px 14px' : '16px 10px',
        borderRadius: 12,
        border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        background: selected ? 'rgba(45,106,79,0.07)' : 'var(--bg)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        display: 'flex',
        flexDirection: wide ? 'row' : 'column',
        alignItems: 'center',
        gap: wide ? 10 : 7,
        width: '100%',
        textAlign: wide ? 'left' : 'center',
      }}
    >
      <span style={{ fontSize: wide ? 18 : 26, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: selected ? 'var(--accent)' : 'var(--text-2)', lineHeight: 1.3 }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.3 }}>{sub}</div>}
      </div>
      {wide && selected && <span style={{ color: 'var(--accent)', fontSize: 14, flexShrink: 0 }}>✓</span>}
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
      {children}
    </p>
  );
}

// ── Step 1: Tu cuerpo ─────────────────────────────────────────
function Step1({ data, set }) {
  const [ageError, setAgeError] = useState('');

  function handleAge(v) {
    set('age', v);
    if (v < 15 || v > 100) setAgeError('Rango válido: 15-100');
    else setAgeError('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 4 }}>Cuéntanos sobre ti</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Cuanto más precisos sean los datos, mejor será el resultado</p>
      </div>

      {/* Sexo biológico */}
      <div>
        <SectionLabel>Sexo biológico</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <OptionCard selected={data.gender === 'male'}   onClick={() => set('gender', 'male')}   icon="👨" label="Hombre" />
          <OptionCard selected={data.gender === 'female'} onClick={() => set('gender', 'female')} icon="👩" label="Mujer" />
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>Usamos sexo biológico porque afecta al metabolismo basal</p>
      </div>

      {/* Edad */}
      <div>
        <SectionLabel>Edad</SectionLabel>
        <Stepper value={parseInt(data.age) || 25} onChange={handleAge} min={15} max={100} suffix="años" />
        {ageError && <p style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center', marginTop: 6 }}>{ageError}</p>}
      </div>

      {/* Altura */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <SectionLabel>Altura</SectionLabel>
          <UnitToggle
            value={data.heightUnit}
            options={[{ value: 'cm', label: 'CM' }, { value: 'ft', label: 'FT' }]}
            onChange={v => set('heightUnit', v)}
          />
        </div>
        {data.heightUnit === 'cm' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
            <div className="field" style={{ margin: 0, maxWidth: 120 }}>
              <input
                type="number" placeholder="175"
                value={data.heightCm}
                onChange={e => set('heightCm', e.target.value)}
                style={{ textAlign: 'center', fontSize: 24, fontWeight: 700 }}
              />
            </div>
            <span style={{ color: 'var(--text-3)', fontSize: 14 }}>cm</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
            <div className="field" style={{ margin: 0, maxWidth: 80 }}>
              <input
                type="number" placeholder="5"
                value={data.heightFt}
                onChange={e => set('heightFt', e.target.value)}
                style={{ textAlign: 'center', fontSize: 20, fontWeight: 700 }}
              />
            </div>
            <span style={{ color: 'var(--text-3)' }}>ft</span>
            <div className="field" style={{ margin: 0, maxWidth: 80 }}>
              <input
                type="number" placeholder="10"
                value={data.heightIn}
                onChange={e => set('heightIn', e.target.value)}
                style={{ textAlign: 'center', fontSize: 20, fontWeight: 700 }}
              />
            </div>
            <span style={{ color: 'var(--text-3)' }}>in</span>
          </div>
        )}
      </div>

      {/* Peso */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <SectionLabel>Peso actual</SectionLabel>
          <UnitToggle
            value={data.weightUnit}
            options={[{ value: 'kg', label: 'KG' }, { value: 'lb', label: 'LB' }]}
            onChange={v => set('weightUnit', v)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <div className="field" style={{ margin: 0, maxWidth: 140 }}>
            <input
              type="number" step="0.1" placeholder={data.weightUnit === 'kg' ? '70' : '154'}
              value={data.weight}
              onChange={e => set('weight', e.target.value)}
              style={{ textAlign: 'center', fontSize: 24, fontWeight: 700 }}
            />
          </div>
          <span style={{ color: 'var(--text-3)', fontSize: 14 }}>{data.weightUnit}</span>
        </div>
      </div>

      {/* % Grasa corporal (opcional) */}
      <div>
        {!data.showBodyFat ? (
          <button
            type="button"
            onClick={() => set('showBodyFat', true)}
            style={{
              background: 'none', border: '1px dashed var(--border)',
              borderRadius: 10, padding: '10px 16px', cursor: 'pointer',
              fontSize: 13, color: 'var(--text-3)', width: '100%',
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
            }}
          >
            <span>+</span> ¿Conoces tu % de grasa corporal? (opcional)
          </button>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <SectionLabel>% Grasa corporal</SectionLabel>
              <button
                type="button"
                onClick={() => { set('showBodyFat', false); set('bodyFat', ''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-3)' }}
              >Quitar</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
              <div className="field" style={{ margin: 0, maxWidth: 100 }}>
                <input
                  type="number" step="0.5" placeholder="18"
                  value={data.bodyFat}
                  onChange={e => set('bodyFat', e.target.value)}
                  style={{ textAlign: 'center', fontSize: 20, fontWeight: 700 }}
                />
              </div>
              <span style={{ color: 'var(--text-3)' }}>%</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 8 }}>
              🔬 Con este dato usaremos la fórmula Katch-McArdle (más precisa para atletas)
            </p>
          </div>
        )}
      </div>

      <div style={{ height: 8 }} />
    </div>
  );
}

// ── Step 2: Tu día a día ──────────────────────────────────────
function Step2({ data, set }) {
  const jobs = [
    { key: 'desk',     icon: '🪑', label: 'Escritorio / estudio', sub: 'oficina, teletrabajo, estudiante' },
    { key: 'standing', icon: '🚶', label: 'De pie o en movimiento', sub: 'dependiente, camarero...' },
    { key: 'physical', icon: '💪', label: 'Trabajo físico intenso', sub: 'construcción, agricultura' },
    { key: 'home',     icon: '🏠', label: 'En casa', sub: 'tareas del hogar, cuidados' },
  ];
  const stepsOpts = [
    { key: 'low',    icon: '🐌', label: 'Poco',     sub: '< 5.000 pasos' },
    { key: 'medium', icon: '🚶', label: 'Normal',   sub: '5.000-10.000 pasos' },
    { key: 'high',   icon: '🏃', label: 'Bastante', sub: '10.000-15.000' },
    { key: 'very',   icon: '⚡', label: 'Mucho',    sub: '> 15.000 pasos' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 4 }}>¿Cómo es tu día típico?</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No cuentes el ejercicio — eso va en el siguiente paso</p>
      </div>

      <div>
        <SectionLabel>¿Cuál describe mejor tu día a día?</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {jobs.map(j => (
            <OptionCard key={j.key} selected={data.jobType === j.key} onClick={() => set('jobType', j.key)}
              icon={j.icon} label={j.label} sub={j.sub} />
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>¿Cuánto caminas al día habitualmente?</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {stepsOpts.map(s => (
            <OptionCard key={s.key} selected={data.steps === s.key} onClick={() => set('steps', s.key)}
              icon={s.icon} label={s.label} sub={s.sub} />
          ))}
        </div>
      </div>

      <div style={{ height: 8 }} />
    </div>
  );
}

// ── Step 3: Tu ejercicio ──────────────────────────────────────
function Step3({ data, set }) {
  const durations = [
    { key: 'short',  label: '< 30 min' },
    { key: 'medium', label: '45 min' },
    { key: 'hour',   label: '1 hora' },
    { key: 'long',   label: '+90 min' },
  ];
  const types = [
    { key: 'weights', icon: '🏋️', label: 'Pesas / musculación' },
    { key: 'cardio',  icon: '🏃', label: 'Cardio / running / ciclismo' },
    { key: 'mixed',   icon: '🤸', label: 'Deportes / clases / mixto' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 4 }}>¿Cuánto ejercicio haces?</h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Solo ejercicio planificado — no cuentes caminar al trabajo</p>
      </div>

      {/* Días por semana */}
      <div>
        <SectionLabel>¿Cuántos días a la semana entrenas?</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => set('exerciseDays', d)}
              style={{
                width: 40, height: 40, borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                border: `1.5px solid ${data.exerciseDays === d ? 'var(--accent)' : 'var(--border)'}`,
                background: data.exerciseDays === d ? 'rgba(45,106,79,0.1)' : 'var(--bg)',
                color: data.exerciseDays === d ? 'var(--accent)' : 'var(--text-2)',
                transition: 'all 0.15s',
              }}
            >{d}</button>
          ))}
        </div>
        {data.exerciseDays === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
            Sin ejercicio planificado — tu TDEE solo incluirá actividad diaria
          </p>
        )}
      </div>

      {/* Duración (solo si días > 0) */}
      {data.exerciseDays > 0 && (
        <div>
          <SectionLabel>¿Cuánto dura cada sesión habitualmente?</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {durations.map(dur => (
              <button
                key={dur.key}
                type="button"
                onClick={() => set('exerciseDuration', dur.key)}
                style={{
                  padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, textAlign: 'center',
                  border: `1.5px solid ${data.exerciseDuration === dur.key ? 'var(--accent)' : 'var(--border)'}`,
                  background: data.exerciseDuration === dur.key ? 'rgba(45,106,79,0.07)' : 'var(--bg)',
                  color: data.exerciseDuration === dur.key ? 'var(--accent)' : 'var(--text-2)',
                  transition: 'all 0.15s',
                }}
              >{dur.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Tipo (solo si días > 0) */}
      {data.exerciseDays > 0 && (
        <div>
          <SectionLabel>¿Qué tipo de ejercicio predomina?</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {types.map(t => (
              <OptionCard key={t.key} selected={data.exerciseType === t.key}
                onClick={() => set('exerciseType', t.key)}
                icon={t.icon} label={t.label} wide />
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 8 }} />
    </div>
  );
}

// ── Step 4: Tu objetivo ───────────────────────────────────────
function Step4({ data, set }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 4 }}>¿Qué quieres conseguir?</h2>
      </div>

      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <OptionCard selected={data.goal === 'lose'}     onClick={() => set('goal', 'lose')}     icon="📉" label="Perder peso" wide />
          <OptionCard selected={data.goal === 'maintain'} onClick={() => set('goal', 'maintain')} icon="⚖️" label="Mantener peso" wide />
          <OptionCard selected={data.goal === 'gain'}     onClick={() => set('goal', 'gain')}     icon="📈" label="Ganar músculo / volumen" wide />
        </div>
      </div>

      {/* Ritmo de pérdida */}
      {data.goal === 'lose' && (
        <div>
          <SectionLabel>¿A qué velocidad quieres perder?</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {LOSE_TABLE.map(row => (
              <button
                key={row.key}
                type="button"
                onClick={() => set('loseRate', row.key)}
                style={{
                  padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                  border: `1.5px solid ${data.loseRate === row.key ? 'var(--accent)' : 'var(--border)'}`,
                  background: data.loseRate === row.key ? 'rgba(45,106,79,0.07)' : 'var(--bg)',
                  display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 20 }}>{row.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: data.loseRate === row.key ? 'var(--accent)' : 'var(--text-2)' }}>
                    {row.label} &nbsp;–{row.rate} kg/semana
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    Déficit ~{row.deficit} kcal/día — {row.note}
                  </div>
                </div>
                {row.key === 'moderate' && (
                  <span style={{ fontSize: 10, background: 'rgba(45,106,79,0.15)', color: 'var(--accent)', padding: '2px 7px', borderRadius: 99, fontWeight: 600, flexShrink: 0 }}>✓ Reco</span>
                )}
                {data.loseRate === row.key && row.key !== 'moderate' && (
                  <span style={{ color: 'var(--accent)', fontSize: 14, flexShrink: 0 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ritmo de ganancia */}
      {data.goal === 'gain' && (
        <div>
          <SectionLabel>¿A qué ritmo quieres ganar?</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {GAIN_TABLE.map(row => (
              <button
                key={row.key}
                type="button"
                onClick={() => set('gainRate', row.key)}
                style={{
                  padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                  border: `1.5px solid ${data.gainRate === row.key ? 'var(--accent)' : 'var(--border)'}`,
                  background: data.gainRate === row.key ? 'rgba(45,106,79,0.07)' : 'var(--bg)',
                  display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 20 }}>{row.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: data.gainRate === row.key ? 'var(--accent)' : 'var(--text-2)' }}>
                    {row.label} &nbsp;+{row.rate} kg/semana
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    Superávit ~{row.surplus} kcal/día
                  </div>
                </div>
                {row.key === 'moderate' && (
                  <span style={{ fontSize: 10, background: 'rgba(45,106,79,0.15)', color: 'var(--accent)', padding: '2px 7px', borderRadius: 99, fontWeight: 600, flexShrink: 0 }}>✓ Reco</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 8 }} />
    </div>
  );
}

// ── Result screen ─────────────────────────────────────────────
function ResultScreen({ result, data, history }) {
  const tdeeDisplay   = useCountUp(result.tdee,           true);
  const targetDisplay = useCountUp(result.targetCalories, true);
  const [showHistory, setShowHistory] = useState(false);

  const prevHistory = history.slice(1); // exclude current (first entry)

  const goalLabel = {
    lose:     `Perder ${LOSE_TABLE.find(r => r.key === data.loseRate)?.rate || 0.5} kg/semana`,
    maintain: 'Mantener peso',
    gain:     `Ganar ${GAIN_TABLE.find(r => r.key === data.gainRate)?.rate || 0.5} kg/semana`,
  }[data.goal] || '';

  const macroColors = { protein: 'var(--color-protein)', carbs: 'var(--color-carbs)', fat: 'var(--color-fat)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 2 }}>Tu metabolismo</h2>
        {result.formula === 'katch-mcardle'
          ? <span style={{ fontSize: 11, background: 'rgba(99,102,241,0.12)', color: '#6366f1', padding: '3px 8px', borderRadius: 99, fontWeight: 600 }}>🔬 Katch-McArdle (composición corporal)</span>
          : <span style={{ fontSize: 11, background: 'rgba(45,106,79,0.1)', color: 'var(--accent)', padding: '3px 8px', borderRadius: 99, fontWeight: 600 }}>Mifflin-St Jeor 1990</span>
        }
      </div>

      {/* TDEE breakdown */}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
          Quemas al día
        </p>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 52, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 14 }}>
          {tdeeDisplay.toLocaleString()}
          <span style={{ fontSize: 18, color: 'var(--text-3)', marginLeft: 6 }}>kcal</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-3)' }}>🔥 Metabolismo basal</span>
            <span style={{ fontWeight: 600 }}>{result.bmr.toLocaleString()} kcal</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-3)' }}>🚶 Actividad diaria</span>
            <span style={{ fontWeight: 600 }}>+{result.activityKcal.toLocaleString()} kcal</span>
          </div>
          {result.exerciseKcal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-3)' }}>🏋️ Ejercicio (media/día)</span>
              <span style={{ fontWeight: 600 }}>+{result.exerciseKcal.toLocaleString()} kcal</span>
            </div>
          )}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          ⚠️ Margen de error estimado: ±150-200 kcal (inherente a cualquier fórmula)
        </p>
      </div>

      {/* Target calories */}
      {data.goal !== 'maintain' && (
        <div style={{ background: 'rgba(45,106,79,0.07)', border: '1.5px solid var(--accent)', borderRadius: 14, padding: '16px 18px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>
            Para tu objetivo: {goalLabel}
          </p>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 44, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 10 }}>
            {targetDisplay.toLocaleString()}
            <span style={{ fontSize: 16, color: 'var(--text-3)', marginLeft: 6 }}>kcal / día</span>
          </div>
          {result.belowMin ? (
            <div style={{ background: 'rgba(231,111,81,0.1)', border: '1px solid rgba(231,111,81,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--accent-2)', fontWeight: 500 }}>
                ⚠️ Con tu ritmo elegido, el objetivo sería demasiado bajo. Hemos ajustado al mínimo saludable ({result.MIN_CALORIES} kcal). Considera un ritmo más suave.
              </p>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {data.goal === 'lose' ? (
                <>
                  Déficit: {Math.abs(result.adjustment)} kcal/día
                  &nbsp;·&nbsp;≈ {(Math.abs(result.adjustment) / 7700 * 30).toFixed(1)} kg menos en 30 días
                </>
              ) : (
                <>
                  Superávit: +{result.adjustment} kcal/día
                  &nbsp;·&nbsp;≈ +{(result.adjustment / 7700 * 30).toFixed(1)} kg en 30 días
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Maintain: just show TDEE as target */}
      {data.goal === 'maintain' && (
        <div style={{ background: 'rgba(45,106,79,0.07)', border: '1.5px solid var(--accent)', borderRadius: 14, padding: '16px 18px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>
            Tu objetivo calórico
          </p>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 44, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {tdeeDisplay.toLocaleString()}
            <span style={{ fontSize: 16, color: 'var(--text-3)', marginLeft: 6 }}>kcal / día</span>
          </div>
        </div>
      )}

      {/* Alternatives table (lose only) */}
      {data.goal === 'lose' && (
        <div>
          <SectionLabel>Otras opciones</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {result.alternatives.map(alt => {
              const isSelected = alt.key === data.loseRate;
              return (
                <div key={alt.key} style={{
                  padding: '10px 8px', borderRadius: 10, textAlign: 'center',
                  border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  background: isSelected ? 'rgba(45,106,79,0.07)' : 'var(--bg)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isSelected ? 'var(--accent)' : 'var(--text-2)', marginBottom: 4 }}>
                    {alt.label}{isSelected ? ' ✓' : ''}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{alt.kcal.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                    {alt.belowMin ? '⚠️ bajo mín.' : `-${alt.monthlyKg}kg/mes`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Macros */}
      <div>
        <SectionLabel>Distribución de macros sugerida</SectionLabel>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Proteína', pct: result.macros.proteinPct, grams: result.macros.protein, color: macroColors.protein },
            { label: 'Carbos',   pct: result.macros.carbsPct,   grams: result.macros.carbs,   color: macroColors.carbs },
            { label: 'Grasa',    pct: result.macros.fatPct,     grams: result.macros.fat,      color: macroColors.fat },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 12, width: 62, color: 'var(--text-2)', flexShrink: 0 }}>{m.label}</div>
              <div style={{ flex: 1, height: 7, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${m.pct}%`, height: '100%', background: m.color, borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', width: 65, textAlign: 'right', flexShrink: 0 }}>
                {m.pct}% · {m.grams}g
              </div>
            </div>
          ))}
          {data.goal === 'lose' && (
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              ℹ️ La proteína alta (30%) protege la masa muscular durante el déficit calórico
            </p>
          )}
        </div>
      </div>

      {/* Safety warning */}
      <div style={{ background: 'rgba(231,111,81,0.06)', border: '1px solid rgba(231,111,81,0.2)', borderRadius: 10, padding: '10px 14px' }}>
        <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
          ⚠️ No se recomienda bajar de {result.MIN_CALORIES} kcal/día sin supervisión médica.
        </p>
      </div>

      {/* History */}
      {prevHistory.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory(h => !h)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-3)', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            📅 Cálculos anteriores {showHistory ? '▲' : '▼'}
          </button>
          {showHistory && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {prevHistory.map((h, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  {h.date} — TDEE {h.tdee.toLocaleString()} kcal (peso: {h.weight} kg)
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ height: 8 }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
const TOTAL_STEPS = 4;
const INITIAL_DATA = {
  gender: null, age: 25,
  heightUnit: 'cm', heightCm: 175, heightFt: 5, heightIn: 10,
  weightUnit: 'kg', weight: '',
  showBodyFat: false, bodyFat: '',
  jobType: null, steps: null,
  exerciseDays: 0, exerciseDuration: 'hour', exerciseType: 'weights',
  goal: null, loseRate: 'moderate', gainRate: 'moderate',
};

export default function TDEECalculator({ isOpen, onClose, onSave }) {
  const [step,    setStep]    = useState(1);
  const [dir,     setDir]     = useState(1);
  const [animKey, setAnimKey] = useState(0);
  const [data,    setData]    = useState(INITIAL_DATA);
  const [result,  setResult]  = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [history, setHistory] = useState([]);

  // Portal render guard (same pattern as SupplementManager)
  const [visible,  setVisible]  = useState(false);
  const [animOpen, setAnimOpen] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => {
    if (isOpen) {
      clearTimeout(closeTimer.current);
      setVisible(true);
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnimOpen(true))
      );
      return () => cancelAnimationFrame(raf);
    } else {
      setAnimOpen(false);
      closeTimer.current = setTimeout(() => setVisible(false), 350);
      return () => clearTimeout(closeTimer.current);
    }
  }, [isOpen]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1); setDir(1); setAnimKey(0);
      setData(INITIAL_DATA); setResult(null); setSaved(false);
      try { setHistory(JSON.parse(localStorage.getItem('tdee_history') || '[]')); }
      catch { setHistory([]); }
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && isOpen) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  const set = (key, val) => setData(d => ({ ...d, [key]: val }));

  function goTo(nextStep, direction) {
    setDir(direction);
    setAnimKey(k => k + 1);
    setStep(nextStep);
  }

  function goBack() {
    if (step === 'result') { goTo(4, -1); return; }
    if (step <= 1) { onClose(); return; }
    goTo(step - 1, -1);
  }

  function handleCalculate() {
    const r = calculateResult(data);
    setResult(r);
    // Persist to history
    const entry = {
      date:    new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      tdee:    r.tdee,
      weight:  r.weightKg,
      formula: r.formula,
    };
    const newHistory = [entry, ...history].slice(0, 3);
    setHistory(newHistory);
    localStorage.setItem('tdee_history', JSON.stringify(newHistory));
    goTo('result', 1);
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    try {
      await onSave({
        target_calories:    result.targetCalories,
        target_protein:     result.macros.protein,
        target_carbs:       result.macros.carbs,
        target_fat:         result.macros.fat,
        tdee:               result.tdee,
        bmr:                result.bmr,
        pal_factor:         Math.round(result.finalPAL * 100) / 100,
        formula_used:       result.formula,
        tdee_calculated_at: new Date().toISOString(),
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1800);
    } catch (err) {
      console.error(err);
    } finally { setSaving(false); }
  }

  // Step validation
  const stepValid = {
    1: data.gender && parseInt(data.age) >= 15 && parseInt(data.age) <= 100 && data.weight &&
       (data.heightUnit === 'cm' ? data.heightCm : (data.heightFt || data.heightIn)),
    2: data.jobType && data.steps,
    3: true,
    4: !!data.goal,
  };

  // Responsive breakpoint (same as SupplementManager)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= 640
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (!visible) return null;

  const stepProgress = step === 'result' ? TOTAL_STEPS : step;
  const stepLabel    = step === 'result' ? 'Resultado' : `Paso ${step} de ${TOTAL_STEPS}`;
  const animName     = dir >= 0 ? 'tdeeSlideRight' : 'tdeeSlideLeft';

  // Different layout per breakpoint
  const sheetStyle = isMobile ? {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999,
    maxWidth: 640, marginLeft: 'auto', marginRight: 'auto',
    background: 'var(--surface)',
    borderRadius: '20px 20px 0 0',
    height: '92vh', display: 'flex', flexDirection: 'column',
    transform: animOpen ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
  } : {
    position: 'fixed', top: '50%', left: '50%', zIndex: 999,
    width: '90%', maxWidth: 540,
    background: 'var(--surface)',
    borderRadius: 16,
    maxHeight: '88vh', display: 'flex', flexDirection: 'column',
    opacity: animOpen ? 1 : 0,
    transform: animOpen ? 'translate(-50%, -50%)' : 'translate(-50%, calc(-50% - 20px))',
    transition: 'opacity 0.22s ease, transform 0.25s cubic-bezier(0.4,0,0.2,1)',
    boxShadow: '0 8px 48px rgba(0,0,0,0.22)',
  };

  const renderStep = () => {
    switch (step) {
      case 1: return <Step1 data={data} set={set} />;
      case 2: return <Step2 data={data} set={set} />;
      case 3: return <Step3 data={data} set={set} />;
      case 4: return <Step4 data={data} set={set} />;
      case 'result': return <ResultScreen result={result} data={data} history={history} />;
    }
  };

  const renderFooter = () => {
    if (step === 'result') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {saved ? (
            <div style={{ textAlign: 'center', color: 'var(--accent)', fontWeight: 600, padding: '12px 0', fontSize: 14 }}>
              ✓ Objetivo actualizado — la app usará {result?.targetCalories?.toLocaleString()} kcal
            </div>
          ) : (
            <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '✓ Guardar como mi objetivo'}
            </button>
          )}
          {!saved && (
            <>
              <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5, textAlign: 'center' }}>
                ℹ️ Estos valores son estimaciones orientativas basadas en fórmulas estadísticas (±150-200 kcal de margen inherente). No constituyen prescripción dietética. Consulta con un nutricionista para un plan personalizado.
              </p>
              <button className="btn btn-secondary btn-full" onClick={() => goTo(4, -1)}>
                ↩ Recalcular
              </button>
            </>
          )}
        </div>
      );
    }
    const isLast = step === 4;
    return (
      <button
        className="btn btn-primary btn-full"
        disabled={!stepValid[step]}
        onClick={isLast ? handleCalculate : () => goTo(step + 1, 1)}
      >
        {isLast ? 'Calcular mi TDEE →' : 'Continuar →'}
      </button>
    );
  };

  return createPortal(
    <FocusTrap active={animOpen}>
    <div data-focus-trap-fallback>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 998,
        background: 'rgba(0,0,0,0.5)',
        opacity: animOpen ? 1 : 0,
        pointerEvents: animOpen ? 'auto' : 'none',
        transition: 'opacity 0.3s',
      }} />

      {/* Sheet / Modal */}
      <div style={sheetStyle}>
        {/* Handle — mobile only */}
        {isMobile && (
          <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border)' }} />
          </div>
        )}

        {/* Sticky header */}
        <div style={{ padding: '10px 16px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <button onClick={goBack}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 22, padding: '4px 8px', lineHeight: 1 }}>
              ←
            </button>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Calculadora TDEE</span>
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 20, padding: '4px 8px', lineHeight: 1 }}>
              ✕
            </button>
          </div>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 99,
                background: i < stepProgress ? 'var(--accent)' : 'var(--border)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{stepLabel}</p>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
          <div key={animKey} style={{ animation: `${animName} 0.2s ease forwards` }}>
            {renderStep()}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {renderFooter()}
        </div>
      </div>

      <style>{`
        @keyframes tdeeSlideRight {
          from { opacity: 0; transform: translateX(28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes tdeeSlideLeft {
          from { opacity: 0; transform: translateX(-28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
    </FocusTrap>,
    document.body
  );
}
