import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/',           label: 'Inicio' },
  { to: '/calculator', label: 'Registrar' },
  { to: '/history',    label: 'Historial' },
  { to: '/progress',   label: 'Progreso' },
  { to: '/profile',    label: 'Perfil' },
];

function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'light'
  );
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  return [theme, () => setTheme(t => t === 'dark' ? 'light' : 'dark')];
}

const linkStyle = ({ isActive }) => ({
  padding: '6px 14px',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 500,
  color: isActive ? 'var(--accent)' : 'var(--text-2)',
  background: isActive ? 'var(--accent-lt)' : 'transparent',
  transition: 'all 0.15s',
});

export default function Navbar() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
    setMenuOpen(false);
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'var(--nav-bg)',
      backdropFilter: 'blur(12px)',
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

        {/* Desktop links */}
        <div className="nav-links" style={{ display: 'flex', gap: 4 }}>
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} style={linkStyle}>
              {l.label}
            </NavLink>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="nav-username" style={{ fontSize: 13, color: 'var(--text-3)', marginRight: 4 }}>
            {user?.name}
          </span>

          {/* Theme toggle */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={toggleTheme}
            style={{ fontSize: 15, padding: '6px 8px', lineHeight: 1 }}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? '☀' : '☽'}
          </button>

          {/* Logout — desktop */}
          <button className="btn btn-ghost btn-sm nav-logout" onClick={handleLogout}>
            Salir
          </button>

          {/* Hamburger — mobile */}
          <button
            className="btn btn-ghost btn-sm nav-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            style={{ fontSize: 18, padding: '6px 8px', lineHeight: 1 }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="nav-mobile-menu">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              {l.label}
            </NavLink>
          ))}
          <button onClick={handleLogout}>Salir</button>
        </div>
      )}
    </nav>
  );
}
