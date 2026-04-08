import { openExternal } from '../utils/platform';

export default function Privacy() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <div style={{ marginBottom: 32 }}>
          <a href="/" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>
            ← Volver
          </a>
        </div>

        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 400, marginBottom: 4 }}>
          Política de Privacidad
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 36 }}>
          Caliro · Última actualización: abril 2026
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

        <Section title="3bis. Servicios de terceros utilizados">
          <p style={{ marginBottom: 10 }}>
            Para garantizar el funcionamiento y la calidad del servicio utilizamos los siguientes proveedores:
          </p>
          <ul>
            <li><strong>Cloudflare</strong> (alojamiento, base de datos D1, almacenamiento R2 de copias de seguridad) — UE</li>
            <li><strong>Anthropic</strong> (procesamiento de IA para análisis de comidas y asistente nutricional) — EE.UU.</li>
            <li><strong>Stripe</strong> (procesamiento de pagos para suscripciones Pro) — EE.UU./UE</li>
            <li><strong>Resend</strong> (envío de emails transaccionales: bienvenida, recuperación de contraseña) — UE</li>
            <li><strong>Sentry</strong> (registro de errores técnicos para detectar fallos; puede incluir tu email asociado al error con fines de soporte) — UE</li>
            <li><strong>Umami Cloud</strong> (analítica web sin cookies y sin seguimiento personal entre sitios) — UE</li>
          </ul>
        </Section>

        <Section title="3ter. Estimaciones generadas por IA">
          <p style={{ marginBottom: 10 }}>
            Las estimaciones calóricas y nutricionales generadas por la inteligencia artificial son <strong>aproximadas</strong> y pueden tener un margen de error de aproximadamente <strong>±150-200 kcal</strong> por comida, especialmente en platos preparados o con ingredientes ocultos (aceites, salsas).
          </p>
          <p>
            Caliro no garantiza la exactitud de los valores nutricionales proporcionados. Estas estimaciones <strong>no constituyen consejo médico ni nutricional profesional</strong> y no deben utilizarse para tomar decisiones críticas de salud. Si tienes condiciones médicas o necesitas precisión clínica, consulta con un profesional sanitario cualificado.
          </p>
        </Section>

        <Section title="4. Tus derechos (RGPD)">
          <p style={{ marginBottom: 12 }}>
            Puedes ejercer tus derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición escribiendo a{' '}
            <a href="mailto:contacto@caliro.dev" style={{ color: 'var(--accent)' }}>contacto@caliro.dev</a>.
            Responderemos a tu solicitud en un plazo máximo de un mes desde su recepción. Si no recibes respuesta o no estás satisfecho con ella, puedes presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) en{' '}
            <a
              href="https://www.aepd.es"
              target="_blank"
              rel="noreferrer"
              onClick={(e) => { e.preventDefault(); openExternal('https://www.aepd.es'); }}
              style={{ color: 'var(--accent)' }}
            >aepd.es</a>.
          </p>
          <ul>
            <li><strong>Acceso a tus datos:</strong> descarga todos tus datos en formato JSON desde Perfil → "Exportar mis datos"</li>
            <li><strong>Eliminación de cuenta y datos:</strong> desde Perfil → "Eliminar mi cuenta" (al fondo de la página). El borrado es inmediato y permanente.</li>
            <li><strong>Portabilidad:</strong> exporta tu historial en CSV o JSON desde Perfil</li>
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
