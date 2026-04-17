// ============================================================
//  chefTips — contenido de la pantalla de carga del chef.
//
//  En vez de un tip suelto (texto corto poco legible), servimos cartas
//  temáticas de 3 pasos numerados. Cada carta tiene coherencia interna
//  (una idea, 3 expresiones concretas) y el usuario puede leerla en los
//  3-12s que dura una generación.
//
//  Selección: random con memoria corta — guardamos los títulos de las
//  últimas 2 cartas vistas (localStorage) para no repetir en usos seguidos.
// ============================================================

export type ChefTipCard = {
  /** Título de la carta — serif italic, ancla editorial */
  title: string;
  /** 3 pasos cortos, sans en render, cada uno con su número ornamental */
  steps: string[];
};

export const CHEF_TIP_CARDS: readonly ChefTipCard[] = [
  {
    title: 'Cómo ayudar al chef a acertar',
    steps: [
      'Marca el meal_type correcto al registrar. Si el chef no sabe qué comiste, te vuelve a sugerir desayuno.',
      'Usa el campo de contexto: "tengo pollo", "algo rápido", "estoy en italiano" — todo guía la generación.',
      'Pulsa "Editar" antes de registrar. Ajustas kcal o macros de un plato sin regenerar el plan entero.',
    ],
  },
  {
    title: 'Lo que hacemos mientras esperas',
    steps: [
      'Leemos tus 20 comidas más frecuentes con sus macros reales para priorizar lo que ya cocinas.',
      'Calculamos las kcal que te quedan hoy, no un objetivo abstracto del día entero.',
      'Evitamos repeticiones. Ningún plato aparece más de 2 veces en la semana y la proteína principal rota cada día.',
    ],
  },
  {
    title: 'Si algo no cuadra',
    steps: [
      'Aviso amarillo: tu proteína se queda bajo el piso del día (85% del target). Añade una fuente densa.',
      'Aviso rojo: las kcal del plato no encajan con sus ingredientes. Regenera el plan o edita el valor manualmente.',
      'Todo es editable. Cambia nombre, porciones, kcal o macros de cualquier plato antes de registrar.',
    ],
  },
  {
    title: 'Cómo respetamos tus macros',
    steps: [
      'La proteína es un piso, no una media. Buscamos cubrir al menos el 85% de tu target cada día.',
      'Ajustamos kcal moviendo carbos y grasa. La proteína se queda intacta siempre que sea posible.',
      'Preferencias dietéticas como reglas duras: si eres vegetariano, cero carne. Sin excepciones.',
    ],
  },
  {
    title: 'Trucos pequeños pero útiles',
    steps: [
      'Actualiza tus preferencias en Perfil si empiezas a evitar algo nuevo. La IA las respeta como reglas duras.',
      'Registra con foto o texto libre — la IA aprende de cada comida y la añade a tus frecuentes.',
      'Los planes son orientativos. Adapta siempre a tu hambre real y a lo que tengas en la nevera.',
    ],
  },
];

const STORAGE_KEY = 'caliro_chef_last_tip_cards';

/**
 * Elige una carta del pool evitando las últimas vistas.
 * Persiste los títulos vistos en localStorage para continuidad entre sesiones.
 *
 * @param memorySize — cuántas cartas últimas evitar (default 2)
 * @returns una carta del pool
 */
export function pickChefTipCard(memorySize = 2): ChefTipCard {
  if (CHEF_TIP_CARDS.length === 0) {
    return { title: '', steps: [] };
  }
  if (CHEF_TIP_CARDS.length <= memorySize) {
    return CHEF_TIP_CARDS[0];
  }

  let lastSeen: string[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) lastSeen = parsed.slice(-memorySize);
    }
  } catch { /* localStorage vacío o corrupto */ }

  const available = CHEF_TIP_CARDS.filter(c => !lastSeen.includes(c.title));
  const pool = available.length > 0 ? available : CHEF_TIP_CARDS;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  try {
    const next = [...lastSeen, chosen.title].slice(-memorySize);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* silent */ }

  return chosen;
}
