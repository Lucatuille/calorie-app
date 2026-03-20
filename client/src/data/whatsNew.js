/*
 * CÓMO AÑADIR UNA NUEVA VERSIÓN:
 *
 * 1. Añade un nuevo objeto al INICIO del array RELEASES (más reciente primero)
 * 2. Actualiza CURRENT_VERSION con el nuevo número (ej: '1.4.0')
 * 3. El popup aparecerá automáticamente a todos los usuarios en su próxima visita
 *
 * CUÁNDO SUBIR VERSION:
 * - Patch (1.3.X): bugfixes, mejoras menores → no mostrar What's New
 * - Minor (1.X.0): features nuevas → mostrar What's New
 * - Major (X.0.0): rediseño o cambio grande → mostrar What's New con énfasis
 *
 * TAGS DISPONIBLES:
 * - 'new'      → feature nueva, badge verde
 * - 'improved' → feature mejorada, badge naranja
 * - 'fix'      → bug corregido, badge rojo (usar con moderación)
 *
 * LÍMITE RECOMENDADO: 4-6 items por versión. Si hay más, priorizar los más impactantes.
 */

export const CURRENT_VERSION = '1.4.0';

export const RELEASES = [
  {
    version: '1.4.0',
    date: 'Marzo 2026',
    title: 'Lo nuevo en Caliro',
    subtitle: 'El asistente que analiza tus patrones reales',
    items: [
      {
        icon: '🧠',
        title: 'Asistente de patrones',
        description: 'El asistente ahora analiza tus h\u00e1bitos reales: cu\u00e1nto comes por tipo de comida, si el fin de semana te desv\u00edas, y cu\u00e1l es tu d\u00e9ficit real de prote\u00edna. No solo responde \u2014 detecta patrones.',
        tag: 'new',
      },
      {
        icon: '\uD83D\uDCC5',
        title: 'Resumen semanal',
        description: 'Cada lunes aparece una tarjeta con 3 insights concretos y accionables sobre tu semana. Qu\u00e9 funcion\u00f3, qu\u00e9 no, y qu\u00e9 cambiar.',
        tag: 'new',
      },
      {
        icon: '\uD83C\uDFAF',
        title: 'Calibraci\u00f3n en el asistente',
        description: 'El asistente ahora conoce tu motor de calibraci\u00f3n: si tiendes a subestimar pasta o arroz, lo menciona cuando es relevante.',
        tag: 'improved',
      },
      {
        icon: '\u26A1',
        title: 'Respuestas m\u00e1s precisas',
        description: 'El asistente detecta autom\u00e1ticamente si tu pregunta requiere an\u00e1lisis profundo o respuesta r\u00e1pida, y elige el modelo adecuado.',
        tag: 'improved',
      },
    ],
  },
  {
    version: '1.3.0',
    date: 'Marzo 2026',
    title: 'Lo nuevo en Caliro',
    subtitle: 'La app que aprende cómo comes tú',
    items: [
      {
        icon: '▦',
        title: 'Escáner de código de barras',
        description: 'Escanea cualquier producto del supermercado y obtén sus macros al instante. Los productos escaneados se guardan para la próxima vez.',
        tag: 'new',
      },
      {
        icon: '✏️',
        title: 'Describe tu comida con texto',
        description: 'Escribe "pollo con arroz y ensalada" o "menú del día de restaurante" y la IA calcula los macros sola. Sin fotos, sin escáner.',
        tag: 'new',
      },
      {
        icon: '🎯',
        title: 'IA que aprende de ti',
        description: 'Cada corrección que haces mejora las estimaciones futuras. Después de 5 usos, la app ya conoce tus raciones reales.',
        tag: 'new',
      },
      {
        icon: '💊',
        title: 'Seguimiento de suplementos',
        description: 'Marca tus suplementos del día con un toque desde el dashboard. Creatina, Omega 3, Vitamina D — todo en un vistazo.',
        tag: 'new',
      },
      {
        icon: '📊',
        title: 'Análisis avanzado con proyección',
        description: 'Abre el análisis detallado en Progreso para ver tu proyección de peso basada en tu déficit real y adherencia.',
        tag: 'new',
      },
    ],
  },
  // Las siguientes versiones se añaden aquí encima, siguiendo el mismo formato
];
