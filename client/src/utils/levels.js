export const LEVEL_CONFIG = {
  0:  { name: 'Waitlist', badge: null,          ai_limit: 0,    can_access: false },
  1:  { name: 'Beta',     badge: '🌱 Beta',     ai_limit: 15,   can_access: true  },
  2:  { name: 'Pro',      badge: '∞ Pro',        ai_limit: 30,   can_access: true  },
  3:  { name: 'Free',     badge: null,           ai_limit: 3,    can_access: true  },
  99: { name: 'Admin',    badge: '👑 Admin',     ai_limit: null, can_access: true  },
};

// null = ilimitado, número = límite diario
// IMPORTANTE: no usar .ai_limit ?? N directamente — null es valor válido (ilimitado).
export function getAiLimit(access_level) {
  const config = LEVEL_CONFIG[access_level];
  if (!config) return 3;
  return config.ai_limit;
}

export function getBadgeStyle(level) {
  switch (level) {
    case 99: return { background: '#1a1a1a', color: '#ffffff' };
    case 1:  return { background: '#1e3a2f', color: '#a8d5b5' };
    case 2:  return { background: '#1a1a2e', color: '#c9b8ff' };
    default: return null;
  }
}
