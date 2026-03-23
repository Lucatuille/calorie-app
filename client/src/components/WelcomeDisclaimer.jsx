import { useEffect, useState } from 'react';

export default function WelcomeDisclaimer({ onAccept }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Slight delay so the fade-in is visible
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.4s ease',
    }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>

        {/* Logo */}
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 40, color: 'var(--accent)',
          marginBottom: 6, lineHeight: 1,
        }}>
          kcal
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 32 }}>Caliro</p>

        {/* Title */}
        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 28, fontWeight: 400,
          marginBottom: 8, lineHeight: 1.2,
        }}>
          Bienvenido a Caliro
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 32 }}>
          Tu compañero de seguimiento nutricional personal.
        </p>

        {/* Divider */}
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: 24 }} />

        {/* Disclaimer */}
        <p style={{
          fontSize: 13, color: 'var(--text-3)',
          lineHeight: 1.6, marginBottom: 32,
        }}>
          Caliro es una herramienta de tracking personal.
          No sustituye el consejo de un médico o nutricionista.
          <br /><br />
          Si tienes alguna condición médica o buscas orientación
          clínica, consulta siempre con un profesional de la salud.
        </p>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: 28 }} />

        {/* CTA */}
        <button
          className="btn btn-primary btn-full"
          onClick={onAccept}
          style={{ fontSize: 15, padding: '13px 0' }}
        >
          Empezar →
        </button>
      </div>
    </div>
  );
}
