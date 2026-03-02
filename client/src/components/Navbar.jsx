import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/',            label: 'Inicio' },
  { to: '/calculator',  label: 'Registrar' },
  { to: '/progress',    label: 'Progreso' },
  { to: '/profile',     label: 'Perfil' },
];

export default function Navbar() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(247,246,243,0.9)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        maxWidth: 900, margin: '0 auto',
        padding: '0 20px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <span style={{ fontFamily: 'Instrument Serif', fontSize: 20, color: 'var(--accent)' }}>
          kcal
        </span>

        {/* Links */}
        <div style={{ display: 'flex', gap: 4 }}>
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              style={({ isActive }) => ({
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                color: isActive ? 'var(--accent)' : 'var(--text-2)',
                background: isActive ? 'var(--accent-lt)' : 'transparent',
                transition: 'all 0.15s',
              })}
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        {/* User + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{user?.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Salir</button>
        </div>
      </div>
    </nav>
  );
}
