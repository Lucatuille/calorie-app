import { usePageTitle } from '../hooks/usePageTitle';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { isFree } from '../utils/levels';
import { isNative } from '../utils/platform';

// Solo diferenciadores Pro. Historial y CSV se omiten (ambos niveles los
// tienen) — las filas "✓ / ✓" diluyen el argumento Pro. Nombres en clave
// benefit, no feature: "Aprende tus porciones" vs "Motor de calibración".
const FEATURES = [
  { label: 'Foto IA',                    free: '3/día',  pro: 'Ilimitada' },
  { label: 'Aprende tus porciones',      free: false,    pro: true },
  { label: 'Coach con tu historial',     free: false,    pro: true },
  { label: 'Tendencias y proyecciones',  free: false,    pro: true },
];

export default function Upgrade() {
  usePageTitle('Pro');
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState(null); // 'monthly' | 'yearly' | null
  const [error, setError]         = useState('');

  // Track llegada a /upgrade (funnel de conversión). Enviamos el event con
  // el nombre canónico del whitelist backend: upgrade_page_view.
  useEffect(() => {
    if (token && isFree(user?.access_level)) {
      api.trackUpgradeEvent('upgrade_page_view', token);
    }
  }, [token, user?.access_level]);

  async function handleUpgrade(plan) {
    setUpgrading(plan);
    setError('');
    api.trackUpgradeEvent(`checkout_start_${plan}`, token);
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

  // TODO(capacitor-mac-sprint): Implementar IAP con RevenueCat aquí.
  //   - Reemplazar createCheckoutSession por Purchases.purchasePackage()
  //   - Configurar productos en App Store Connect (mensual + anual)
  //   - Conectar webhook RevenueCat → worker → actualiza access_level=2 en D1
  //   - Quitar este bloque condicional cuando IAP esté listo
  // Por ahora: en iOS NO se vende Pro, mostramos pantalla "Próximamente".
  if (isNative() && isFree(user?.access_level)) {
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
          Caliro Pro
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', lineHeight: 1.6 }}>
          Las suscripciones en iOS llegarán muy pronto.<br />
          Mientras tanto, sigue usando Caliro gratis sin límites de tiempo.
        </p>
      </div>
    );
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
          Sin límites. Sin anuncios. Sin 8,99€ al mes de MyFitnessPal.
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

      {/* Pricing — dark card. El único bloque dark de la página. Contiene:
          eyebrow + CTAs con verbo + risk reversal visible + anchoring inline
          con competencia (sustituye a la tabla aparte que tenía antes). */}
      <div style={{
        background: 'linear-gradient(145deg, #1c1c1c, #111111)',
        borderRadius: 18,
        padding: '20px',
        marginBottom: 14,
      }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)',
          fontFamily: 'var(--font-sans)', marginBottom: 22,
          textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
          Precio especial de lanzamiento
        </p>

        {error && (
          <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12,
            fontFamily: 'var(--font-sans)' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {/* Yearly — prominente con verbo + precio + ahorro absoluto */}
          <button
            data-umami-event="checkout_start_yearly"
            onClick={() => handleUpgrade('yearly')}
            disabled={upgrading !== null}
            style={{
              flex: 1,
              background: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              padding: '18px 10px 14px',
              cursor: upgrading ? 'not-allowed' : 'pointer',
              opacity: upgrading === 'monthly' ? 0.4 : 1,
              fontFamily: 'var(--font-sans)',
              transition: 'opacity 0.15s',
              position: 'relative',
            }}
          >
            {/* Badge ahorro — legible (11px en vez de 8px), muestra importe absoluto
                (más persuasivo que el porcentaje para la mayoría de la gente). */}
            <span style={{
              position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
              background: 'white', color: '#15803d',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
              padding: '3px 10px', borderRadius: 99,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}>AHORRAS 8,89€</span>
            <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.1, marginBottom: 4 }}>
              {upgrading === 'yearly' ? 'Redirigiendo…' : 'Empezar Pro'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.01em' }}>
              14,99€<span style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}> /año</span>
            </div>
            <div style={{ fontSize: 10, opacity: 0.78, marginTop: 4 }}>1,25€ al mes</div>
          </button>

          {/* Monthly — secundario con mejor contraste (rgba transparent sobre dark
              en vez de #1a1a1a quasi-idéntico al fondo). */}
          <button
            data-umami-event="checkout_start_monthly"
            onClick={() => handleUpgrade('monthly')}
            disabled={upgrading !== null}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: 12,
              padding: '18px 10px 14px',
              cursor: upgrading ? 'not-allowed' : 'pointer',
              opacity: upgrading === 'yearly' ? 0.4 : 1,
              fontFamily: 'var(--font-sans)',
              transition: 'opacity 0.15s, background 0.15s',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.1, marginBottom: 4 }}>
              {upgrading === 'monthly' ? 'Redirigiendo…' : 'Probar un mes'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.01em' }}>
              1,99€<span style={{ fontSize: 11, fontWeight: 400, opacity: 0.65 }}> /mes</span>
            </div>
            <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>Sin compromiso</div>
          </button>
        </div>

        {/* Risk reversal — la frase más importante para vencer el "¿y si me
            arrepiento?". Visible (13px, weight 500) bajo los CTAs. */}
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)',
          textAlign: 'center', marginTop: 16, fontFamily: 'var(--font-sans)',
          lineHeight: 1.4, fontWeight: 500 }}>
          Cancela en 1 tap · Sin permanencia · Activo al instante
        </p>

        {/* Anchoring inline: competencia como referencia al lado del precio Caliro.
            Sustituye a la tabla aparte "Comparado con la competencia" — el user
            necesita la referencia MIENTRAS decide, no después. */}
        <div style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: '0.5px solid rgba(255,255,255,0.1)',
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.6,
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span style={{
            display: 'block',
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.35)',
            marginBottom: 4,
          }}>
            Referencia
          </span>
          MyFitnessPal 8,99€/mes · Yazio 3,99€/mes · Lifesum 4,99€/mes
        </div>
      </div>

      {/* Free plan note — tono cálido, fallback honesto. No empuja, informa. */}
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center',
        fontFamily: 'var(--font-sans)', lineHeight: 1.5, fontStyle: 'italic' }}>
        Si aún no es el momento, Free tiene lo esencial —<br />siempre gratis, sin tarjeta.
      </p>

    </div>
  );
}
