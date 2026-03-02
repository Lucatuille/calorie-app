import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const ACTIVITY = [
  { label: 'Sedentario',  mult: 1.2 },
  { label: 'Ligero',      mult: 1.375 },
  { label: 'Moderado',    mult: 1.55 },
  { label: 'Activo',      mult: 1.725 },
  { label: 'Muy activo',  mult: 1.9 },
];

export default function Calculator() {
  const { token } = useAuth();

  // Log form
  const [log, setLog]       = useState({ calories: '', protein: '', carbs: '', fat: '', weight: '', notes: '' });
  const [logSaved, setLogSaved] = useState(false);
  const [logError, setLogError] = useState('');
  const [logLoading, setLogLoading] = useState(false);

  // TDEE form
  const [tdee, setTdee]     = useState({ age: '', weight: '', height: '', gender: 'male', activity: 1 });
  const [tdeeResult, setTdeeResult] = useState(null);

  const setL = (k, v) => setLog(f => ({ ...f, [k]: v }));
  const setT = (k, v) => setTdee(f => ({ ...f, [k]: v }));

  // Load today's existing entry
  useEffect(() => {
    api.getTodayEntry(token).then(entry => {
      if (entry) setLog({
        calories: entry.calories || '',
        protein:  entry.protein  || '',
        carbs:    entry.carbs    || '',
        fat:      entry.fat      || '',
        weight:   entry.weight   || '',
        notes:    entry.notes    || '',
      });
    }).catch(() => {});
  }, [token]);

  async function saveLog(e) {
    e.preventDefault();
    if (!log.calories) { setLogError('Las calorías son obligatorias'); return; }
    setLogError(''); setLogLoading(true);
    try {
      await api.saveEntry({
        calories: parseInt(log.calories),
        protein:  parseFloat(log.protein)  || null,
        carbs:    parseFloat(log.carbs)    || null,
        fat:      parseFloat(log.fat)      || null,
        weight:   parseFloat(log.weight)   || null,
        notes:    log.notes || null,
      }, token);
      setLogSaved(true);
      setTimeout(() => setLogSaved(false), 3000);
    } catch (err) {
      setLogError(err.message);
    } finally { setLogLoading(false); }
  }

  function calcTdee() {
    const { age, weight, height, gender, activity } = tdee;
    if (!age || !weight || !height) return;
    const bmr = gender === 'male'
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
    const result = Math.round(bmr * ACTIVITY[activity].mult);
    setTdeeResult(result);
  }

  async function applyTarget() {
    if (!tdeeResult) return;
    try {
      await api.updateProfile({ target_calories: tdeeResult }, token);
      alert(`Objetivo de ${tdeeResult} kcal guardado en tu perfil ✓`);
    } catch {}
  }

  return (
    <div className="page">
      <h1 className="title-xl" style={{ marginBottom: 6 }}>Registrar</h1>
      <p className="body-sm" style={{ marginBottom: 28 }}>Guarda las calorías de hoy</p>

      {/* ── Daily log ─────────────────────────────── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h2 className="title-md" style={{ marginBottom: 20 }}>Entrada del día</h2>
        <form onSubmit={saveLog} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div className="field">
            <label>Calorías totales *</label>
            <input type="number" placeholder="1800" value={log.calories} onChange={e => setL('calories', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <div className="field">
              <label>Proteína (g)</label>
              <input type="number" placeholder="130" value={log.protein} onChange={e => setL('protein', e.target.value)} />
            </div>
            <div className="field">
              <label>Carbos (g)</label>
              <input type="number" placeholder="200" value={log.carbs} onChange={e => setL('carbs', e.target.value)} />
            </div>
            <div className="field">
              <label>Grasa (g)</label>
              <input type="number" placeholder="60" value={log.fat} onChange={e => setL('fat', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Peso corporal hoy (kg)</label>
            <input type="number" placeholder="74.5" step="0.1" value={log.weight} onChange={e => setL('weight', e.target.value)} />
          </div>

          <div className="field">
            <label>Notas</label>
            <input placeholder="Día de descanso, comí fuera..." value={log.notes} onChange={e => setL('notes', e.target.value)} />
          </div>

          {logError  && <div className="alert alert-error">{logError}</div>}
          {logSaved  && <div className="alert alert-success">✓ Guardado correctamente</div>}

          <button className="btn btn-primary btn-full" type="submit" disabled={logLoading}>
            {logLoading ? <span className="spinner" /> : 'Guardar entrada'}
          </button>
        </form>
      </div>

      {/* ── TDEE Calculator ───────────────────────── */}
      <div style={{ height: 20 }} />
      <h2 className="title-md" style={{ marginBottom: 6 }}>Calculadora TDEE</h2>
      <p className="body-sm" style={{ marginBottom: 16 }}>Calcula tu gasto calórico diario y guárdalo como objetivo</p>

      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {['male','female'].map(g => (
              <button key={g} type="button"
                className={`btn btn-sm ${tdee.gender === g ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setT('gender', g)}>
                {g === 'male' ? 'Hombre' : 'Mujer'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <div className="field">
              <label>Edad</label>
              <input type="number" placeholder="25" value={tdee.age} onChange={e => setT('age', e.target.value)} />
            </div>
            <div className="field">
              <label>Peso (kg)</label>
              <input type="number" placeholder="70" value={tdee.weight} onChange={e => setT('weight', e.target.value)} />
            </div>
            <div className="field">
              <label>Altura (cm)</label>
              <input type="number" placeholder="175" value={tdee.height} onChange={e => setT('height', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Actividad</label>
            <select value={tdee.activity} onChange={e => setT('activity', parseInt(e.target.value))}>
              {ACTIVITY.map((a, i) => <option key={i} value={i}>{a.label} (×{a.mult})</option>)}
            </select>
          </div>

          <button className="btn btn-secondary btn-full" type="button" onClick={calcTdee}>
            Calcular
          </button>

          {tdeeResult && (
            <div style={{
              background: 'var(--accent-lt)', border: '1px solid rgba(45,106,79,0.2)',
              borderRadius: 8, padding: '16px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
            }}>
              <div>
                <div style={{ fontFamily: 'Instrument Serif', fontSize: 36, color: 'var(--accent)', lineHeight: 1 }}>
                  {tdeeResult.toLocaleString()} kcal
                </div>
                <div className="muted" style={{ marginTop: 4 }}>para mantener tu peso actual</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={applyTarget}>
                Usar como objetivo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
