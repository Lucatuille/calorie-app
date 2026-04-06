import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);

  if (!token) {
    navigate('/login', { replace: true });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword({ token, newPassword: password });
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err: any) {
      setError(err.data?.error || err.message || 'Error al restablecer la contraseña');
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
      <div className="fade-up" style={{ width: '100%', maxWidth: 400 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 36, color: 'var(--accent)', marginBottom: 8 }}>
            Caliro
          </div>
          <h1 className="title-lg" style={{ marginBottom: 6 }}>Nueva contraseña</h1>
          <p className="body-sm">Introduce tu nueva contraseña</p>
        </div>

        <div className="card card-padded-lg card-bordered-lg">
          {success ? (
            <div style={{
              padding: '16px', textAlign: 'center',
              background: 'rgba(16,185,129,0.08)', borderRadius: 'var(--radius-sm)',
              fontSize: 14, color: 'var(--accent)', lineHeight: 1.5,
            }}>
              Contraseña actualizada. Redirigiendo al login…
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="field">
                <label>Nueva contraseña</label>
                <input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div className="field">
                <label>Confirmar contraseña</label>
                <input
                  type="password"
                  placeholder="Repite la contraseña"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  minLength={8}
                  required
                />
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Restablecer contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
