import { useAuth } from '../context/AuthContext';

export default function WaitlistScreen() {
  const { user, logout } = useAuth();

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>

        <div style={{ fontFamily: 'Instrument Serif', fontSize: 40, color: 'var(--accent)', marginBottom: 32 }}>
          LucaEats
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '32px 28px',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>

          <h1 style={{
            fontFamily: 'Instrument Serif, serif', fontSize: 24,
            fontWeight: 400, color: 'var(--text)', marginBottom: 12,
          }}>
            Estás en lista de espera
          </h1>

          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 24 }}>
            Tu cuenta está registrada. En cuanto tengamos un hueco, te daremos acceso completo a la app.
          </p>

          <div style={{
            borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
            padding: '16px 0', margin: '0 0 24px',
          }}>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>
              Te avisaremos en:
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              {user?.email}
            </p>
          </div>

          <button
            onClick={logout}
            style={{
              width: '100%', background: 'none',
              border: '1px solid var(--border)', color: 'var(--text-2)',
              padding: '12px', borderRadius: 12, fontSize: 14,
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Cerrar sesión
          </button>
        </div>

      </div>
    </div>
  );
}
