import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { isFree } from '../utils/levels';

const FEATURES = [
  { label: 'Foto IA ilimitada',         free: '3/día',    pro: 'Ilimitada' },
  { label: 'Análisis por texto',         free: '3/día',    pro: 'Ilimitado' },
  { label: 'Motor de calibración',       free: false,      pro: true },
  { label: 'Asistente personal',         free: false,      pro: true },
  { label: 'Análisis profundo',          free: false,      pro: true },
  { label: 'Historial completo',         free: true,       pro: true },
  { label: 'Exportar CSV',              free: true,       pro: true },
];

export default function Upgrade() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState(null); // 'monthly' | 'yearly' | null
  const [error, setError]         = useState('');

  async function handleUpgrade(plan) {
    setUpgrading(plan);
    setError('');
    try {
      const priceId = plan === 'yearly'
        ? 'price_1TCSydIDqPCl93zM6fMYoamR'
        : 'price_1TCSy8IDqPCl93zMZmrb0Mzg';
      const { url } = await api.createCheckoutSession(priceId, token);
      window.location.href = url;
    } catch (err) {
      setError(err.message || 'Error al conectar con el servidor de pagos');
      setUpgrading(null);
    }
  }

  // Already Pro — redirect away
  if (!isFree(user?.access_level)) {
    return (
      <div className="page" style={{ paddingTop: 24 }}>
        <button
          onClick={() => navigate('/profile')}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
            padding: 0, marginBottom: 24 }}
        >
          ← Volver
        </button>
        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic',
          fontSize: 28, color: 'var(--text-primary)', marginBottom: 8 }}>
          Ya eres Pro
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
          Tienes acceso completo a todas las funciones.
        </p>
      </div>
    );
  }

  return (
    <div className="page" style={{ paddingTop: 24, paddingBottom: 40 }}>

      {/* Back */}
      <button
        onClick={() => navigate('/profile')}
        style={{ background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
          padding: 0, marginBottom: 28, display: 'flex', alignItems: 'center', gap: 4 }}
      >
        ← Perfil
      </button>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
            background: 'var(--accent)', color: 'white',
            borderRadius: 4, padding: '2px 6px',
            fontFamily: 'var(--font-sans)',
          }}>PRO</span>
        </div>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontStyle: 'italic',
          fontSize: 36, fontWeight: 400,
          color: 'var(--text-primary)',
          lineHeight: 1.1, margin: 0,
        }}>
          La IA que aprende<br />cómo comes tú
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8,
          fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
          Sin límites. Sin anuncios. Sin 10€ al mes.
        </p>
      </div>

      {/* Feature comparison — white card */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 18,
        boxShadow: 'var(--shadow-md)',
        padding: '4px 0',
        marginBottom: 12,
      }}>
        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 72px 72px',
          padding: '10px 16px 8px',
          borderBottom: '0.5px solid var(--border)',
        }}>
          <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.7px',
            fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }} />
          <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px',
            fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
            textAlign: 'center' }}>Free</span>
          <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px',
            fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-sans)',
            textAlign: 'center' }}>Pro</span>
        </div>

        {FEATURES.map((f, i) => (
          <div key={f.label} style={{
            display: 'grid', gridTemplateColumns: '1fr 72px 72px',
            padding: '11px 16px',
            borderBottom: i < FEATURES.length - 1 ? '0.5px solid var(--border)' : 'none',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)' }}>{f.label}</span>
            <span style={{ textAlign: 'center', fontSize: 12,
              color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
              {f.free === false ? <span style={{ color: 'var(--border)', fontSize: 14 }}>—</span>
                : f.free === true ? <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>✓</span>
                : f.free}
            </span>
            <span style={{ textAlign: 'center', fontSize: 12,
              fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
              {f.pro === true
                ? <span style={{ color: 'var(--accent)', fontSize: 15 }}>✓</span>
                : <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{f.pro}</span>}
            </span>
          </div>
        ))}
      </div>

      {/* Pricing — dark card (the one dark element of this screen) */}
      <div style={{
        background: 'linear-gradient(145deg, #1c1c1c, #111111)',
        borderRadius: 18,
        padding: '20px',
        marginBottom: 12,
      }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)',
          fontFamily: 'var(--font-sans)', marginBottom: 16,
          textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
          Precio de fundadores
        </p>

        {error && (
          <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12,
            fontFamily: 'var(--font-sans)' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Monthly */}
          <button
            onClick={() => handleUpgrade('monthly')}
            disabled={upgrading !== null}
            style={{
              flex: 1,
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              padding: '14px 8px',
              cursor: upgrading ? 'not-allowed' : 'pointer',
              opacity: upgrading === 'yearly' ? 0.4 : 1,
              fontFamily: 'var(--font-sans)',
              transition: 'opacity 0.15s',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
              {upgrading === 'monthly' ? '…' : '1,99€'}
            </div>
            <div style={{ fontSize: 10, opacity: 0.8, marginTop: 3 }}>al mes</div>
          </button>

          {/* Yearly */}
          <button
            onClick={() => handleUpgrade('yearly')}
            disabled={upgrading !== null}
            style={{
              flex: 1,
              background: 'transparent',
              color: 'rgba(255,255,255,0.85)',
              border: '0.5px solid rgba(255,255,255,0.15)',
              borderRadius: 12,
              padding: '14px 8px',
              cursor: upgrading ? 'not-allowed' : 'pointer',
              opacity: upgrading === 'monthly' ? 0.4 : 1,
              fontFamily: 'var(--font-sans)',
              transition: 'opacity 0.15s',
              position: 'relative',
            }}
          >
            {/* Best value badge */}
            <span style={{
              position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
              background: 'var(--accent)', color: 'white',
              fontSize: 8, fontWeight: 700, letterSpacing: '0.4px',
              padding: '2px 7px', borderRadius: 99,
              whiteSpace: 'nowrap',
            }}>MEJOR PRECIO</span>
            <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
              {upgrading === 'yearly' ? '…' : '14,99€'}
            </div>
            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 3 }}>al año · 1,25€/mes</div>
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)',
          textAlign: 'center', marginTop: 14, fontFamily: 'var(--font-sans)',
          lineHeight: 1.4 }}>
          Cancela cuando quieras · Sin permanencia
        </p>
      </div>

      {/* Free plan note */}
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center',
        fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
        El plan gratuito incluye 3 análisis de IA al día<br />y acceso completo al seguimiento manual.
      </p>

    </div>
  );
}
