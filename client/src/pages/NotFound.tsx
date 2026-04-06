export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 72,
          color: 'var(--text-tertiary)', lineHeight: 1, marginBottom: 8,
        }}>
          404
        </div>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontStyle: 'italic',
          fontSize: 24, fontWeight: 400,
          color: 'var(--text-primary)', marginBottom: 8,
        }}>
          Página no encontrada
        </h1>
        <p style={{
          fontSize: 13, color: 'var(--text-secondary)',
          fontFamily: 'var(--font-sans)', lineHeight: 1.5,
          marginBottom: 24,
        }}>
          La página que buscas no existe o ha sido movida.
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            background: 'var(--text-primary)', color: 'var(--bg)',
            padding: '10px 24px', borderRadius: 'var(--radius-sm)',
            fontSize: 14, fontWeight: 500, textDecoration: 'none',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Volver al inicio
        </a>
      </div>
    </div>
  );
}
