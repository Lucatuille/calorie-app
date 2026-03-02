import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function CalProgress({ consumed, target }) {
  if (!target) return null;
  const pct = Math.min((consumed / target) * 100, 100);
  const over = consumed > target;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>
        <span>{consumed} kcal consumidas</span>
        <span>Objetivo: {target}</span>
      </div>
      <div className="progress-track">
        <div className={`progress-fill ${over ? 'over' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 12 }}>
        {over
          ? <span style={{ color: 'var(--accent-2)' }}>+{consumed - target} kcal sobre el objetivo</span>
          : <span style={{ color: 'var(--accent)' }}>{target - consumed} kcal restantes</span>
        }
      </div>
    </div>
  );
}

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

  if (loading) return (
    <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  return (
    <div className="page stagger">

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>{greeting()},</p>
        <h1 className="title-xl">{user?.name}</h1>
      </div>

      {/* Today's entry */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="muted" style={{ marginBottom: 4 }}>Hoy</p>
            {today ? (
              <>
                <div style={{ fontFamily: 'Instrument Serif', fontSize: 48, lineHeight: 1 }}>
                  {today.calories.toLocaleString()}
                  <span style={{ fontSize: 18, color: 'var(--text-3)', marginLeft: 6 }}>kcal</span>
                </div>
                <CalProgress consumed={today.calories} target={profile?.target_calories} />

                {/* Macros */}
                {(today.protein || today.carbs || today.fat) && (
                  <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
                    {[
                      { label: 'Proteína', val: today.protein, color: '#2d6a4f' },
                      { label: 'Carbos',   val: today.carbs,   color: '#e76f51' },
                      { label: 'Grasa',    val: today.fat,     color: '#457b9d' },
                    ].map(m => m.val ? (
                      <div key={m.label} style={{ fontSize: 13 }}>
                        <span style={{ color: m.color, fontWeight: 600 }}>{Math.round(m.val)}g</span>
                        <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>{m.label}</span>
                      </div>
                    ) : null)}
                  </div>
                )}
              </>
            ) : (
              <div style={{ paddingTop: 8 }}>
                <p style={{ color: 'var(--text-2)', marginBottom: 12 }}>No has registrado nada hoy</p>
                <Link to="/calculator" className="btn btn-primary btn-sm">Registrar ahora</Link>
              </div>
            )}
          </div>

          {today && (
            <Link to="/calculator" className="btn btn-secondary btn-sm">Editar</Link>
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
        {[
          { to: '/calculator', icon: '＋', label: 'Registrar día',   desc: 'Calorías y macros' },
          { to: '/progress',   icon: '↗', label: 'Ver progreso',    desc: 'Gráficos y tendencias' },
          { to: '/calculator#tdee', icon: '⚡', label: 'Calcular TDEE', desc: 'Tu objetivo calórico' },
          { to: '/profile',    icon: '◎', label: 'Mi perfil',       desc: 'Datos y objetivo' },
        ].map(a => (
          <Link key={a.to} to={a.to} className="card" style={{ display: 'block', transition: 'transform 0.15s', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{a.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{a.label}</div>
            <div className="body-sm" style={{ marginTop: 2 }}>{a.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
