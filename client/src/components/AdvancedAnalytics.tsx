import { useState, useEffect } from 'react';
import {
  BarChart, Bar, Cell,
  ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { ADHERENCE_TOLERANCE } from '../utils/constants';

const PERIOD_OPTIONS = [
  { value: 'week',   label: '7 días'  },
  { value: 'month',  label: '30 días' },
  { value: '90days', label: '90 días' },
];

const DAY_EMOJIS = {
  Lunes: '💪', Martes: '✅', Miércoles: '⭐', Jueves: '👍',
  Viernes: '🎉', Sábado: '😅', Domingo: '😴',
};

const MEAL_LABELS  = { breakfast: 'Desayuno', lunch: 'Comida', dinner: 'Cena', snack: 'Snack', other: 'Otro' };
const MEAL_COLORS  = { breakfast: '#f59e0b', lunch: '#2d6a4f', dinner: '#6366f1', snack: '#f97316', other: '#94a3b8' };
const MEAL_PCT_KEY = { breakfast: 'breakfast_avg_pct', lunch: 'lunch_avg_pct', dinner: 'dinner_avg_pct', snack: 'snacks_avg_pct', other: 'other_avg_pct' };

const CONFIDENCE = {
  high:   { icon: '🟢', label: 'Alta',  text: 'Proyección fiable — tienes suficientes datos' },
  medium: { icon: '🟡', label: 'Media', text: 'Proyección orientativa — registra tu peso más a menudo' },
  low:    { icon: '🔴', label: 'Baja',  text: 'Datos insuficientes — registra peso diariamente para mejorar la precisión' },
};

// ── Helpers ────────────────────────────────────────────────────

function Skeleton({ h = 16, mb = 0 }) {
  return (
    <div style={{
      height: h, borderRadius: 8, marginBottom: mb,
      background: 'linear-gradient(90deg, var(--border) 25%, var(--surface) 50%, var(--border) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  );
}

function Section({ title, children, style }) {
  return (
    <div style={{ marginBottom: 28, ...style }}>
      <p style={{
        fontSize: 9, fontWeight: 600, letterSpacing: '0.7px',
        textTransform: 'uppercase', color: 'var(--text-secondary)',
        marginBottom: 14, fontFamily: 'var(--font-sans)',
      }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function EmptyMsg({ text = 'Registra más días para ver este análisis' }) {
  return <p style={{ color: 'var(--text-3)', fontSize: 13, fontStyle: 'italic' }}>{text}</p>;
}

// Sistema C — sin border, con shadow
function StatBox({ label, value, sub, valueColor }) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-sm)',
      padding: '12px 14px',
    }}>
      <p style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 6, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{label}</p>
      <p style={{ fontWeight: 600, fontSize: 20, lineHeight: 1.1, color: valueColor || 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, fontFamily: 'var(--font-sans)' }}>{sub}</p>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export default function AdvancedAnalytics({ isOpen, onClose, userTarget }) {
  const { token } = useAuth();
  const [period,          setPeriod]          = useState('month');
  const [data,            setData]            = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setData(null);
    api.getAdvancedAnalytics(period, token)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, period, token]);

  // Projection chart data: historical weight + 3 projected scenarios
  const projChartData = (() => {
    if (!data?.daily_data) return [];
    const weightPts = data.daily_data
      .filter(d => d.weight != null)
      .map(d => ({
        date: new Date(d.date + 'T12:00:00Z').toLocaleDateString('es', { day: 'numeric', month: 'short' }),
        actual: d.weight,
      }));
    if (!weightPts.length || !data.projection?.scenarios) return weightPts;

    const { scenarios } = data.projection;
    const today = new Date();
    const fmt   = n => new Date(today.getTime() + n * 86400000).toLocaleDateString('es', { day: 'numeric', month: 'short' });
    const cw = data.weight.current;
    return [
      ...weightPts,
      { date: 'Hoy',   actual: cw, optimistic: cw, realistic: cw, conservative: cw },
      { date: fmt(30), optimistic: scenarios.optimistic['30d'], realistic: scenarios.realistic['30d'], conservative: scenarios.conservative['30d'] },
      { date: fmt(60), optimistic: scenarios.optimistic['60d'], realistic: scenarios.realistic['60d'], conservative: scenarios.conservative['60d'] },
      { date: fmt(90), optimistic: scenarios.optimistic['90d'], realistic: scenarios.realistic['90d'], conservative: scenarios.conservative['90d'] },
    ];
  })();

  const adherenceColor = !data?.calories?.adherence_pct ? 'var(--text-2)'
    : data.calories.adherence_pct >= 70 ? 'var(--color-success)'
    : data.calories.adherence_pct >= 40 ? '#f59e0b'
    : '#ef4444';

  const trendText = (() => {
    const t = data?.calories?.trend, p = data?.calories?.trend_pct;
    if (!t) return null;
    if (t === 'improving') return `¡Vas mejorando! Tu segunda mitad ha sido un ${p}% mejor`;
    if (t === 'worsening') return `Cuidado — tu segunda mitad ha sido un ${p}% peor`;
    return 'Muy consistente — tus hábitos son estables';
  })();

  const mealBreakdown = !data?.meals ? [] :
    Object.entries(MEAL_LABELS)
      .map(([key, label]) => ({ key, label, pct: data.meals[MEAL_PCT_KEY[key]] || 0, color: MEAL_COLORS[key] }))
      .filter(m => m.pct > 0)
      .sort((a, b) => b.pct - a.pct);

  const calorieHistogram = (() => {
    if (!data?.daily_data) return [];
    const cals = data.daily_data.map(d => d.calories).filter(c => c > 0);
    if (cals.length < 2) return [];
    const min = Math.min(...cals);
    const max = Math.max(...cals);
    const bucketSize = Math.max(100, Math.round((max - min) / 6 / 100) * 100) || 200;
    const buckets = [];
    for (let low = Math.floor(min / bucketSize) * bucketSize; low <= max; low += bucketSize) {
      const count = cals.filter(c => c >= low && c < low + bucketSize).length;
      if (count > 0) buckets.push({ range: `${low}`, count });
    }
    return buckets;
  })();

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 998,
          background: 'rgba(0,0,0,0.45)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.35s',
        }}
      />

      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999,
        maxWidth: 600, marginLeft: 'auto', marginRight: 'auto',
        background: 'var(--bg)',
        borderRadius: '20px 20px 0 0',
        maxHeight: '88vh',
        overflowY: 'auto',
        transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
      }}>

        {/* Handle */}
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border)' }} />
        </div>

        {/* Sticky header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px 12px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1,
        }}>
          <h2 style={{
            fontFamily: 'var(--font-serif)', fontStyle: 'italic',
            fontWeight: 400, fontSize: 22, color: 'var(--text-primary)',
          }}>Análisis profundo</h2>
          <button onClick={onClose} aria-label="Cerrar" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-3)', fontSize: 22, padding: '4px 8px', lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 20px', borderBottom: '0.5px solid var(--border)' }}>
          {PERIOD_OPTIONS.map(p => {
            const isActive = period === p.value;
            return (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                style={{
                  flex: 1, padding: '6px 0',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 12, fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  border: `0.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  background: isActive ? 'rgba(45,106,79,0.1)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>

          {/* Loading skeleton */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Skeleton h={100} mb={4} />
              <Skeleton h={160} mb={4} />
              <Skeleton h={80}  mb={4} />
              <Skeleton h={200} />
            </div>
          )}

          {/* No data */}
          {!loading && data && data.days_with_data === 0 && (
            <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--text-3)' }}>
              <p style={{ fontSize: 36, marginBottom: 12 }}>📊</p>
              <p style={{ fontWeight: 500 }}>No hay datos para este período</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>Empieza a registrar para ver el análisis</p>
            </div>
          )}

          {/* Data available */}
          {!loading && data && data.days_with_data > 0 && (
            <>

              {/* ── Sección 1: Resumen ── */}
              <Section title="Resumen rápido">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <StatBox
                    label="Días registrados"
                    value={data.days_with_data}
                    sub={`de ${data.total_days}`}
                  />
                  <StatBox
                    label="Adherencia"
                    value={data.calories.adherence_pct != null ? `${data.calories.adherence_pct}%` : '—'}
                    sub="días en objetivo ±250 kcal"
                    valueColor={adherenceColor}
                  />
                  <StatBox
                    label="Mejor día"
                    value={data.calories.best_day_of_week
                      ? `${DAY_EMOJIS[data.calories.best_day_of_week] || ''} ${data.calories.best_day_of_week}`
                      : '—'}
                    sub="menos calorías"
                  />
                  <StatBox
                    label="Racha más larga"
                    value={data.streaks.longest_in_period}
                    sub={data.streaks.longest_in_period === 1 ? 'día seguido' : 'días seguidos'}
                  />
                </div>
              </Section>

              {/* ── Sección 2: Calorías ── */}
              <Section title="Calorías">
                {data.calories.avg != null ? (
                  <>
                    <div style={{ display: 'flex', gap: 20, marginBottom: 14, flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Media</p>
                        <p style={{ fontWeight: 700, fontSize: 20 }}>{data.calories.avg.toLocaleString()} kcal</p>
                      </div>
                      {data.calories.min != null && (
                        <div>
                          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Mínimo</p>
                          <p style={{ fontWeight: 600, fontSize: 16 }}>{data.calories.min.toLocaleString()}</p>
                        </div>
                      )}
                      {data.calories.max != null && (
                        <div>
                          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Máximo</p>
                          <p style={{ fontWeight: 600, fontSize: 16 }}>{data.calories.max.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '16px 12px 8px' }}>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart
                          data={data.daily_data.map(d => ({
                            date: new Date(d.date + 'T12:00:00Z').toLocaleDateString('es', { day: 'numeric', month: 'short' }),
                            calories: d.calories,
                          }))}
                          margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                        >
                          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
                          <Tooltip
                            formatter={v => [`${v.toLocaleString()} kcal`, 'Calorías']}
                            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                          />
                          {userTarget && <ReferenceLine y={userTarget} stroke="var(--accent)" strokeDasharray="4 4" />}
                          <Bar dataKey="calories" radius={[3, 3, 0, 0]}>
                            {data.daily_data.map((entry, i) => {
                              const c = entry.calories;
                              const color = !userTarget ? '#2d6a4f'
                                : Math.abs(c - userTarget) <= ADHERENCE_TOLERANCE ? '#2d6a4f'
                                : c > userTarget + 250 ? '#f59e0b'
                                : 'var(--color-fat)';
                              return <Cell key={i} fill={color} fillOpacity={0.85} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {data.calories.worst_day_of_week && (
                      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10, fontStyle: 'italic' }}>
                        {DAY_EMOJIS[data.calories.worst_day_of_week]} Tus {data.calories.worst_day_of_week}s son tus días más difíciles
                        {data.calories.worst_day_avg ? ` (media ${data.calories.worst_day_avg.toLocaleString()} kcal)` : ''}
                      </p>
                    )}
                  </>
                ) : <EmptyMsg />}
              </Section>

              {/* ── Sección 3: Distribución de comidas ── */}
              {mealBreakdown.length > 0 && (
                <Section title="Por tipo de comida">
                  <div style={{
                    background: 'var(--surface)', borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-sm)', padding: '16px',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {mealBreakdown.map(m => (
                        <div key={m.key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                            <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{m.label}</span>
                            <span style={{ fontWeight: 700 }}>{m.pct}%</span>
                          </div>
                          <div style={{ height: 7, background: 'var(--border)', borderRadius: 99 }}>
                            <div style={{ height: '100%', width: `${m.pct}%`, background: m.color, borderRadius: 99, transition: 'width 0.6s' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {data.meals.most_calories_meal && (
                      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 14, fontStyle: 'italic' }}>
                        Tu {MEAL_LABELS[data.meals.most_calories_meal]?.toLowerCase()} representa la mayor parte de tus calorías
                      </p>
                    )}
                  </div>
                </Section>
              )}

              {/* ── Sección 3.5: Patrón calórico ── */}
              {data.projection?.calorie_variability_cv != null && (
                <Section title="Tu patrón calórico">
                  {(() => {
                    const cvPct = Math.round(data.projection.calorie_variability_cv * 100);
                    const cvColor = cvPct < 15 ? 'var(--color-success)' : cvPct <= 30 ? '#f59e0b' : '#ef4444';
                    const cvLabel = cvPct < 15 ? 'Muy consistente' : cvPct <= 30 ? 'Variabilidad normal' : 'Alta variabilidad';
                    return (
                      <>
                        <div style={{
                          background: 'var(--surface)', borderRadius: 'var(--radius-md)',
                          boxShadow: 'var(--shadow-sm)', padding: '16px', marginBottom: 10,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
                            <p style={{ fontSize: 28, fontWeight: 700, color: cvColor, lineHeight: 1 }}>{cvPct}%</p>
                            <p style={{ fontSize: 13, color: cvColor }}>{cvLabel}</p>
                          </div>
                          {data.calories.days_in_target != null && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                              {[
                                { label: 'En objetivo', val: data.calories.days_in_target, color: 'var(--color-success)' },
                                { label: 'Por encima',  val: data.calories.days_over,       color: '#f59e0b' },
                                { label: 'Por debajo',  val: data.calories.days_under,      color: 'var(--color-fat)' },
                              ].map(item => (
                                <div key={item.label} style={{
                                  background: 'var(--bg)', borderRadius: 10,
                                  padding: '10px 8px', textAlign: 'center',
                                }}>
                                  <p style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.val}</p>
                                  <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{item.label}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {calorieHistogram.length > 0 && (
                          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '12px 12px 4px' }}>
                            <ResponsiveContainer width="100%" height={70}>
                              <BarChart data={calorieHistogram} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
                                <XAxis dataKey="range" tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} />
                                <Bar dataKey="count" fill="var(--accent)" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </Section>
              )}

              {/* ── Sección 4: Proyección de peso ── */}
              <Section title="Proyección de peso">
                {data.weight?.current == null ? (
                  <EmptyMsg text="Registra tu peso en las entradas para ver proyecciones" />
                ) : (
                  <>
                    {/* KPI Row — 3 cards con accent bar superior 2px */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
                      {/* Peso actual — green */}
                      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
                        <div style={{ height: 2, background: 'var(--color-success)' }} />
                        <div style={{ padding: '10px 10px 12px' }}>
                          <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5, fontFamily: 'var(--font-sans)' }}>Peso actual</p>
                          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-success)', lineHeight: 1, fontFamily: 'var(--font-sans)' }}>{data.weight.current}</p>
                          <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>kg</p>
                        </div>
                      </div>
                      {/* Tasa semanal — amber */}
                      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
                        <div style={{ height: 2, background: '#f59e0b' }} />
                        <div style={{ padding: '10px 10px 12px' }}>
                          <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5, fontFamily: 'var(--font-sans)' }}>Tasa semanal</p>
                          <p style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b', lineHeight: 1, fontFamily: 'var(--font-sans)' }}>
                            {data.projection?.weekly_rate_realistic != null
                              ? `${data.projection.weekly_rate_realistic > 0 ? '+' : ''}${data.projection.weekly_rate_realistic}`
                              : '—'}
                          </p>
                          <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>kg/sem</p>
                        </div>
                      </div>
                      {/* Días al objetivo — dark */}
                      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
                        <div style={{ height: 2, background: '#111111' }} />
                        <div style={{ padding: '10px 10px 12px' }}>
                          <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5, fontFamily: 'var(--font-sans)' }}>Días al objetivo</p>
                          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, fontFamily: 'var(--font-sans)' }}>
                            {data.projection?.days_to_goal_realistic ? `~${data.projection.days_to_goal_realistic}` : '—'}
                          </p>
                          <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>días</p>
                        </div>
                      </div>
                    </div>

                    {/* Gráfico de proyección */}
                    {projChartData.length > 1 && (
                      <div style={{
                        background: 'var(--surface)', borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-md)', padding: '14px 10px 10px',
                        position: 'relative', marginBottom: 16,
                      }}>
                        {/* Leyenda vertical — esquina superior derecha */}
                        <div style={{
                          position: 'absolute', top: 10, right: 8, zIndex: 1,
                          display: 'flex', flexDirection: 'column', gap: 4,
                          background: 'rgba(255,255,255,0.92)',
                          backdropFilter: 'blur(4px)',
                          borderRadius: 6, padding: '5px 7px',
                          boxShadow: 'var(--shadow-sm)',
                        }}>
                          {[
                            { color: '#111111', label: 'Real',        dash: false },
                            { color: '#f59e0b', label: 'Realista',    dash: true  },
                            { color: 'var(--color-success)', label: 'Optimista',   dash: true  },
                            { color: '#94a3b8', label: 'Conservador', dash: true  },
                          ].map(item => (
                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <svg width="14" height="6" viewBox="0 0 14 6" style={{ flexShrink: 0 }}>
                                {item.dash
                                  ? <line x1="0" y1="3" x2="14" y2="3" stroke={item.color} strokeWidth="1.5" strokeDasharray="3 2" />
                                  : <line x1="0" y1="3" x2="14" y2="3" stroke={item.color} strokeWidth="2" />
                                }
                              </svg>
                              <span style={{ fontSize: 8, color: 'var(--text-3)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>{item.label}</span>
                            </div>
                          ))}
                        </div>

                        <ResponsiveContainer width="100%" height={240}>
                          <ComposedChart data={projChartData} margin={{ top: 12, right: 16, bottom: 5, left: -6 }}>
                            <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                            <Tooltip
                              formatter={(v, name) => {
                                const labels = { actual: 'Real', optimistic: 'Optimista', realistic: 'Realista', conservative: 'Conservador' };
                                return [`${v} kg`, labels[name] || name];
                              }}
                              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                            />

                            {/* Banda de confianza — amber opacity 0.12, area bajo la línea optimista */}
                            <Area
                              type="monotone"
                              dataKey="optimistic"
                              fill="#f59e0b"
                              fillOpacity={0.12}
                              stroke="none"
                              connectNulls={false}
                              legendType="none"
                            />

                            {/* Separador "Hoy" — histórico / proyección */}
                            <ReferenceLine
                              x="Hoy"
                              stroke="var(--border)"
                              strokeDasharray="4 4"
                              strokeWidth={1.5}
                              label={({ viewBox }) => (
                                <g>
                                  <text
                                    x={(viewBox?.x || 0) - 6}
                                    y={(viewBox?.y || 0) + 14}
                                    textAnchor="end"
                                    fontSize={9}
                                    fill="var(--text-3)"
                                    fontFamily="var(--font-sans)"
                                  >
                                    Histórico
                                  </text>
                                  <text
                                    x={(viewBox?.x || 0) + 6}
                                    y={(viewBox?.y || 0) + 14}
                                    textAnchor="start"
                                    fontSize={9}
                                    fill="var(--text-3)"
                                    fontFamily="var(--font-sans)"
                                  >
                                    Proyección →
                                  </text>
                                </g>
                              )}
                            />

                            {/* Línea objetivo horizontal */}
                            {data.projection?.goal_weight && (
                              <ReferenceLine
                                y={data.projection.goal_weight}
                                stroke="var(--color-success)"
                                strokeOpacity={0.5}
                                strokeDasharray="4 4"
                                label={{ value: `${data.projection.goal_weight} kg`, position: 'insideTopLeft', fill: 'var(--color-success)', fontSize: 10 }}
                              />
                            )}

                            {/* Proyección conservadora — slate, 1.5px */}
                            <Line
                              type="monotone"
                              dataKey="conservative"
                              stroke="#94a3b8"
                              strokeWidth={1.5}
                              strokeDasharray="4 4"
                              dot={false}
                              connectNulls={false}
                              legendType="none"
                            />
                            {/* Proyección optimista — green, 1.5px */}
                            <Line
                              type="monotone"
                              dataKey="optimistic"
                              stroke="var(--color-success)"
                              strokeWidth={1.5}
                              strokeDasharray="6 4"
                              dot={false}
                              connectNulls={false}
                              legendType="none"
                            />
                            {/* Proyección realista — amber, 2px, protagonista */}
                            <Line
                              type="monotone"
                              dataKey="realistic"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              strokeDasharray="6 4"
                              dot={{ r: 3, fill: '#f59e0b' }}
                              connectNulls={false}
                              legendType="none"
                            />
                            {/* Línea histórica — dark, sólida, punto actual con halo */}
                            <Line
                              type="monotone"
                              dataKey="actual"
                              stroke="#111111"
                              strokeWidth={2}
                              connectNulls={false}
                              legendType="none"
                              dot={(props) => {
                                const { cx, cy, payload } = props;
                                if (!cx || !cy) return null;
                                if (payload.date === 'Hoy') {
                                  return (
                                    <g key={`dot-hoy-${cx}-${cy}`}>
                                      <circle cx={cx} cy={cy} r={10} fill="#111111" fillOpacity={0.1} />
                                      <circle cx={cx} cy={cy} r={5} fill="#111111" />
                                    </g>
                                  );
                                }
                                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="#111111" />;
                              }}
                              activeDot={{ r: 5, fill: '#111111' }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Escenarios — 3 cards con accent bar izquierdo 3px */}
                    {data.projection?.scenarios && (
                      <div style={{ marginBottom: 16 }}>
                        <p style={{
                          fontSize: 10, color: 'var(--text-3)', marginBottom: 10,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          fontFamily: 'var(--font-sans)', fontWeight: 600,
                        }}>
                          Escenarios a 30 / 60 / 90 días
                        </p>
                        {[
                          { key: 'optimistic',   label: 'Optimista',   sub: 'adherencia perfecta',   accentColor: 'var(--color-success)', textColor: 'var(--color-success)' },
                          { key: 'realistic',    label: 'Realista',    sub: 'basado en tus hábitos', accentColor: '#f59e0b', textColor: '#92400e' },
                          { key: 'conservative', label: 'Conservador', sub: 'adherencia 20% menor',  accentColor: '#94a3b8', textColor: '#475569' },
                        ].map(s => (
                          <div key={s.key} style={{
                            marginBottom: 8,
                            background: 'var(--surface)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: 'var(--shadow-sm)',
                            borderLeft: `3px solid ${s.accentColor}`,
                            overflow: 'hidden',
                          }}>
                            <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 600, color: s.textColor, margin: 0, fontFamily: 'var(--font-sans)' }}>{s.label}</p>
                                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>{s.sub}</p>
                              </div>
                              <div style={{ display: 'flex' }}>
                                {['30d', '60d', '90d'].map((t, idx) => (
                                  <div key={t} style={{
                                    paddingLeft: 12, paddingRight: idx === 2 ? 0 : 12,
                                    textAlign: 'center',
                                    borderRight: idx < 2 ? '1px solid var(--border)' : 'none',
                                  }}>
                                    <p style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3, fontFamily: 'var(--font-sans)' }}>
                                      {t}
                                    </p>
                                    <p style={{ fontWeight: 700, fontSize: 14, color: s.textColor, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                                      {data.projection.scenarios[s.key]?.[t] ?? '—'} <span style={{ fontSize: 10, fontWeight: 400 }}>kg</span>
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Card objetivo — icono 🎯 en badge verde suave */}
                    {data.projection?.days_to_goal_realistic && data.projection?.goal_weight && (
                      <div style={{
                        marginBottom: 12,
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-md)',
                        padding: '14px 16px',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: 'rgba(45,106,79,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, flexShrink: 0,
                        }}>🎯</div>
                        <div>
                          <p style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                            A tu objetivo ({data.projection.goal_weight} kg) le quedan ~{data.projection.days_to_goal_realistic} días
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>escenario realista</p>
                        </div>
                      </div>
                    )}

                    {/* Plateau banner — accent bar, sin fondo de color */}
                    {data.projection?.plateau_prediction?.will_plateau && (
                      <div style={{
                        marginBottom: 12,
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-sm)',
                        borderLeft: '3px solid #f59e0b',
                        padding: '12px 14px',
                      }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-carbs)', marginBottom: 4 }}>
                          Plateau probable hacia el día {data.projection.plateau_prediction.estimated_day}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
                          {data.projection.plateau_prediction.reason}
                        </p>
                      </div>
                    )}

                    {/* Calidad del modelo — barra con color dinámico */}
                    {data.projection?.data_quality_score != null && (
                      <div style={{
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-sm)',
                        padding: '12px 14px',
                        marginBottom: 12,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>Calidad del modelo</span>
                          <span style={{
                            fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)',
                            color: data.projection.data_quality_score >= 0.7 ? 'var(--color-success)'
                              : data.projection.data_quality_score >= 0.5 ? '#f59e0b'
                              : '#ef4444',
                          }}>
                            {Math.round(data.projection.data_quality_score * 100)}%
                          </span>
                        </div>
                        <div style={{ height: 6, background: 'var(--border)', borderRadius: 99 }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.round(data.projection.data_quality_score * 100)}%`,
                            background: data.projection.data_quality_score >= 0.7 ? 'var(--color-success)'
                              : data.projection.data_quality_score >= 0.5 ? '#f59e0b'
                              : '#ef4444',
                            borderRadius: 99, transition: 'width 0.6s',
                          }} />
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, fontFamily: 'var(--font-sans)' }}>
                          Mejora registrando peso y calorías más días
                        </p>
                      </div>
                    )}

                    {/* Confidence */}
                    {data.projection?.confidence && (() => {
                      const c = CONFIDENCE[data.projection.confidence];
                      return (
                        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12, fontFamily: 'var(--font-sans)' }}>
                          {c.icon} <strong>Confianza {c.label.toLowerCase()}:</strong> {c.text}
                        </p>
                      );
                    })()}

                    {/* Collapsible explanation */}
                    <div style={{ marginBottom: 14 }}>
                      <button
                        onClick={() => setShowExplanation(s => !s)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-3)', fontSize: 12, padding: 0,
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        {showExplanation ? '▲' : '▼'} ¿Cómo se calcula?
                      </button>
                      {showExplanation && (
                        <div style={{ marginTop: 10, padding: '12px 14px', background: 'var(--bg)', borderRadius: 10, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                          <p style={{ marginBottom: 6 }}>
                            Este modelo tiene en cuenta que el metabolismo se adapta a la baja (~15% de reducción del déficit por cada 10% de peso perdido).
                          </p>
                          <p style={{ marginBottom: 6 }}>
                            La proyección realista asume tu adherencia actual del{' '}
                            {data.projection?.adherence_rate != null
                              ? `${Math.round(data.projection.adherence_rate * 100)}%`
                              : '—'} — los días sin registrar se consideran días sin déficit.
                          </p>
                          <p>
                            La incertidumbre aumenta con el tiempo — las bandas se ensanchan porque pequeñas variaciones se acumulan.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Scientific disclaimer */}
                    <p style={{
                      fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5,
                      borderTop: '1px solid var(--border)', paddingTop: 12,
                      fontFamily: 'var(--font-sans)',
                    }}>
                      Las proyecciones son estimaciones orientativas con un margen de error de ±150-200 kcal. El peso fluctúa ±1-2 kg diariamente por agua y glucógeno — esto no refleja cambios reales en grasa. No uses estos datos para decisiones médicas. Consulta con un profesional de la salud para objetivos terapéuticos.
                    </p>
                  </>
                )}
              </Section>

              {/* ── Sección 5: Tendencia ── */}
              {trendText && (
                <Section title="Tendencia del período">
                  <div style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-sm)',
                    borderLeft: `3px solid ${
                      data.calories.trend === 'improving' ? 'var(--color-success)'
                      : data.calories.trend === 'worsening' ? '#f59e0b'
                      : '#6366f1'
                    }`,
                    padding: '14px 16px',
                  }}>
                    <p style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>{trendText}</p>
                  </div>
                </Section>
              )}

            </>
          )}

          <div style={{ height: 32 }} />
        </div>
      </div>
    </>
  );
}
