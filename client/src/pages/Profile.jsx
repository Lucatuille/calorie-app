import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

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
  });
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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

          <div className="divider" />

          {/* Objetivo calórico */}
          <div className="field">
            <label>Objetivo calórico diario (kcal)</label>
            <input type="number" placeholder="ej. 2000 — o calcula en la página Registrar"
              value={form.target_calories} onChange={e => set('target_calories', e.target.value)} />
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
    </div>
  );
}
