// ============================================================
//  chefTips — pool curado de tips para la pantalla de carga del chef.
//
//  Los planes tardan 3-5s (día) o 8-12s (semana). En vez de mostrar
//  un spinner mudo, inyectamos un tip contextual: transparencia del
//  motor + consejos accionables + honestidad sobre límites.
//
//  Formato: serif italic, 2-3 líneas, 70-130 caracteres. Sujeto "nosotros"
//  o "la IA" + verbo activo + info concreta. Evitamos clase de nutrición
//  abstracta — el tono es editorial, no didáctico.
//
//  Selección: random con memoria corta — no repetimos los últimos 2 tips
//  vistos (localStorage). Así en uso repetido el usuario no ve siempre
//  los mismos primeros tips del pool.
// ============================================================

export const CHEF_TIPS: readonly string[] = [
  // ── Transparencia del motor ────────────────────────────────
  'Priorizamos los platos que ya cocinas. La IA mira tus últimas 20 comidas frecuentes con sus macros reales.',
  'Restamos lo que ya has comido hoy. El plan se ajusta a las kcal que te quedan, no a un total abstracto.',
  'Respetamos tus preferencias dietéticas como reglas duras. Si eres vegetariano, cero carne. Sin excepciones.',
  'Protegemos tu proteína. Ajustamos kcal moviendo carbos y grasa — el piso de proteína se queda intacto.',

  // ── Tips accionables ───────────────────────────────────────
  'Usa el campo de contexto: "tengo pollo", "algo rápido", "estoy en italiano" — todo guía a la IA.',
  'Marca el meal_type correcto al registrar. Si el chef no sabe qué comiste, te vuelve a sugerir desayuno.',
  'Pulsa "Editar" en cualquier plato antes de registrar. Ajustas kcal o macros sin regenerar el plan entero.',

  // ── Honestidad sobre límites ───────────────────────────────
  'La IA a veces calcula mal las kcal de un plato. Si pasa, verás un aviso rojo para que revises antes de registrar.',
  'Los planes son orientativos. Adapta siempre a tu sensación de hambre real y a lo que tengas en la nevera.',
] as const;

const STORAGE_KEY = 'caliro_chef_last_tips';

/**
 * Elige un tip del pool evitando los últimos N vistos.
 * Persiste los vistos en localStorage para continuidad entre sesiones.
 *
 * @param memorySize — cuántos últimos tips evitar (default 2)
 * @returns un tip del pool
 */
export function pickChefTip(memorySize = 2): string {
  // Pool vacío — fallback defensivo
  if (CHEF_TIPS.length === 0) return '';
  if (CHEF_TIPS.length <= memorySize) return CHEF_TIPS[0];

  let lastSeen: string[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) lastSeen = parsed.slice(-memorySize);
    }
  } catch { /* localStorage vacío o corrupto */ }

  // Pool disponible = tips no vistos recientemente
  const available = CHEF_TIPS.filter(t => !lastSeen.includes(t));
  const pool = available.length > 0 ? available : CHEF_TIPS;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  // Guardar el elegido en la memoria (ventana deslizante)
  try {
    const next = [...lastSeen, chosen].slice(-memorySize);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* silent */ }

  return chosen;
}
