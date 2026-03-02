import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function CalProgress({ consumed, target }) {
  if (!target) return null;
  const pct = Math.min((consumed / target) * 100, 100);
  const over = consumed > target;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
        <span>{consumed.toLocaleString()} kcal</span>
        <span>Objetivo: {target.toLocaleString()}</span>
      </div>
      <div className="progress-track">
        <div className={`progress-fill ${over ? 'over' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 12 }}>
        {over
          ? <span style={{ color: 'var(--accent-2)', fontWeight: 600 }}>+{(consumed - target).toLocaleString()} kcal sobre el objetivo</span>
          : <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{(target - consumed).toLocaleString()} kcal restantes</span>
        }
      </div>
    </div>
  );
}

const MACROS = [
  { key: 'protein', label: 'Proteína', color: '#2d6a4f', bg: '#e8f5ee' },
  { key: 'carbs',   label: 'Carbos',   color: '#b45309', bg: '#fef3c7' },
  { key: 'fat',     label: 'Grasa',    color: '#1d4ed8', bg: '#eff6ff' },
];

const ACTIONS = [
  { to: '/calculator',       icon: '＋', label: 'Registrar día',   desc: 'Calorías y macros',      accent: '#d8f3dc', iconColor: '#2d6a4f' },
  { to: '/progress',         icon: '↗',  label: 'Ver progreso',    desc: 'Gráficos y tendencias',   accent: '#e0eaff', iconColor: '#3b5bdb' },
  { to: '/calculator#tdee',  icon: '⚡', label: 'Calcular TDEE',  desc: 'Tu objetivo calórico',    accent: '#fff3cd', iconColor: '#b45309' },
  { to: '/profile',          icon: '◎',  label: 'Mi perfil',       desc: 'Datos y objetivo',        accent: '#fde8e2', iconColor: '#e76f51' },
];

export default function Dashboard() {
  const { user, token } = useAuth();
  const [today,   setToday]   = useState(null);
  const [summary, setSummary] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [t, s, p] = await Promise.all([
          api.getTodayEntry(token),
          api.getSummary(token),
          api.getProfile(token),
        ]);
        setToday(t);
        setSummary(s.summary);
        setProfile(p);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [token]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 13) return 'Buenos días';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  if (loading) return (
    <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  return (
    <div className="page stagger">

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 2, textTransform: 'capitalize' }}>{todayLabel}</p>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 6 }}>{greeting()},</p>
        <h1 className="title-xl">{user?.name}</h1>
      </div>

      {/* Today's entry */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <p className="muted" style={{ marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: 11 }}>Hoy</p>
            {today ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontWeight: 800,
                    fontSize: 52,
                    lineHeight: 1,
                    letterSpacing: '-0.03em',
                    color: 'var(--text-1)'
                  }}>
                    {today.calories.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 16, color: 'var(--text-3)', fontWeight: 500 }}>kcal</span>
                </div>

                <CalProgress consumed={today.calories} target={profile?.target_calories} />

                {/* Macros chips */}
                {(today.protein || today.carbs || today.fat) && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                    {MACROS.map(m => today[m.key] ? (
                      <div key={m.key} style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px',
                        background: m.bg,
                        borderRadius: 99,
                        fontSize: 12,
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, color: m.color }}>{Math.round(today[m.key])}g</span>
                        <span style={{ color: m.color, opacity: 0.7 }}>{m.label}</span>
                      </div>
                    ) : null)}
                  </div>
                )}
              </>
            ) : (
              <div style={{ paddingTop: 4 }}>
                <p style={{ color: 'var(--text-2)', marginBottom: 14, fontSize: 15 }}>No has registrado nada hoy</p>
                <Link to="/calculator" className="btn btn-primary btn-sm">Registrar ahora</Link>
              </div>
            )}
          </div>

          {today && (
            <Link to="/calculator" className="btn btn-secondary btn-sm" style={{ marginLeft: 12, flexShrink: 0 }}>Editar</Link>
          )}
        </div>
      </div>

      {/* Summary stats */}
      {summary && (
        <>
          <h2 className="title-md" style={{ marginTop: 28, marginBottom: 12 }}>Últimos 30 días</h2>
          <div className="stat-grid">
            <div className="stat-box">
              <div className="stat-label">Media diaria</div>
              <div className="stat-value">{summary.avgCalories?.toLocaleString() ?? '—'}</div>
              <div className="stat-unit">kcal/día</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Días registrados</div>
              <div className="stat-value">{summary.totalDaysLogged ?? 0}</div>
              <div className="stat-unit">de 30</div>
            </div>
            {summary.adherence != null && (
              <div className="stat-box">
                <div className="stat-label">Adherencia</div>
                <div className="stat-value">{summary.adherence}%</div>
                <div className="stat-unit">días en objetivo</div>
              </div>
            )}
            {summary.currentWeight && (
              <div className="stat-box">
                <div className="stat-label">Peso actual</div>
                <div className="stat-value">{summary.currentWeight}</div>
                <div className="stat-unit">kg</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Quick actions */}
      <h2 className="title-md" style={{ marginTop: 28, marginBottom: 12 }}>Acciones rápidas</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {ACTIONS.map(a => (
          <Link key={a.to} to={a.to} className="card" style={{ display: 'block', transition: 'transform 0.15s, box-shadow 0.15s', textDecoration: 'none', padding: 16 }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}>
            <div style={{
              width: 36, height: 36,
              background: a.accent,
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
              marginBottom: 10,
              color: a.iconColor,
            }}>{a.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</div>
            <div className="body-sm" style={{ marginTop: 2, fontSize: 12 }}>{a.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
