import { usePageTitle } from '../hooks/usePageTitle';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { LEVEL_CONFIG, getBadgeStyle, isPro } from '../utils/levels';
import { MEAL_TYPES } from '../utils/meals';
import { getEstadoCalorico } from '../utils/assistantMessages';
import SupplementTracker from '../components/SupplementTracker';
import { DashboardSkeleton } from '../components/Skeleton';

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
  usePageTitle("Inicio");
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Weight state
  const [weightToday, setWeightToday]       = useState(null);
  const [weightYesterday, setWeightYesterday] = useState(null);
  const [weightLast, setWeightLast]         = useState(null);
  const [weightEditing, setWeightEditing]   = useState(false);
  const [weightValue, setWeightValue]       = useState('');
  const [weightSaving, setWeightSaving]     = useState(false);
  const weightRef = useRef(null);

  async function loadDashboard() {
    try {
      setLoading(true);
      setLoadError(false);
      const [e, s, p, w] = await Promise.all([
        api.getTodayEntries(token),
        api.getSummary(token),
        api.getProfile(token),
        api.getWeightToday(token).catch(() => ({ today: null, yesterday: null, last_recorded: null })),
      ]);
      setEntries(e);
      setSummary(s.summary);
      setProfile(p);
      setWeightToday(w.today);
      setWeightYesterday(w.yesterday);
      setWeightLast(w.last_recorded);
      if (w.today) setWeightValue(String(w.today));
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadDashboard(); }, [token]);

  const [deletingId, setDeletingId] = useState(null);

  async function handleDelete(id) {
    if (deletingId !== id) { setDeletingId(id); return; }
    try {
      await api.deleteEntry(id, token);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch { setDeletingId(null); return; }
    setDeletingId(null);
  }

  if (loading) return <DashboardSkeleton />;

  if (loadError) return (
    <section style={{ margin: '0 auto', maxWidth: 640, padding: '0 16px', textAlign: 'center', paddingTop: 80 }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>No se pudieron cargar los datos</p>
      <button onClick={() => loadDashboard()}
        style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}>
        Reintentar
      </button>
    </section>
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

  // ── Peso: delta vs ayer ────────────────────────────────────
  let wDelta = null;
  let wArrow = null;
  let wColor = 'var(--text-secondary)';
  if (weightToday && weightYesterday) {
    const diff = Math.round((weightToday - weightYesterday) * 10) / 10;
    if (diff < -0.05) { wArrow = '↓'; wDelta = String(Math.abs(diff)); wColor = 'var(--accent)'; }
    else if (diff > 0.05) { wArrow = '↑'; wDelta = String(diff); wColor = '#ef4444'; }
    else { wArrow = '—'; }
  }

  async function handleWeightSave() {
    const kg = parseFloat(weightValue);
    if (!kg || kg < 20 || kg > 300) return;
    setWeightSaving(true);
    try {
      await api.saveWeight({ weight_kg: kg }, token);
      setWeightYesterday(weightToday ?? weightYesterday);
      setWeightToday(kg);
      setWeightEditing(false);
    } catch {
      setWeightEditing(false);
    } finally { setWeightSaving(false); }
  }

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
    <section style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 40 }}>

      {/* ── 1. Saludo ── */}
      <header style={{ padding: '20px 20px 0' }}>
        <p style={{
          fontSize: 11, color: 'var(--text-secondary)',
          margin: '0 0 4px', fontFamily: 'var(--font-sans)',
        }}>
          {getGreeting()},
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <h1 className="page-title">{user?.name}</h1>
          {streak > 0 && (
            <span style={{
              fontSize: 11, color: 'var(--color-carbs)',
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
      </header>

      {/* ── 2. Hero calórico ── */}
      <div style={{ padding: '0 16px', marginBottom: 10 }}>
        <div style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 16px 14px',
          boxShadow: 'var(--shadow-md)',
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
            <MacroCard val={todayProtein} target={targetProtein} label="proteína" color="var(--color-protein)" />
            <MacroCard val={todayCarbs}   target={targetCarbs}   label="carbos"   color="var(--color-carbs)" />
            <MacroCard val={todayFat}     target={targetFat}     label="grasa"    color="var(--color-fat)" />
          </div>

          {/* Peso pill */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            {weightEditing ? (
              <form
                onSubmit={e => { e.preventDefault(); handleWeightSave(); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg)', border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius-full)', padding: '5px 14px',
                }}
              >
                <input
                  ref={weightRef}
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  value={weightValue}
                  onChange={e => {
                    const v = e.target.value.replace(',', '.');
                    if (/^\d{0,3}\.?\d{0,1}$/.test(v)) setWeightValue(v);
                  }}
                  placeholder={weightLast ? String(weightLast) : '70.0'}
                  style={{
                    width: 48, textAlign: 'center', fontWeight: 600,
                    fontSize: 13, border: '1px solid var(--accent)',
                    borderRadius: 6, padding: '2px 4px',
                    background: 'var(--surface)', color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)', outline: 'none',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>kg</span>
                <button
                  type="submit"
                  disabled={weightSaving}
                  aria-label="Guardar peso"
                  style={{
                    background: 'var(--accent)', color: 'white', border: 'none',
                    borderRadius: 5, padding: '2px 8px',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}
                >{weightSaving ? '…' : '✓'}</button>
                <button
                  type="button"
                  onClick={() => { setWeightEditing(false); setWeightValue(weightToday ? String(weightToday) : ''); }}
                  aria-label="Cancelar"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-tertiary)', fontSize: 13, padding: 0,
                  }}
                >×</button>
              </form>
            ) : (
              <button
                onClick={() => { setWeightValue(weightToday ? String(weightToday) : (weightLast ? String(weightLast) : '')); setWeightEditing(true); }}
                style={{
                  background: 'var(--bg)', border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius-full)', padding: '5px 14px',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {weightToday ? (
                  <>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                      ⚖ {weightToday} kg
                    </span>
                    {wArrow && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: wColor }}>
                        {wArrow}{wDelta && ` ${wDelta}`}
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    + Registrar peso
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Comidas de hoy ── */}
      <div style={{ padding: '0 16px', marginBottom: 10 }}>
        <div className="card card-padded card-shadow">
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: entries.length > 0 ? 10 : 0,
          }}>
            <span className="section-label">
              Hoy · {entries.length} {entries.length === 1 ? 'comida' : 'comidas'}
            </span>
            {entries.length > 0 && (
              <button
                onClick={() => navigate('/calculator')}
                aria-label="Añadir comida"
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
            <div
              onClick={() => navigate('/calculator')}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '24px 16px 20px', textAlign: 'center',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(22, 163, 74, 0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="4" width="16" height="12" rx="2.5" stroke="var(--accent)" strokeWidth="1.5"/>
                  <circle cx="10" cy="10" r="2.5" stroke="var(--accent)" strokeWidth="1.5"/>
                  <circle cx="14.5" cy="6.5" r="1" fill="var(--accent)"/>
                </svg>
              </div>
              <span style={{
                fontFamily: 'var(--font-serif)', fontSize: 18,
                fontWeight: 400, color: 'var(--text-primary)', marginBottom: 4,
              }}>
                Hazle una foto a tu plato
              </span>
              <span style={{
                fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 18,
              }}>
                La IA calcula calorías y macros por ti
              </span>
              <span style={{
                background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 99,
                padding: '10px 28px', fontSize: 13, fontWeight: 500,
                fontFamily: 'var(--font-sans)',
              }}>
                Registrar comida
              </span>
            </div>
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
                        onBlur={() => { if (deletingId === entry.id) setDeletingId(null); }}
                        aria-label="Eliminar comida"
                        style={{
                          background: deletingId === entry.id ? 'var(--danger)' : 'none',
                          border: 'none', cursor: 'pointer',
                          color: deletingId === entry.id ? '#fff' : 'var(--text-tertiary)',
                          fontSize: deletingId === entry.id ? 10 : 16,
                          padding: deletingId === entry.id ? '2px 6px' : '0 2px',
                          lineHeight: 1, borderRadius: 4,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {deletingId === entry.id ? '¿Borrar?' : '×'}
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
        <div className="card card-padded card-shadow">
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
            onClick={() => { api.trackUpgradeEvent('assistant_lock_click', token); navigate('/upgrade'); }}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 10, background: 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.5)', padding: '2px 8px',
                  borderRadius: 'var(--radius-full)', fontWeight: 600,
                  fontFamily: 'var(--font-sans)', letterSpacing: '0.3px',
                }}>
                  Pro
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>🔒</span>
              </div>
              <span style={{
                fontSize: 15, fontWeight: 500, color: '#ffffff',
                fontFamily: 'var(--font-sans)', marginTop: 2,
              }}>
                Asistente personal
              </span>
              <span style={{
                fontSize: 11, color: 'rgba(255,255,255,0.35)',
                fontFamily: 'var(--font-sans)', lineHeight: 1.4,
                maxWidth: 280,
              }}>
                {targetCalories > 0
                  ? `Tienes ${remaining.toLocaleString('es')} kcal libres hoy. El asistente te diría qué cenar para llegar a tu objetivo.`
                  : 'Tu nutricionista con IA — analiza tus patrones y responde con tus datos reales.'}
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
        )}
      </div>

    </section>
  );
}
