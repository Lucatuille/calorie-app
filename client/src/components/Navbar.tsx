import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isPro } from '../utils/levels';
import { api } from '../api';

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
  padding: '4px 2px',
  fontSize: 14,
  fontWeight: isActive ? 500 : 400,
  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
  textDecoration: 'none',
  transition: 'color 0.15s',
});

export default function Navbar({ onHelpOpen }: { onHelpOpen?: () => void }) {
  const { logout, user, token } = useAuth();
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
      borderBottom: '0.5px solid var(--border)',
    }}>
      <div style={{
        maxWidth: 900, margin: '0 auto',
        padding: '0 24px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <span style={{
          fontSize: 13, color: 'var(--text-primary)',
          fontWeight: 400, letterSpacing: '2px',
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
        }}>
          Caliro
        </span>

        {/* Desktop links */}
        <div className="nav-links" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} style={linkStyle}>
              {l.label}
            </NavLink>
          ))}
          <NavLink
            to="/chef"
            onClick={!isPro(user?.access_level)
              ? () => api.trackUpgradeEvent('free_chef_nav_click', token)
              : undefined}
            style={({ isActive }) => ({
              ...linkStyle({ isActive }),
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            })}
          >
            Chef
            {!isPro(user?.access_level) && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
                   style={{ opacity: 0.55 }}>
                <rect x="2.5" y="4.5" width="5" height="4" rx="1" fill="currentColor" />
                <path d="M3.5 4.5V3a1.5 1.5 0 0 1 3 0v1.5" stroke="currentColor" strokeWidth="1" fill="none" />
              </svg>
            )}
          </NavLink>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="nav-username" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {user?.name}
          </span>

          {/* Help */}
          {onHelpOpen && (
            <button
              onClick={onHelpOpen}
              aria-label="Abrir guía de Caliro"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, color: 'var(--text-secondary)', padding: '4px',
                lineHeight: 1,
              }}
            >?</button>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, color: 'var(--text-secondary)', padding: '4px',
              lineHeight: 1,
            }}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? '☀' : '☽'}
          </button>

          {/* Logout — desktop */}
          <button
            className="nav-logout"
            onClick={handleLogout}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: 'var(--text-secondary)', padding: '4px',
            }}
          >
            Salir
          </button>

          {/* Hamburger — mobile */}
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 18, color: 'var(--text-primary)', padding: '4px', lineHeight: 1,
            }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile dropdown — solo items secundarios (nav principal está en BottomNav) */}
      {menuOpen && (
        <div className="nav-mobile-menu">
          <button onClick={handleLogout}>Salir</button>
        </div>
      )}
    </nav>
  );
}
