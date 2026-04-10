// ── Mensajes de bienvenida del asistente ───────────────────
// Sin llamadas a la API — todo calculado en el cliente.

export function buildWelcomeMessage(userName, todayData, targetCalories, targetProtein) {
  const day    = new Date().getDay();
  const saludo = getSaludo(day, userName);
  const cierre = getCierre(day);

  // Sin objetivo configurado → fallback suave
  if (!targetCalories || targetCalories <= 0) {
    return `${saludo} Configura tu objetivo calórico en Perfil para ver tus datos aquí.\n${cierre}`;
  }

  const estado = getEstadoCalorico(todayData, targetCalories, targetProtein);
  return `${saludo} ${estado}\n${cierre}`;
}

function getSaludo(day, name) {
  const saludos = {
    0: `¡Domingo, ${name}! 🌅`,
    1: `Nueva semana, ${name}.`,
    2: `¡Hola ${name}!`,
    3: `Mitad de semana, ${name}.`,
    4: `¡Casi viernes, ${name}!`,
    5: `¡Por fin viernes, ${name}!`,
    6: `¡Sábado, ${name}!`,
  };
  return saludos[day];
}

export function getEstadoCalorico(todayData, targetCalories, targetProtein) {
  const { todayCalories = 0, todayProtein = 0 } = todayData;
  const remaining        = targetCalories - todayCalories;
  const remainingProtein = (targetProtein && targetProtein > 0)
    ? Math.round(targetProtein - todayProtein)
    : null;
  const pct = todayCalories / targetCalories;
  const excess = todayCalories - targetCalories;

  // Tolerancia adaptativa: ±250 kcal o ±12% del objetivo, lo que sea mayor
  // Ej: target 2100 → tolerancia 252 kcal; target 1400 → tolerancia 250 kcal
  const tolerance = Math.max(250, targetCalories * 0.12);

  const fmt = (n) => Math.round(n).toLocaleString('es');

  // ESTADO 1 — Sin registros
  if (todayCalories === 0) {
    return `Todavía no has registrado nada hoy. Tienes ${fmt(targetCalories)} kcal para trabajar.`;
  }

  // ESTADO 2 — Inicio del día, bien encaminado (< 70%)
  if (pct < 0.70) {
    const proteinText = (remainingProtein && remainingProtein > 0)
      ? ` y ${remainingProtein}g de proteína`
      : '';
    return `Llevas ${fmt(todayCalories)} kcal — te quedan ${fmt(remaining)} kcal${proteinText} para hoy.`;
  }

  // ESTADO 3 — Cerca del objetivo, ve pensando en la cena (70-95%)
  if (pct < 0.95) {
    const proteinText = (remainingProtein && remainingProtein > 0)
      ? ` Aún te faltan ${remainingProtein}g de proteína.`
      : '';
    return `Llevas ${fmt(todayCalories)} kcal, cerca del objetivo. Quedan ${fmt(remaining)} kcal — ve pensando en la cena.${proteinText}`;
  }

  // ESTADO 4 — En objetivo (dentro de la tolerancia adaptativa)
  if (excess <= tolerance) {
    if (pct <= 1.05) {
      return `${fmt(todayCalories)} kcal hoy — prácticamente en el objetivo. 🎯`;
    }
    return `${fmt(todayCalories)} kcal hoy — ${fmt(excess)} por encima pero dentro de rango. Buen día.`;
  }

  // ESTADO 5 — Superado moderadamente (tolerancia < exceso <= tolerancia * 1.8)
  if (excess <= tolerance * 1.8) {
    return `Llevas ${fmt(todayCalories)} kcal, ${fmt(excess)} por encima del objetivo. No pasa nada — la semana se valora en conjunto.`;
  }

  // ESTADO 6 — Superado bastante
  return `${fmt(todayCalories)} kcal hoy, ${fmt(excess)} sobre el objetivo. Días así pasan. ¿Quieres que miremos la semana completa?`;
}

function getCierre(day) {
  const cierres = {
    0: `¿Hoy también cuidamos la alimentación?`,
    1: `Buen momento para empezar fuerte. ¿Qué necesitas?`,
    2: `¿En qué te ayudo hoy?`,
    3: `¿Cómo lo llevas?`,
    4: `¿Revisamos algo?`,
    5: `El finde se acerca — ¿alguna duda antes?`,
    6: `Los fines de semana también cuentan 😄`,
  };
  return cierres[day];
}
