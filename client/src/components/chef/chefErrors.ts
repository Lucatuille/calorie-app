// ============================================================
//  chefErrors — traduce errores del backend a mensajes UX claros.
//
//  Los handlers de /planner/* devuelven errores con status + data
//  estructurada. Este helper convierte eso en { title, detail,
//  action } para renderizar estados de error útiles.
// ============================================================

export type ChefError = {
  /** Título corto (serif italic típicamente) */
  title: string;
  /** Descripción que explica qué hacer */
  detail: string;
  /** Etiqueta del botón de reintentar, o null si no aplica */
  retryLabel: string | null;
  /** Severidad visual */
  tone: 'info' | 'warn' | 'error';
};

type RequestError = {
  status?: number;
  message?: string;
  data?: {
    error?: string;
    reason?: 'day_limit' | 'week_limit' | 'blocked' | 'nothing_to_plan';
    limits?: { day?: number; week?: number };
  };
};

function looksLikeNetworkError(err: unknown): boolean {
  const msg = String((err as any)?.message || '').toLowerCase();
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    (err as any)?.name === 'TypeError'
  );
}

/**
 * Traduce un error del backend (o del navegador) a un ChefError UX.
 * @param err  Error lanzado por api.js — tiene .status y .data.
 * @param feature  'day' | 'week' — ajusta texto según qué se estaba generando.
 */
export function describeChefError(err: unknown, feature: 'day' | 'week'): ChefError {
  const featureLabel = feature === 'day' ? 'del día' : 'semanal';

  // Red caída / no conexión
  if (looksLikeNetworkError(err)) {
    return {
      title: 'Sin conexión',
      detail: 'Comprueba tu red e inténtalo de nuevo.',
      retryLabel: 'Reintentar',
      tone: 'warn',
    };
  }

  const e = err as RequestError;
  const status = e?.status;
  const reason = e?.data?.reason;

  // 429 — cuota alcanzada
  if (status === 429) {
    if (reason === 'day_limit') {
      return {
        title: 'Límite diario alcanzado',
        detail: `Has generado todos tus planes ${featureLabel} de hoy. Vuelve mañana.`,
        retryLabel: null,
        tone: 'info',
      };
    }
    if (reason === 'week_limit') {
      return {
        title: 'Límite semanal alcanzado',
        detail: 'Has usado tus planes de esta semana. El contador se reinicia el lunes.',
        retryLabel: null,
        tone: 'info',
      };
    }
    // blocked (Free) — no debería aparecer si mostramos empty state Free,
    // pero por si acaso.
    return {
      title: 'Función Pro',
      detail: `El plan ${featureLabel} es una función Pro.`,
      retryLabel: null,
      tone: 'info',
    };
  }

  // 422 — truncation (max_tokens)
  if (status === 422) {
    return {
      title: 'Plan demasiado largo',
      detail: feature === 'week'
        ? 'El plan generado excedió el límite de tokens. Intenta con menos contexto.'
        : 'Inténtalo otra vez, añade menos contexto o pide "solo cena".',
      retryLabel: 'Reintentar',
      tone: 'warn',
    };
  }

  // 400 — falta setup o nada que planear (domingo completo)
  if (status === 400) {
    if (reason === 'nothing_to_plan') {
      return {
        title: 'Nada que planear',
        detail: 'Ya tienes todas las comidas de hoy registradas y no quedan días en esta semana. Vuelve el próximo lunes.',
        retryLabel: null,
        tone: 'info',
      };
    }
    return {
      title: 'Perfil incompleto',
      detail: e?.data?.error || 'Configura tu objetivo calórico en el perfil primero.',
      retryLabel: null,
      tone: 'warn',
    };
  }

  // 502 — IA caída
  if (status === 502) {
    return {
      title: 'Error con la IA',
      detail: 'La IA no respondió correctamente. Suele funcionar si lo intentas en un momento.',
      retryLabel: 'Reintentar',
      tone: 'error',
    };
  }

  // 500 — genérico servidor
  if (status === 500) {
    return {
      title: 'Algo ha fallado',
      detail: 'Error inesperado del servidor. Si persiste, avísanos.',
      retryLabel: 'Reintentar',
      tone: 'error',
    };
  }

  // Resto (incluye undefined status)
  return {
    title: 'No se pudo generar el plan',
    detail: e?.data?.error || e?.message || 'Inténtalo de nuevo.',
    retryLabel: 'Reintentar',
    tone: 'error',
  };
}

/**
 * Formatea el badge de cuota restante para el header del plan.
 * Devuelve string o null si no aplica (admin ilimitado, Free bloqueado, etc).
 *
 * @param remaining  Número de llamadas restantes en la dimensión relevante.
 * @param period     'hoy' | 'esta semana' — etiqueta del período.
 */
export function formatUsageBadge(
  remaining: number | null | undefined,
  period: 'hoy' | 'esta semana',
): string | null {
  if (remaining === null || remaining === undefined) return null; // ilimitado o no aplica
  if (remaining === 0) return 'Límite alcanzado';
  if (remaining === 1) return `1 restante ${period}`;
  return `${remaining} restantes ${period}`;
}
