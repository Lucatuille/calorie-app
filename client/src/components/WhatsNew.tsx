const TAG_STYLES = {
  new:      { bg: '#e8f4ee', color: '#2d6a4f', label: 'Nuevo' },
  improved: { bg: '#fff3e0', color: '#e65100', label: 'Mejorado' },
  fix:      { bg: '#fce4ec', color: '#c62828', label: 'Corregido' },
};

function TagBadge({ tag }) {
  const s = TAG_STYLES[tag];
  if (!s) return null;
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 10, fontWeight: 600,
      padding: '2px 7px', borderRadius: 100,
      textTransform: 'uppercase', letterSpacing: '0.3px',
      flexShrink: 0,
    }}>
      {s.label}
    </span>
  );
}

export default function WhatsNew({ release, onDismiss, isClosing }) {
  return (
    <>
      <style>{`
        @keyframes whatsNewIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes whatsNewOut {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to   { opacity: 0; transform: scale(0.95) translateY(10px); }
        }
        .whats-new-modal {
          animation: whatsNewIn 0.25s ease forwards;
        }
        .whats-new-modal.closing {
          animation: whatsNewOut 0.2s ease forwards;
        }
      `}</style>

      {/* Overlay */}
      <div
        onClick={onDismiss}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(2px)',
          zIndex: 9000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}
      >
        {/* Modal */}
        <div
          className={`whats-new-modal${isClosing ? ' closing' : ''}`}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 480,
            maxHeight: '80vh',
            background: 'var(--bg)',
            borderRadius: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header sticky */}
          <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>
                ✨ Novedades · {release.date}
              </span>
              <button
                onClick={onDismiss}
                aria-label="Cerrar novedades"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-3)', fontSize: 18, lineHeight: 1,
                  padding: '2px 6px', borderRadius: 6,
                }}
              >
                ✕
              </button>
            </div>
            <h2 style={{
              fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400,
              color: 'var(--text)', margin: '0 0 4px',
            }}>
              {release.title}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, fontWeight: 300 }}>
              {release.subtitle}
            </p>
          </div>

          {/* Items scrollable */}
          <div style={{ overflowY: 'auto', padding: '0 20px', flex: 1 }}>
            {release.items.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', gap: 12,
                  padding: '14px 0',
                  borderBottom: i < release.items.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14, color: 'var(--text)' }}>{item.title}</strong>
                    {item.tag && <TagBadge tag={item.tag} />}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA sticky */}
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg)',
            flexShrink: 0,
          }}>
            <button
              onClick={onDismiss}
              style={{
                width: '100%',
                background: 'var(--accent)', color: 'white',
                border: 'none', padding: '13px',
                borderRadius: 100, fontSize: 14, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              ¡Entendido, a probarlo! →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
