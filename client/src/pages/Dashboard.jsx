import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { LEVEL_CONFIG, getBadgeStyle } from '../utils/levels';
import { MEAL_TYPES } from '../utils/meals';
import { getEstadoCalorico } from '../utils/assistantMessages';
import SupplementTracker from '../components/SupplementTracker';

const isPro = (level) => [1, 2, 99].includes(level ?? 0);

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 6  && h < 14) return 'Buenos días';
  if (h >= 14 && h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [entries,  setEntries]  = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);

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

  // ── Computed values ────────────────────────────────────────
  const todayCalories = entries.reduce((a, e) => a + (e.calories || 0), 0);
  const todayProtein  = entries.reduce((a, e) => a + (e.protein  || 0), 0);
  const todayCarbs    = entries.reduce((a, e) => a + (e.carbs    || 0), 0);
  const todayFat      = entries.reduce((a, e) => a + (e.fat      || 0), 0);

  const targetCalories = profile?.target_calories || user?.target_calories || 0;
  const targetProtein  = profile?.target_protein  || user?.target_protein  || 0;
  const remaining      = Math.max(0, targetCalories - todayCalories);
  const isOver         = todayCalories > targetCalories;
  const filledSegments = targetCalories > 0
    ? Math.min(Math.round((todayCalories / targetCalories) * 10), 10)
    : 0;

  const streak = summary?.streak || 0;

  const assistantPreview = targetCalories > 0
    ? getEstadoCalorico({ todayCalories, todayProtein }, targetCalories, targetProtein)
    : 'Tu nutricionista con IA';

  // ── Level badge ────────────────────────────────────────────
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

      {/* ── Sección 1: Saludo ── */}
      <div style={{ padding: '20px 24px 0' }}>
        <p style={{
          fontSize: 11, color: 'var(--text-secondary)',
          margin: '0 0 2px', fontFamily: 'var(--font-sans)',
        }}>
          {getGreeting()},
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
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
              fontSize: 11, color: 'var(--accent)',
              background: 'var(--accent-light)',
              border: '0.5px solid var(--accent-border)',
              padding: '3px 10px', borderRadius: 'var(--radius-full)',
              fontWeight: 500,
            }}>
              🔥 {streak} días
            </span>
          )}
          {levelBadge}
        </div>
      </div>

      {/* ── Sección 2: Hero calórico ── */}
      <div style={{ padding: '0 16px', marginBottom: 10 }}>
        <div style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
        }}>
          {/* Número grande + consumido/objetivo */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', marginBottom: 12,
          }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 52, color: 'var(--text-primary)',
                lineHeight: 1, letterSpacing: '-2px',
              }}>
                {targetCalories > 0 ? remaining.toLocaleString('es') : todayCalories.toLocaleString('es')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                {targetCalories > 0 ? 'kcal libres hoy' : 'kcal registradas hoy'}
              </div>
            </div>
            {targetCalories > 0 && (
              <div style={{ textAlign: 'right', paddingTop: 4 }}>
                <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {todayCalories.toLocaleString('es')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  de {targetCalories.toLocaleString('es')}
                </div>
              </div>
            )}
          </div>

          {/* Barra segmentada — 10 segmentos */}
          {targetCalories > 0 && (
            <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} style={{
                  flex: 1, height: 3, borderRadius: 100,
                  background: i < filledSegments
                    ? (isOver ? '#ef4444' : 'var(--accent)')
                    : 'var(--surface-3)',
                  transition: 'background 0.3s ease',
                }} />
              ))}
            </div>
          )}

          {/* Macros — grid 3 columnas */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-sm)', overflow: 'hidden',
          }}>
            {[
              { val: todayProtein, label: 'proteína' },
              { val: todayCarbs,   label: 'carbos' },
              { val: todayFat,     label: 'grasa' },
            ].map((m, i) => (
              <div key={m.label} style={{
                padding: '9px 8px', textAlign: 'center',
                background: 'var(--surface-2)',
                borderLeft: i > 0 ? '0.5px solid var(--border)' : 'none',
              }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {Math.round(m.val)}g
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2, letterSpacing: '0.2px' }}>
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sección 3: Comidas de hoy ── */}
      <div style={{ padding: '0 16px', marginBottom: 10 }}>
        <div style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 16px',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: entries.length > 0 ? 10 : 0,
          }}>
            <span style={{
              fontSize: 9, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500,
            }}>
              Hoy · {entries.length} {entries.length === 1 ? 'comida' : 'comidas'}
            </span>
            <button
              onClick={() => navigate('/calculator')}
              style={{
                width: 22, height: 22, background: 'var(--accent)',
                border: 'none', borderRadius: '50%', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M4 1v6M1 4h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Lista */}
          {entries.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Sin registros hoy — empieza añadiendo tu primera comida.
            </p>
          ) : (
            <div>
              {entries.map((entry, i) => (
                <div key={entry.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: i < entries.length - 1 ? '0.5px solid var(--border)' : 'none',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 12, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {entry.name || entry.meal_type}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                      {MEAL_TYPES.find(m => m.id === entry.meal_type)?.label || entry.meal_type}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>
                      {entry.calories} kcal
                    </span>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-tertiary)', fontSize: 16,
                        padding: 0, lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Sección 4: Suplementos ── */}
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

      {/* ── Sección 5: Card del asistente ── */}
      <div style={{ padding: '0 16px 32px' }}>
        {isPro(user?.access_level) ? (
          <button
            onClick={() => navigate('/asistente')}
            style={{
              width: '100%', background: '#111',
              border: 'none', borderRadius: 'var(--radius-lg)',
              padding: 16, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{
                fontSize: 10, background: 'var(--accent)',
                color: 'white', padding: '2px 8px',
                borderRadius: 'var(--radius-full)', fontWeight: 600,
                alignSelf: 'flex-start', marginBottom: 2,
                fontFamily: 'var(--font-sans)',
              }}>
                Pro
              </span>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#fff', fontFamily: 'var(--font-sans)' }}>
                Asistente personal
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-sans)' }}>
                {assistantPreview}
              </span>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>→</span>
          </button>
        ) : (
          <button
            onClick={() => navigate('/planes')}
            style={{
              width: '100%', background: 'var(--surface-2)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: 16,
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
                Asistente personal
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                Tu nutricionista con IA · Pro
              </span>
            </div>
            <span style={{ fontSize: 16 }}>🔒</span>
          </button>
        )}
      </div>

    </div>
  );
}
