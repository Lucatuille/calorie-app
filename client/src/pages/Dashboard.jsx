import { useState, useEffect } from 'react';
import { LEVEL_CONFIG, getBadgeStyle } from '../utils/levels';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import SupplementTracker from '../components/SupplementTracker';
import TDEECalculator from '../components/TDEECalculator';

// ── Donut de macros (conic-gradient, sin dependencias) ───────
function MacroDonut({ protein, carbs, fat }) {
  const p = (protein || 0) * 4;
  const c = (carbs   || 0) * 4;
  const f = (fat     || 0) * 9;
  const total = p + c + f;
  if (!total) return null;

  const pEnd = (p / total) * 100;
  const cEnd = pEnd + (c / total) * 100;

  return (
    <div style={{
      width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
      background: `conic-gradient(#10b981 0% ${pEnd}%, #f59e0b ${pEnd}% ${cEnd}%, #3b82f6 ${cEnd}% 100%)`,
      WebkitMask: 'radial-gradient(transparent 16px, black 16px)',
      mask:        'radial-gradient(transparent 16px, black 16px)',
    }} />
  );
}

// ── Barra de progreso de calorías ────────────────────────────
function CalProgress({ consumed, target }) {
  if (!target) return null;
  const pct     = Math.min((consumed / target) * 100, 100);
  const diff    = consumed - target;
  const inRange = Math.abs(diff) <= 250;
  const over    = diff > 250;
  // under: diff < -250

  const fillColor = over ? 'var(--accent-2)' : inRange ? 'var(--accent)' : '#3b82f6';

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
        <span>{consumed.toLocaleString()} kcal</span>
        <span>Objetivo: {target.toLocaleString()}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: fillColor }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 12 }}>
        {over
          ? <span style={{ color: 'var(--accent-2)', fontWeight: 600 }}>+{diff.toLocaleString()} kcal sobre el objetivo</span>
          : inRange
            ? <span style={{ color: 'var(--accent)',  fontWeight: 600 }}>En objetivo ✓ ({diff >= 0 ? '+' : ''}{diff.toLocaleString()} kcal)</span>
            : <span style={{ color: '#3b82f6',        fontWeight: 600 }}>{Math.abs(diff).toLocaleString()} kcal por debajo del objetivo</span>
        }
      </div>
    </div>
  );
}

const MACROS = [
  { key: 'protein', label: 'Proteína', chipClass: 'chip-protein' },
  { key: 'carbs',   label: 'Carbos',   chipClass: 'chip-carbs'   },
  { key: 'fat',     label: 'Grasa',    chipClass: 'chip-fat'     },
];

const ACTIONS = [
  { to: '/calculator', icon: '＋', label: 'Registrar día',  desc: 'Calorías y macros',    accent: 'rgba(45,106,79,0.1)',   iconColor: 'var(--accent)' },
  { to: '/history',    icon: '↺',  label: 'Historial',      desc: 'Ver y editar entradas', accent: 'rgba(99,102,241,0.1)',  iconColor: '#6366f1' },
  { tdee: true,        icon: '⚡', label: 'Calcular TDEE', desc: 'Tu objetivo calórico',  accent: 'rgba(180,83,9,0.1)',    iconColor: '#b45309' },
  { to: '/profile',    icon: '◎',  label: 'Mi perfil',      desc: 'Datos y objetivo',      accent: 'rgba(231,111,81,0.1)', iconColor: 'var(--accent-2)' },
];

export default function Dashboard() {
  const { user, token } = useAuth();
  const [today,    setToday]    = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [showTDEE, setShowTDEE] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [t, s, p] = await Promise.all([
          api.getTodayEntries(token),
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

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 6  && hour < 14) return 'Buenos días';
    if (hour >= 14 && hour < 21) return 'Buenas tardes';
    return 'Buenas noches';
  }

  async function handleTDEESave(tdeeData) {
    // Merge with existing profile so PUT doesn't wipe name/age/weight/etc.
    const current = await api.getProfile(token);
    await api.updateProfile({ ...current, ...tdeeData }, token);
    const p = await api.getProfile(token);
    setProfile(p);
  }

  const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  if (loading) return (
    <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  const weekDiff = summary?.avgThisWeek != null && summary?.avgLastWeek != null
    ? summary.avgThisWeek - summary.avgLastWeek
    : null;

  const todayTotal = today.reduce((a, e) => ({
    calories: a.calories + (e.calories || 0),
    protein:  a.protein  + (e.protein  || 0),
    carbs:    a.carbs    + (e.carbs    || 0),
    fat:      a.fat      + (e.fat      || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const hasToday = today.length > 0;

  return (
    <div className="page stagger">

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 2, textTransform: 'capitalize' }}>{todayLabel}</p>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 6 }}>{getGreeting()},</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="title-xl">{user?.name}</h1>
          {summary?.streak > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(245,158,11,0.12)', color: '#d97706',
              padding: '4px 10px', borderRadius: 99, fontSize: 13, fontWeight: 600,
            }}>
              🔥 {summary.streak} {summary.streak === 1 ? 'día' : 'días'}
            </span>
          )}
          {(() => {
            const level = user?.access_level;
            const info  = LEVEL_CONFIG[level];
            const style = getBadgeStyle(level);
            if (!info?.badge || !style) return null;
            return (
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '3px 10px', borderRadius: 99,
                fontSize: 12, fontWeight: 500,
                ...style,
              }}>
                {info.badge}
              </span>
            );
          })()}
        </div>
      </div>

      {/* Tarjeta de hoy */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <p className="muted" style={{ marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: 11 }}>Hoy</p>
            {hasToday ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontWeight: 700, fontSize: 46, lineHeight: 1, letterSpacing: '-0.03em',
                  }}>
                    {todayTotal.calories.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 15, color: 'var(--text-3)', fontWeight: 500 }}>kcal</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {today.length} {today.length === 1 ? 'comida' : 'comidas'}
                </p>

                <CalProgress consumed={todayTotal.calories} target={profile?.target_calories} />

                {/* Macros: donut + chips */}
                {(todayTotal.protein > 0 || todayTotal.carbs > 0 || todayTotal.fat > 0) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                    <MacroDonut protein={todayTotal.protein} carbs={todayTotal.carbs} fat={todayTotal.fat} />
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      {MACROS.map(m => todayTotal[m.key] > 0 ? (
                        <div key={m.key} className={`macro-chip ${m.chipClass}`}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0, opacity: 0.7 }} />
                          <span style={{ fontWeight: 700 }}>{Math.round(todayTotal[m.key])}g</span>
                          <span style={{ opacity: 0.7 }}>{m.label}</span>
                        </div>
                      ) : null)}
                    </div>
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

          {hasToday && (
            <Link to="/calculator" className="btn btn-secondary btn-sm" style={{ marginLeft: 12, flexShrink: 0 }}>
              Añadir
            </Link>
          )}
        </div>
      </div>

      {/* Resumen semanal */}
      {summary?.avgThisWeek != null && (
        <div className="card" style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>
                Esta semana
              </p>
              <span style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>
                {summary.avgThisWeek.toLocaleString()}
              </span>
              <span style={{ color: 'var(--text-3)', fontSize: 12, marginLeft: 5 }}>kcal / día</span>
            </div>
            {weekDiff !== null && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>vs semana anterior</p>
                <span style={{
                  fontWeight: 700, fontSize: 15,
                  color: weekDiff <= 0 ? 'var(--accent)' : 'var(--accent-2)',
                }}>
                  {weekDiff > 0 ? '+' : ''}{weekDiff.toLocaleString()} kcal
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suplementos */}
      <div className="card" style={{ marginTop: 10 }}>
        <SupplementTracker />
      </div>

      {/* Stats últimos 30 días */}
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

      {/* Acciones rápidas */}
      <h2 className="title-md" style={{ marginTop: 28, marginBottom: 12 }}>Acciones rápidas</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {ACTIONS.map(a => {
          const cardStyle = { transition: 'transform 0.15s, box-shadow 0.15s', padding: 16 };
          const inner = (
            <>
              <div style={{
                width: 34, height: 34, background: a.accent, borderRadius: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, marginBottom: 10, color: a.iconColor,
              }}>{a.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{a.label}</div>
              <div className="body-sm" style={{ marginTop: 2, fontSize: 12 }}>{a.desc}</div>
            </>
          );
          if (a.tdee) {
            return (
              <button key="tdee" className="card" onClick={() => setShowTDEE(true)}
                style={{ ...cardStyle, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}>
                {inner}
              </button>
            );
          }
          return (
            <Link key={a.to} to={a.to} className="card"
              style={{ display: 'block', ...cardStyle }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}>
              {inner}
            </Link>
          );
        })}
      </div>

      <TDEECalculator
        isOpen={showTDEE}
        onClose={() => setShowTDEE(false)}
        onSave={handleTDEESave}
      />
    </div>
  );
}
