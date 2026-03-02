import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { token, user } = useAuth();
  const [form,    setForm]    = useState({ name: '', age: '', weight: '', height: '', gender: 'male', target_calories: '' });
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.getProfile(token).then(p => {
      setForm({
        name:             p.name             || '',
        age:              p.age              || '',
        weight:           p.weight           || '',
        height:           p.height           || '',
        gender:           p.gender           || 'male',
        target_calories:  p.target_calories  || '',
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

          <div className="field">
            <label>Objetivo calórico diario (kcal)</label>
            <input type="number" placeholder="ej. 2000 — o calcula en la página Registrar"
              value={form.target_calories} onChange={e => set('target_calories', e.target.value)} />
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {saved && <div className="alert alert-success">✓ Perfil actualizado</div>}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  );
}
