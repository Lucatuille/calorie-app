import { usePageTitle } from '../hooks/usePageTitle';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { CURRENT_VERSION } from '../data/whatsNew';

export default function Register() {
  usePageTitle("Registro");
  const [form, setForm]   = useState({ name: '', email: '', password: '', age: '', weight: '', height: '', gender: 'male' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (form.age && Number(form.age) < 16) {
      setError('Caliro está diseñado para mayores de 16 años. Si tienes menos de 16, consulta con un adulto o profesional de salud antes de hacer seguimiento calórico.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.register(form);
      login(data.token, data.user);
      // Nuevo usuario — ya tiene el onboarding, no mostrar What's New
      localStorage.setItem('caliro_whats_new_seen', CURRENT_VERSION);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div className="fade-up" style={{ width: '100%', maxWidth: 440 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--accent)', marginBottom: 8 }}>kcal</div>
          <h1 className="title-lg" style={{ marginBottom: 6 }}>Crea tu cuenta</h1>
          <p className="body-sm">Gratis para siempre</p>
        </div>

        <div className="card card-padded-lg card-bordered-lg">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div className="field">
              <label>Nombre</label>
              <input placeholder="Tu nombre" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>

            <div className="field">
              <label>Email</label>
              <input type="email" placeholder="tu@email.com" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>

            <div className="field">
              <label>Contraseña</label>
              <input type="password" placeholder="Mínimo 8 caracteres" value={form.password} onChange={e => set('password', e.target.value)} required minLength={8} />
            </div>

            <div className="divider" />

            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: -4 }}>
              Necesarios para calcular tu plan nutricional
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Edad</label>
                <input type="number" placeholder="25" value={form.age} onChange={e => set('age', e.target.value)} required />
              </div>
              <div className="field">
                <label>Sexo</label>
                <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="male">Hombre</option>
                  <option value="female">Mujer</option>
                </select>
              </div>
              <div className="field">
                <label>Peso (kg)</label>
                <input type="number" placeholder="70" value={form.weight} onChange={e => set('weight', e.target.value)} required />
              </div>
              <div className="field">
                <label>Altura (cm)</label>
                <input type="number" placeholder="175" value={form.height} onChange={e => set('height', e.target.value)} required />
              </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {/* Terms checkbox */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text-2)' }}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--accent)' }}
              />
              <span>
                He leído y acepto los Términos de uso y la{' '}
                <Link to="/privacy" style={{ color: 'var(--accent)' }}>Política de privacidad</Link>
                {' '}de Caliro
              </span>
            </label>

            <button className="btn btn-primary btn-full" type="submit" disabled={loading || !termsAccepted} style={{ marginTop: 4 }}>
              {loading ? <span className="spinner" /> : 'Crear cuenta'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-2)' }}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
