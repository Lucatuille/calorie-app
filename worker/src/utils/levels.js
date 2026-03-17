// ============================================================
//  ACCESS LEVELS — definición canónica
// ============================================================

export const ACCESS_LEVELS = {
  WAITLIST: 0,
  FOUNDER:  1,
  PRO:      2,
  FREE:     3,
  ADMIN:    99,
};

export const LEVEL_CONFIG = {
  0:  { name: 'Waitlist', badge: null,          ai_limit: 0,    can_access: false },
  1:  { name: 'Beta',     badge: '🌱 Beta',     ai_limit: 15,   can_access: true  },
  2:  { name: 'Pro',      badge: '∞ Pro',        ai_limit: 30,   can_access: true  },
  3:  { name: 'Free',     badge: null,           ai_limit: 3,    can_access: true  },
  99: { name: 'Admin',    badge: '👑 Admin',     ai_limit: null, can_access: true  },
};

// null = ilimitado, número = límite diario
// IMPORTANTE: usar esta función en vez de acceder .ai_limit directamente.
// El operador ?? no sirve aquí porque null es un valor válido (ilimitado).
export function getAiLimit(access_level) {
  const config = LEVEL_CONFIG[access_level];
  if (!config) return 3;          // nivel desconocido → límite Free
  return config.ai_limit;         // null = ilimitado, número = límite diario
}

export function canAccess(access_level) {
  return LEVEL_CONFIG[access_level]?.can_access ?? false;
}
