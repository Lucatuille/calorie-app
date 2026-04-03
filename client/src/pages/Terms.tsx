import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <div style={{ marginBottom: 32 }}>
          <Link to="/" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>
            ← Volver
          </Link>
        </div>

        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 400, marginBottom: 4 }}>
          Términos de Uso
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 36 }}>
          Caliro · Última actualización: marzo 2026
        </p>

        <Section title="1. Descripción del servicio">
          <p>
            Caliro es una aplicación web de seguimiento nutricional personal que utiliza inteligencia
            artificial para estimar el contenido calórico de alimentos a partir de fotos y descripciones de texto.
          </p>
        </Section>

        <Section title="2. Uso aceptable">
          <ul>
            <li>El servicio está destinado a uso personal, no comercial</li>
            <li>No está permitido el uso automatizado, scraping ni acceso masivo a la API</li>
            <li>No está permitido compartir credenciales de acceso con terceros</li>
          </ul>
        </Section>

        <Section title="3. Limitaciones de responsabilidad">
          <p style={{ marginBottom: 10 }}>
            Las estimaciones calóricas generadas por la IA son aproximaciones y pueden contener errores.
            Caliro no garantiza la exactitud de los valores nutricionales proporcionados.
          </p>
          <p>
            Caliro no se hace responsable de decisiones dietéticas o de salud tomadas basándose
            exclusivamente en los datos de la aplicación.
          </p>
        </Section>

        <Section title="4. Cuentas y suscripciones">
          <ul>
            <li>Las suscripciones Pro se facturan mensualmente y pueden cancelarse en cualquier momento</li>
            <li>No se realizan reembolsos por períodos parciales salvo obligación legal</li>
            <li>Nos reservamos el derecho a suspender cuentas que incumplan estos términos</li>
          </ul>
        </Section>

        <Section title="5. Propiedad intelectual">
          <p>
            El software, diseño y contenidos de Caliro son propiedad de sus desarrolladores.
            Los datos introducidos por el usuario pertenecen al usuario.
          </p>
        </Section>

        <Section title="6. Modificaciones">
          <p>
            Podemos actualizar estos términos en cualquier momento. Los cambios significativos
            se comunicarán por email o mediante aviso en la aplicación.
          </p>
        </Section>

        <Section title="7. Contacto">
          <p>
            Para cualquier consulta sobre estos términos:{' '}
            <a href="mailto:contacto@caliro.dev" style={{ color: 'var(--accent)' }}>contacto@caliro.dev</a>
          </p>
        </Section>

        <div style={{
          marginTop: 40, padding: '16px 20px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6,
        }}>
          Caliro es una herramienta de seguimiento personal. No es un dispositivo médico.
          No sustituye el consejo de un médico, nutricionista u otro profesional sanitario.
        </div>

      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}
