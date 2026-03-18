import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { LEVEL_CONFIG, getBadgeStyle, isPro } from '../utils/levels';
import { MEAL_TYPES } from '../utils/meals';
import { getEstadoCalorico } from '../utils/assistantMessages';
import SupplementTracker from '../components/SupplementTracker';

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 6  && h < 14) return 'Buenos días';
  if (h >= 14 && h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

// ── Macro mini-card ────────────────────────────────────────────
function MacroCard({ val, target, label, color }) {
  const pct     = target > 0 ? Math.min((val / target) * 100, 100) : 0;
  const overMac = target > 0 && val > target;
  return (
    <div style={{
      padding: '10px 8px 9px',
      background: 'var(--surface-2)',
      borderRadius: 'var(--radius-sm)',
      textAlign: 'center',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>
        {Math.round(val)}g
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.2px' }}>
        {label}{target > 0 ? ` · ${target}g` : ''}
      </div>
      {target > 0 && (
        <div style={{ height: 2, background: 'var(--surface-3)', borderRadius: 100, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: overMac ? '#ef4444' : color,
            borderRadius: 100,
            transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [e, s, p] = await Promise.all([
          api.getTodayEntries(token),
          api.getSummary(token),
          api.getProfile(token),
        ]);
        setEntries(e);
        setSummary(s.summary);
        setProfile(p);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, [token]);

  async function handleDelete(id) {
    await api.deleteEntry(id, token);
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  // ── Totales del día ────────────────────────────────────────
  const todayCalories = entries.reduce((a, e) => a + (e.calories || 0), 0);
  const todayProtein  = entries.reduce((a, e) => a + (e.protein  || 0), 0);
  const todayCarbs    = entries.reduce((a, e) => a + (e.carbs    || 0), 0);
  const todayFat      = entries.reduce((a, e) => a + (e.fat      || 0), 0);

  // ── Objetivos ─────────────────────────────────────────────
  const targetCalories = profile?.target_calories || user?.target_calories || 0;
  const targetProtein  = profile?.target_protein  || user?.target_protein  || 0;
  const targetCarbs    = profile?.target_carbs    || 0;
  const targetFat      = profile?.target_fat      || 0;

  // ── Estado calórico ────────────────────────────────────────
  const isOver         = targetCalories > 0 && todayCalories > targetCalories;
  const overage        = isOver ? todayCalories - targetCalories : 0;
  const remaining      = isOver ? 0 : Math.max(0, targetCalories - todayCalories);
  const pct            = targetCalories > 0 ? todayCalories / targetCalories : 0;
  const filledSegments = targetCalories > 0 ? Math.min(Math.round(pct * 10), 10) : 0;

  // Número hero: muestra lo más útil según el estado
  const heroNumber = isOver
    ? `+${overage.toLocaleString('es')}`
    : targetCalories > 0
      ? remaining.toLocaleString('es')
      : todayCalories.toLocaleString('es');

  const heroLabel = isOver
    ? 'kcal sobre el objetivo'
    : targetCalories > 0
      ? remaining === 0 ? 'objetivo alcanzado' : 'kcal libres hoy'
      : 'kcal registradas hoy';

  const heroColor = isOver ? '#ef4444' : 'var(--text-primary)';

  // Texto de estado bajo la barra
  const barStatus = targetCalories > 0
    ? isOver
      ? `${overage.toLocaleString('es')} kcal sobre el objetivo`
      : pct >= 0.95
        ? 'En objetivo ✓'
        : pct >= 0.70
          ? `Bien encaminado · ${remaining.toLocaleString('es')} kcal restantes`
          : todayCalories === 0
            ? 'Aún no has registrado nada hoy'
            : `${Math.round(pct * 100)}% del objetivo · ${remaining.toLocaleString('es')} kcal restantes`
    : null;

  const streak = summary?.streak || 0;

  const assistantPreview = targetCalories > 0
    ? getEstadoCalorico({ todayCalories, todayProtein }, targetCalories, targetProtein)
    : 'Tu nutricionista con IA';

  // ── Badge de nivel ─────────────────────────────────────────
  const levelBadge = (() => {
    const info  = LEVEL_CONFIG[user?.access_level];
    const style = getBadgeStyle(user?.access_level);
    if (!info?.badge || !style) return null;
    return (
      <span style={{
        fontSize: 11, fontWeight: 500,
        padding: '3px 10px', borderRadius: 'var(--radius-full)',
        ...style,
      }}>
        {info.badge}
      </span>
    );
  })();

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 40 }}>

      {/* ── 1. Saludo ── */}
      <div style={{ padding: '20px 20px 0' }}>
        <p style={{
          fontSize: 11, color: 'var(--text-secondary)',
          margin: '0 0 4px', fontFamily: 'var(--font-sans)',
        }}>
          {getGreeting()},
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 32, fontStyle: 'italic',
            fontWeight: 400, color: 'var(--text-primary)',
            margin: 0, lineHeight: 1,
          }}>
            {user?.name}
          </h1>
          {streak > 0 && (
            <span style={{
              fontSize: 11, color: '#d97706',
              background: 'rgba(245,158,11,0.1)',
              border: '0.5px solid rgba(245,158,11,0.25)',
              padding: '3px 10px', borderRadius: 'var(--radius-full)',
              fontWeight: 500,
            }}>
              🔥 {streak} {streak === 1 ? 'día' : 'días'}
            </span>
          )}
          {levelBadge}
        </div>
      </div>

      {/* ── 2. Hero calórico ── */}
      <div style={{ padding: '0 16px', marginBottom: 10 }}>
        <div style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 16px 14px',
        }}>

          {/* Número grande + consumido/objetivo */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', marginBottom: 14,
          }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 56, color: heroColor,
                lineHeight: 1, letterSpacing: '-3px',
                transition: 'color 0.3s',
              }}>
                {heroNumber}
              </div>
              <div style={{
                fontSize: 11,
                color: isOver ? '#ef4444' : 'var(--text-secondary)',
                marginTop: 4,
              }}>
                {heroLabel}
              </div>
            </div>

            {targetCalories > 0 && (
              <div style={{ textAlign: 'right', paddingTop: 6 }}>
                <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {todayCalories.toLocaleString('es')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                  de {targetCalories.toLocaleString('es')} kcal
                </div>
              </div>
            )}
          </div>

          {/* Barra segmentada */}
          {targetCalories > 0 && (
            <>
              <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} style={{
                    flex: 1, height: 4, borderRadius: 100,
                    background: i < filledSegments
                      ? isOver ? '#ef4444' : 'var(--accent)'
                      : 'var(--surface-3)',
                  }} />
                ))}
              </div>
              {barStatus && (
                <div style={{
                  fontSize: 10,
                  color: isOver ? '#ef4444' : pct >= 0.95 ? 'var(--accent)' : 'var(--text-tertiary)',
                  marginBottom: 14,
                }}>
                  {barStatus}
                </div>
              )}
            </>
          )}

          {/* Macros — cards individuales con mini-barra */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            <MacroCard val={todayProtein} target={targetProtein} label="proteína" color="var(--accent)" />
            <MacroCard val={todayCarbs}   target={targetCarbs}   label="carbos"   color="#f59e0b" />
            <MacroCard val={todayFat}     target={targetFat}     label="grasa"    color="#60a5fa" />
          </div>
        </div>
      </div>

      {/* ── 3. Comidas de hoy ── */}
      <div style={{ padding: '0 16px', marginBottom: 10 }}>
        <div style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 16px',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: entries.length > 0 ? 10 : 0,
          }}>
            <span style={{
              fontSize: 9, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 600,
            }}>
              Hoy · {entries.length} {entries.length === 1 ? 'comida' : 'comidas'}
            </span>
            {entries.length > 0 && (
              <button
                onClick={() => navigate('/calculator')}
                style={{
                  width: 24, height: 24, background: 'var(--accent)',
                  border: 'none', borderRadius: '50%', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <path d="M4.5 1v7M1 4.5h7" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          {entries.length === 0 ? (
            <button
              onClick={() => navigate('/calculator')}
              style={{
                width: '100%', background: 'none',
                border: '0.5px dashed var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '13px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-tertiary)',
                fontSize: 13, fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
              }}
            >
              Añade tu primera comida
            </button>
          ) : (
            <div>
              {entries.map((entry, i) => {
                const mealInfo = MEAL_TYPES.find(m => m.id === entry.meal_type);
                return (
                  <div key={entry.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '9px 0',
                    borderBottom: i < entries.length - 1 ? '0.5px solid var(--border)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                        <span style={{
                          fontSize: 13, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {entry.name || mealInfo?.label || entry.meal_type}
                        </span>
                        {entry.protein > 0 && (
                          <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                            {Math.round(entry.protein)}g prot · {Math.round(entry.carbs || 0)}g carbos · {Math.round(entry.fat || 0)}g grasa
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>
                        {entry.calories}
                      </span>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-tertiary)', fontSize: 16,
                          padding: '0 2px', lineHeight: 1,
                          borderRadius: 4,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Suplementos ── */}
      <div style={{ padding: '0 16px', marginBottom: 10 }}>
        <div style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 16px',
        }}>
          <SupplementTracker />
        </div>
      </div>

      {/* ── 5. Card del asistente ── */}
      <div style={{ padding: '0 16px 32px' }}>
        {isPro(user?.access_level) ? (
          <button
            onClick={() => navigate('/asistente')}
            style={{
              width: '100%',
              background: 'linear-gradient(145deg, #1c1c1c 0%, #111111 100%)',
              border: '0.5px solid rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 16px',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{
                fontSize: 10, background: 'var(--accent)',
                color: 'white', padding: '2px 8px',
                borderRadius: 'var(--radius-full)', fontWeight: 600,
                alignSelf: 'flex-start',
                fontFamily: 'var(--font-sans)',
                letterSpacing: '0.3px',
              }}>
                Pro
              </span>
              <span style={{
                fontSize: 15, fontWeight: 500, color: '#ffffff',
                fontFamily: 'var(--font-sans)', marginTop: 2,
              }}>
                Asistente personal
              </span>
              <span style={{
                fontSize: 11, color: 'rgba(255,255,255,0.4)',
                fontFamily: 'var(--font-sans)', lineHeight: 1.4,
                maxWidth: 280,
              }}>
                {assistantPreview}
              </span>
            </div>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginLeft: 12,
            }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>→</span>
            </div>
          </button>
        ) : (
          <button
            onClick={() => navigate('/planes')}
            style={{
              width: '100%', background: 'var(--surface-2)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '16px',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
                Asistente personal
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                Tu nutricionista con IA · Plan Pro
              </span>
            </div>
            <span style={{ fontSize: 16 }}>🔒</span>
          </button>
        )}
      </div>

<<<<<<< HEAD
=======
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

      {/* Card asistente — Fundador(1), Pro(2) y Admin(99) tienen acceso */}
      {isPro(user?.access_level) ? (
        <Link to="/asistente" style={{ display: 'block', textDecoration: 'none', marginTop: 16 }}>
          <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pro</p>
              <strong style={{ fontSize: 15 }}>🤖 Asistente nutricional</strong>
              <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '3px 0 0' }}>Pregúntale sobre tus datos reales</p>
            </div>
            <span style={{ fontSize: 20, color: 'var(--text-3)' }}>›</span>
          </div>
        </Link>
      ) : (
        <div className="card" style={{ marginTop: 16, padding: '16px 20px', opacity: 0.6,
                                       border: '1px dashed var(--border)', display: 'flex',
                                       justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pro</p>
            <strong style={{ fontSize: 15 }}>🤖 Asistente nutricional</strong>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>Pregúntale sobre tus datos reales</p>
          </div>
          <span style={{ fontSize: 20 }}>🔒</span>
        </div>
      )}

      <TDEECalculator
        isOpen={showTDEE}
        onClose={() => setShowTDEE(false)}
        onSave={handleTDEESave}
      />
>>>>>>> main
    </div>
  );
}
