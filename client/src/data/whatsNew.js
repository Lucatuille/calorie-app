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

export const CURRENT_VERSION = '1.3.0';

export const RELEASES = [
  {
    version: '1.3.0',
    date: 'Marzo 2026',
    title: 'Lo nuevo en LucaEats',
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
      {
        icon: '🧮',
        title: 'Calculadora TDEE mejorada',
        description: 'Wizard paso a paso con preguntas concretas. Ahora usa la fórmula Mifflin-St Jeor 1990, el estándar clínico más preciso.',
        tag: 'improved',
      },
      {
        icon: '🌙',
        title: 'Modo oscuro',
        description: 'Actívalo desde el navbar. Tu preferencia se guarda automáticamente.',
        tag: 'new',
      },
    ],
  },
  // Las siguientes versiones se añaden aquí encima, siguiendo el mismo formato
];
