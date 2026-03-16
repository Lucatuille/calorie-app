import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import TDEECalculator from '../components/TDEECalculator';

function exportCSV(entries) {
  const header = 'Fecha,Calorías,Proteína(g),Carbos(g),Grasa(g),Peso(kg),Notas';
  const rows = entries.map(e =>
    [e.date, e.calories, e.protein||'', e.carbs||'', e.fat||'', e.weight||'', `"${(e.notes||'').replace(/"/g,'""')}"`].join(',')
  );
  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `historial-kcal-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Profile() {
  const { token, user } = useAuth();
  const [form,      setForm]      = useState({
    name: '', age: '', weight: '', height: '', gender: 'male',
    target_calories: '', target_protein: '', target_carbs: '', target_fat: '',
    goal_weight: '',
  });
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showTDEE,      setShowTDEE]      = useState(false);
  const [calibration,   setCalibration]   = useState(null);
  const [resetConfirm,  setResetConfirm]  = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.getCalibrationProfile(token).then(setCalibration).catch(() => {});
  }, [token]);

  useEffect(() => {
    api.getProfile(token).then(p => {
      setForm({
        name:            p.name            || '',
        age:             p.age             || '',
        weight:          p.weight          || '',
        height:          p.height          || '',
        gender:          p.gender          || 'male',
        target_calories: p.target_calories || '',
        target_protein:  p.target_protein  || '',
        target_carbs:    p.target_carbs    || '',
        target_fat:      p.target_fat      || '',
        goal_weight:     p.goal_weight     || '',
      });
    }).catch(console.error);
  }, [token]);

  async function handleSave(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.updateProfile(form, token);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  async function handleTDEESave(tdeeData) {
    // Merge with existing profile so PUT doesn't wipe name/age/weight/etc.
    const current = await api.getProfile(token);
    await api.updateProfile({ ...current, ...tdeeData }, token);
    const p = await api.getProfile(token);
    setForm(f => ({
      ...f,
      target_calories: p.target_calories || '',
      target_protein:  p.target_protein  || '',
      target_carbs:    p.target_carbs    || '',
      target_fat:      p.target_fat      || '',
    }));
  }

  async function handleResetCalibration() {
    await api.resetCalibration(token);
    setCalibration(null);
    setResetConfirm(false);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const entries = await api.getAllEntries(365, token);
      exportCSV(entries);
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  }

  return (
    <div className="page">
      <h1 className="title-xl" style={{ marginBottom: 6 }}>Mi perfil</h1>
      <p className="body-sm" style={{ marginBottom: 28 }}>{user?.email}</p>

      <div className="card">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="field">
            <label>Nombre</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} />
          </div>

          <div className="field">
            <label>Sexo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['male','female'].map(g => (
                <button key={g} type="button"
                  className={`btn btn-sm ${form.gender === g ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => set('gender', g)}>
                  {g === 'male' ? 'Hombre' : 'Mujer'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <div className="field">
              <label>Edad</label>
              <input type="number" value={form.age} onChange={e => set('age', e.target.value)} />
            </div>
            <div className="field">
              <label>Peso (kg)</label>
              <input type="number" step="0.1" value={form.weight} onChange={e => set('weight', e.target.value)} />
            </div>
            <div className="field">
              <label>Altura (cm)</label>
              <input type="number" value={form.height} onChange={e => set('height', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>Peso objetivo (kg)</label>
            <input type="number" step="0.1" placeholder="ej. 70"
              value={form.goal_weight} onChange={e => set('goal_weight', e.target.value)} />
          </div>

          <div className="divider" />

          {/* Objetivo calórico */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Objetivo calórico diario (kcal)</label>
              <button type="button" className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '3px 10px' }}
                onClick={() => setShowTDEE(true)}>
                ⚡ Calcular TDEE
              </button>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <input type="number" placeholder="ej. 2000"
                value={form.target_calories} onChange={e => set('target_calories', e.target.value)} />
            </div>
          </div>

          {/* Objetivos de macros */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 10, letterSpacing: '0.02em' }}>
              Objetivos de macros (opcional)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <div className="field">
                <label>Proteína (g)</label>
                <input type="number" placeholder="150" value={form.target_protein} onChange={e => set('target_protein', e.target.value)} />
              </div>
              <div className="field">
                <label>Carbos (g)</label>
                <input type="number" placeholder="200" value={form.target_carbs} onChange={e => set('target_carbs', e.target.value)} />
              </div>
              <div className="field">
                <label>Grasa (g)</label>
                <input type="number" placeholder="65" value={form.target_fat} onChange={e => set('target_fat', e.target.value)} />
              </div>
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {saved && <div className="alert alert-success">✓ Perfil actualizado</div>}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Guardar cambios'}
          </button>
        </form>
      </div>

      <TDEECalculator
        isOpen={showTDEE}
        onClose={() => setShowTDEE(false)}
        onSave={handleTDEESave}
      />

      {/* Motor personal de calibración */}
      {calibration && calibration.data_points >= 3 && (
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>📊 Tu motor personal</p>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12 }}>
            <span style={{ color: 'var(--text-2)' }}>Correcciones registradas</span>
            <strong>{calibration.data_points}</strong>
          </div>

          {/* Barra de precisión */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: 5 }}>
              <span>Precisión del modelo</span>
              <span>
                {calibration.confidence < 0.3 ? 'Aprendiendo...' :
                 calibration.confidence < 0.6 ? 'Mejorando' :
                 calibration.confidence < 0.8 ? 'Buena precisión' : 'Alta precisión'}
              </span>
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 99 }}>
              <div style={{
                height: '100%',
                width: `${Math.round(calibration.confidence * 100)}%`,
                background: calibration.confidence >= 0.6 ? 'var(--accent)' : '#f59e0b',
                borderRadius: 99, transition: 'width 0.6s',
              }} />
            </div>
          </div>

          {/* Bias global */}
          {Math.abs(calibration.global_bias) > 0.05 && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
              {calibration.global_bias > 0
                ? `La IA tiende a subestimarte un ${Math.round(calibration.global_bias * 100)}%`
                : `La IA tiende a sobreestimarte un ${Math.round(Math.abs(calibration.global_bias) * 100)}%`
              }
            </p>
          )}

          {/* Factores por tipo de comida (top 3) */}
          {Object.keys(calibration.food_factors).length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Por tipo de comida:</p>
              {Object.entries(calibration.food_factors)
                .sort((a, b) => Math.abs(b[1].bias) - Math.abs(a[1].bias))
                .slice(0, 3)
                .map(([cat, data]) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: 'var(--text-2)', textTransform: 'capitalize' }}>
                      {cat.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontWeight: 600, color: data.bias > 0 ? 'var(--accent-2)' : 'var(--accent)' }}>
                      {data.bias > 0 ? '+' : ''}{Math.round(data.bias * 100)}%
                    </span>
                  </div>
                ))
              }
            </div>
          )}

          {/* Comidas frecuentes (top 3, deduplicadas por nombre difuso) */}
          {calibration.frequent_meals?.length > 0 && (() => {
            // Fusionar entradas con nombre aproximado igual (datos legacy)
            const merged = [];
            for (const meal of calibration.frequent_meals) {
              const words = meal.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
              const existing = merged.find(m => {
                const mw = m.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
                const hits = words.filter(w => mw.includes(w));
                return hits.length >= 2 || (words.length === 1 && hits.length === 1);
              });
              if (existing) {
                const total = existing.times + meal.times;
                existing.avg_kcal = Math.round(
                  (existing.avg_kcal * existing.times + meal.avg_kcal * meal.times) / total
                );
                existing.times = total;
                if (meal.name.length < existing.name.length) existing.name = meal.name;
              } else {
                merged.push({ ...meal });
              }
            }
            const top = merged.sort((a, b) => b.times - a.times).slice(0, 3);
            return (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Tus comidas más registradas:</p>
                {top.map(meal => (
                  <div key={meal.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: 'var(--text-2)' }}>{meal.name}</span>
                    <span style={{ color: 'var(--text-3)' }}>{meal.avg_kcal} kcal · {meal.times}×</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Reset */}
          {!resetConfirm ? (
            <button
              onClick={() => setResetConfirm(true)}
              style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none',
                       cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Resetear calibración
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>¿Borrar historial de aprendizaje?</span>
              <button className="btn btn-sm" style={{ background: 'var(--danger)', color: 'white', border: 'none', fontSize: 11 }}
                onClick={handleResetCalibration}>Confirmar</button>
              <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}
                onClick={() => setResetConfirm(false)}>Cancelar</button>
            </div>
          )}
        </div>
      )}

      {/* Exportar datos */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Exportar datos</p>
            <p className="body-sm">Descarga tu historial completo en CSV</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exportando...' : '↓ CSV'}
          </button>
        </div>
      </div>

      {/* Legal footer */}
      <p style={{
        marginTop: 32, marginBottom: 8,
        fontSize: 11, color: 'var(--text-3)', opacity: 0.7,
        lineHeight: 1.6, textAlign: 'center',
      }}>
        LucaEats v1.0 · Herramienta de tracking nutricional personal
        <br />
        No es un dispositivo médico ni sustituye asesoramiento clínico.
        <br />
        <Link to="/privacy" style={{ color: 'var(--text-3)' }}>Política de privacidad</Link>
      </p>

      {user?.access_level === 99 && (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-admin'))}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-3)', fontSize: 11,
            opacity: 0.3, cursor: 'pointer',
            padding: 8, display: 'block', margin: '0 auto',
          }}
        >
          ⚙️ admin
        </button>
      )}
    </div>
  );
}
