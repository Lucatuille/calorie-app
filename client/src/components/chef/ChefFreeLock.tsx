// ============================================================
//  ChefFreeLock — card de bloqueo para usuarios Free.
//
//  Se muestra en modos Día y Semana cuando el usuario no tiene
//  acceso. Explica el valor y tiene CTA directo a /upgrade.
//
//  Diseño: misma estructura visual que el idle card (surface, radius,
//  icon circular, title serif italic, descripción, CTA) pero con
//  iconografía de candado y color accent-2 más cálido en el icono.
// ============================================================

import { useNavigate } from 'react-router-dom';

type Props = {
  /** 'chat' | 'day' | 'week' — ajusta el texto y beneficios listados */
  feature: 'chat' | 'day' | 'week';
};

const CHEF_INK = 'var(--chef-ink)';

export default function ChefFreeLock({ feature }: Props) {
  const navigate = useNavigate();

  const title =
    feature === 'chat' ? 'Chat con Chef Caliro' :
    feature === 'day'  ? 'Plan del día' :
    'Plan semanal';

  const hook =
    feature === 'chat'
      ? 'Pregúntale al Chef lo que quieras: dudas de macros, comidas rápidas, por qué no bajas de peso…'
      : feature === 'day'
        ? 'Genera 4 comidas ajustadas a tu objetivo del día en segundos.'
        : 'Genera 7 días de comidas ajustadas a tus patrones reales y preferencias.';

  const bullets =
    feature === 'chat'
      ? [
          'Conoce tu peso, macros, comidas frecuentes y preferencias',
          'Explica los números: tendencia, proyecciones, adherencia',
          'Pro: 30 mensajes/día · resumen semanal automático',
        ]
      : feature === 'day'
        ? [
            'Basado en tu objetivo calórico y comidas frecuentes',
            'Respeta tus preferencias y alergias',
            'Pro: 2 planes al día',
          ]
        : [
            'Contexto rico: 14 días de patrones + frecuentes + variedad',
            'Calendario 7 × 4 editable, registro por comida',
            'Pro: 1 plan semanal al día',
          ];

  return (
    <div style={{
      flex: 1,
      background: 'var(--bg)',
      overflowY: 'auto',
      padding: '24px 20px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px 26px',
        maxWidth: 420,
        width: '100%',
        margin: '0 auto',
        textAlign: 'left',
      }}>
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(231,111,81,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {/* Candado minimal */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="var(--accent-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 22,
              color: CHEF_INK,
              margin: 0,
              lineHeight: 1.1,
              fontWeight: 400,
            }}>
              {title}
            </h2>
            <div style={{
              fontSize: 10,
              color: 'var(--accent-2)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginTop: 4,
            }}>
              Función Pro
            </div>
          </div>
        </div>

        {/* Hook */}
        <p style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          margin: '0 0 16px',
        }}>
          {hook}
        </p>

        {/* Separator */}
        <div style={{ height: '0.5px', background: 'var(--border)', marginBottom: 16 }} />

        {/* Bullets */}
        <ul style={{
          listStyle: 'none',
          margin: '0 0 22px',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {bullets.map((b, i) => (
            <li key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              fontSize: 12,
              color: 'var(--text-primary)',
              lineHeight: 1.5,
            }}>
              <span style={{
                flexShrink: 0,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: 'rgba(45,106,79,0.12)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                     stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          type="button"
          onClick={() => navigate('/upgrade')}
          style={{
            width: '100%',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            padding: '13px 24px',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(45,106,79,0.2)',
          }}
        >
          Ver planes Pro
        </button>
      </div>

      <p style={{
        fontSize: 10,
        color: 'var(--text-tertiary)',
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 1.5,
        fontStyle: 'italic',
      }}>
        El Chat de Chef Caliro sigue siendo gratis
      </p>
    </div>
  );
}
