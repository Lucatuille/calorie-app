// ============================================================
//  BOTTOM NAV — visible únicamente en móvil (< 768px)
// ============================================================

import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isPro } from '../utils/levels';
import { api } from '../api';

const IconHome = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
    <path d="M9 21V12h6v9" />
  </svg>
);

const IconPlus = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const IconSparkles = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M5 17l.8 2.2L8 20l-2.2.8L5 23l-.8-2.2L2 20l2.2-.8L5 17z" />
    <path d="M19 3l.6 1.4L21 5l-1.4.6L19 7l-.6-1.4L17 5l1.4-.6L19 3z" />
  </svg>
);

// Chef hat — icon para la tab "Chef"
const IconChef = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 14.5a3.5 3.5 0 0 1-1.5-6.6 3.5 3.5 0 0 1 3.5-3.4 3.5 3.5 0 0 1 8 0 3.5 3.5 0 0 1 3.5 3.4 3.5 3.5 0 0 1-1.5 6.6V19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4.5z" />
    <line x1="9.5" y1="15" x2="9.5" y2="18" />
    <line x1="12" y1="15" x2="12" y2="18" />
    <line x1="14.5" y1="15" x2="14.5" y2="18" />
  </svg>
);

const IconChart = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const IconUser = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const BASE_ITEMS = [
  { to: '/',           label: 'Inicio',     end: true,  Icon: IconHome,     proOnly: false },
  { to: '/calculator', label: 'Registrar',  end: false, Icon: IconPlus,     proOnly: false },
  { to: '/chef',       label: 'Chef',       end: false, Icon: IconChef,     proOnly: true  },
  { to: '/progress',   label: 'Progreso',   end: false, Icon: IconChart,    proOnly: false },
  { to: '/profile',    label: 'Perfil',     end: false, Icon: IconUser,     proOnly: false },
];

// Candado minimal para indicar feature Pro en nav a usuarios Free
const LockDot = () => (
  <svg width="8" height="8" viewBox="0 0 10 10" fill="none"
       style={{ position: 'absolute', top: 4, right: 'calc(50% - 14px)' }}
       aria-hidden="true">
    <rect x="2.5" y="4.5" width="5" height="4" rx="1" fill="currentColor" opacity="0.9" />
    <path d="M3.5 4.5V3a1.5 1.5 0 0 1 3 0v1.5" stroke="currentColor" strokeWidth="1" fill="none" />
  </svg>
);

// Dot verde — señal de digest semanal no leído (solo Pro). Misma posición
// que el LockDot para coherencia visual.
const UnreadDot = () => (
  <span aria-label="Resumen semanal disponible"
        style={{
          position: 'absolute', top: 4, right: 'calc(50% - 14px)',
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--accent)',
        }} />
);

export default function BottomNav() {
  const { user, token } = useAuth();
  const userIsPro = isPro(user?.access_level);
  return (
    <nav className="bottom-nav">
      {BASE_ITEMS.map(({ to, label, end, Icon, proOnly }) => {
        const locked = proOnly && !userIsPro;
        const showUnread = to === '/chef' && userIsPro && !!user?.has_unread_digest;
        const needsRelative = locked || showUnread;
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            data-umami-event={locked ? 'upgrade_cta_nav_chef' : undefined}
            onClick={locked ? () => api.trackUpgradeEvent('upgrade_cta_nav_chef', token) : undefined}
            className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
            style={needsRelative ? { position: 'relative' } : undefined}
          >
            <Icon />
            {locked && <LockDot />}
            {showUnread && <UnreadDot />}
            <span className="bottom-nav__label">{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
