import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <div style={{ marginBottom: 32 }}>
          <Link to="/" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>
            ← Volver
          </Link>
        </div>

        <h1 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 32, fontWeight: 400, marginBottom: 4 }}>
          Política de Privacidad
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 36 }}>
          LucaEats · Última actualización: marzo 2026
        </p>

        <Section title="1. Qué datos recogemos">
          <ul>
            <li>Email y nombre de registro</li>
            <li>Datos de alimentación introducidos por el usuario (calorías, macros, nombres de comidas)</li>
            <li>Peso corporal (opcional, solo si el usuario lo registra)</li>
            <li>Datos de uso de la app (análisis de IA solicitados, funciones utilizadas)</li>
          </ul>
        </Section>

        <Section title="2. Cómo usamos los datos">
          <ul>
            <li>Para proporcionar el servicio de tracking nutricional personal</li>
            <li>Para mejorar la precisión de las estimaciones de IA mediante el sistema de calibración personal</li>
            <li><strong>No vendemos datos a terceros</strong></li>
            <li>No usamos datos para publicidad ni perfilado comercial</li>
          </ul>
        </Section>

        <Section title="3. Dónde se almacenan">
          <p>
            Todos los datos se almacenan en servidores de Cloudflare con infraestructura en Europa.
            El procesamiento de imágenes con IA se realiza a través de la API de Anthropic
            (los datos de imagen no se almacenan en nuestros servidores tras el análisis).
          </p>
        </Section>

        <Section title="4. Tus derechos (RGPD)">
          <ul>
            <li><strong>Acceso a tus datos:</strong> escríbenos a <a href="mailto:lucatuille@icloud.com" style={{ color: 'var(--accent)' }}>lucatuille@icloud.com</a></li>
            <li><strong>Eliminación de cuenta y datos:</strong> desde Perfil → contacta con soporte</li>
            <li><strong>Portabilidad:</strong> exporta tu historial en CSV desde la sección Perfil</li>
            <li><strong>Rectificación:</strong> puedes editar o eliminar cualquier entrada desde la app</li>
          </ul>
        </Section>

        <Section title="5. Contacto">
          <p>
            Para cualquier consulta sobre privacidad o protección de datos:{' '}
            <a href="mailto:lucatuille@icloud.com" style={{ color: 'var(--accent)' }}>lucatuille@icloud.com</a>
          </p>
        </Section>

        <div style={{
          marginTop: 40, padding: '16px 20px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6,
        }}>
          LucaEats es una herramienta de seguimiento personal. No es un dispositivo médico.
          No sustituye el consejo de un médico, nutricionista u otro profesional sanitario.
        </div>

      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}
