// ============================================================
//  ChefLoadingCard — pantalla de carga editorial del chef.
//
//  Reemplaza al stateWrapper + tip suelto anterior. Muestra:
//    [spinner]                   <- 28px, centrado
//    Preparando tu plan…         <- serif italic, título
//    MIENTRAS ESPERAS            <- caption small-caps micro-spaced
//    ─────                       <- hairline separator
//    [Título de la carta]        <- serif italic 17px, centrado
//    1  [paso]                   <- números serif verde ornamentales
//    2  [paso]                      + cuerpo sans 13px text-primary
//    3  [paso]                      (más legible que italic largo)
//
//  Pool de cartas y selección en chefTips.ts.
// ============================================================

import type { ReactElement } from 'react';
import type { ChefTipCard } from './chefTips';

const CHEF_INK = 'var(--chef-ink)';
const CHEF_BG  = 'var(--bg)';

export function renderLoadingCard({
  title,
  card,
}: {
  title: string;
  card: ChefTipCard | null;
}): ReactElement {
  return (
    <div style={{
      flex: 1,
      background: CHEF_BG,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px 28px 28px',
        width: '100%',
        maxWidth: 380,
      }}>
        {/* Spinner + título centrado */}
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{
            width: 28,
            height: 28,
            margin: '0 auto 14px',
          }} />
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 17,
            color: CHEF_INK,
            margin: '0 0 6px',
            lineHeight: 1.2,
            fontWeight: 400,
          }}>
            {title}
          </p>
          <p style={{
            fontSize: 9,
            color: 'var(--text-tertiary)',
            margin: 0,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            Mientras esperas
          </p>
        </div>

        {/* Separator */}
        <div style={{
          height: 0,
          borderTop: '0.5px solid var(--border)',
          margin: '22px 0 20px',
        }} />

        {/* Card con título + 3 pasos numerados */}
        {card && card.steps.length > 0 && (
          <>
            <h3 style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 17,
              color: CHEF_INK,
              lineHeight: 1.25,
              margin: '0 0 18px',
              fontWeight: 400,
              textAlign: 'center',
            }}>
              {card.title}
            </h3>

            <ol style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
            }}>
              {card.steps.map((step, i) => (
                <li key={i} style={{
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  marginBottom: i < card.steps.length - 1 ? 14 : 0,
                }}>
                  <span style={{
                    flex: '0 0 auto',
                    fontFamily: 'var(--font-serif)',
                    fontStyle: 'italic',
                    fontSize: 20,
                    color: 'var(--accent)',
                    lineHeight: 1.15,
                    fontVariantNumeric: 'tabular-nums',
                    width: 14,
                    textAlign: 'left',
                    marginTop: -1,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{
                    flex: 1,
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.005em',
                  }}>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
