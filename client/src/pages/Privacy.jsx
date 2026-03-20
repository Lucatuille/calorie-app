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
          Caliro · Última actualización: marzo 2026
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

        <Section title="2bis. Base jurídica del tratamiento">
          <p style={{ marginBottom: 10 }}>
            El tratamiento de tus datos personales se realiza con las siguientes bases jurídicas, de acuerdo con el artículo 6 del RGPD:
          </p>
          <p style={{ marginBottom: 6 }}>
            — <strong>Ejecución de un contrato:</strong> el tratamiento de tu email, nombre y datos nutricionales es necesario para prestarte el servicio de seguimiento calórico que aceptas al registrarte.
          </p>
          <p style={{ marginBottom: 10 }}>
            — <strong>Interés legítimo:</strong> el análisis agregado y anónimo del uso de la app para mejorar el servicio.
          </p>
          <p>
            No tomamos decisiones automatizadas con efectos jurídicos o significativos sobre las personas.
          </p>
        </Section>

        <Section title="3. Dónde se almacenan">
          <p style={{ marginBottom: 10 }}>
            Todos los datos se almacenan en servidores de Cloudflare con infraestructura en Europa.
          </p>
          <p>
            El procesamiento de imágenes y textos mediante inteligencia artificial se realiza a través de la API de Anthropic Inc., empresa establecida en Estados Unidos. Esta transferencia internacional está sujeta a las garantías adecuadas previstas en el artículo 46 del RGPD mediante las cláusulas contractuales estándar aprobadas por la Comisión Europea. Las imágenes no se almacenan en servidores de Anthropic una vez procesadas.
          </p>
        </Section>

        <Section title="4. Tus derechos (RGPD)">
          <p style={{ marginBottom: 12 }}>
            Puedes ejercer tus derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición escribiendo a{' '}
            <a href="mailto:contact@caliro.dev" style={{ color: 'var(--accent)' }}>contact@caliro.dev</a>.
            Responderemos a tu solicitud en un plazo máximo de un mes desde su recepción. Si no recibes respuesta o no estás satisfecho con ella, puedes presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) en{' '}
            <a href="https://www.aepd.es" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>aepd.es</a>.
          </p>
          <ul>
            <li><strong>Acceso a tus datos:</strong> escríbenos a <a href="mailto:contact@caliro.dev" style={{ color: 'var(--accent)' }}>contact@caliro.dev</a></li>
            <li><strong>Eliminación de cuenta y datos:</strong> desde Perfil → contacta con soporte</li>
            <li><strong>Portabilidad:</strong> exporta tu historial en CSV desde la sección Perfil</li>
            <li><strong>Rectificación:</strong> puedes editar o eliminar cualquier entrada desde la app</li>
          </ul>
        </Section>

        <Section title="4bis. Plazo de conservación">
          <p style={{ marginBottom: 10 }}>
            Conservamos tus datos personales mientras tu cuenta esté activa. Si eliminas tu cuenta, todos tus datos se borran de nuestros sistemas en un plazo máximo de 30 días, salvo que exista obligación legal de conservarlos.
          </p>
          <p>
            Los datos de uso anónimos y agregados (sin identificación personal) pueden conservarse indefinidamente con fines estadísticos.
          </p>
        </Section>

        <Section title="5. Contacto">
          <p>
            Para cualquier consulta sobre privacidad o protección de datos:{' '}
            <a href="mailto:contact@caliro.dev" style={{ color: 'var(--accent)' }}>contact@caliro.dev</a>
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
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}
