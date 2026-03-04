import { useState, useEffect } from 'react';
import {
  BarChart, Bar, Cell,
  ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

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
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 14 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function EmptyMsg({ text = 'Registra más días para ver este análisis' }) {
  return <p style={{ color: 'var(--text-3)', fontSize: 13, fontStyle: 'italic' }}>{text}</p>;
}

function StatBox({ label, value, sub, valueColor }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px' }}>
      <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontWeight: 700, fontSize: 22, lineHeight: 1.1, color: valueColor || 'inherit' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{sub}</p>}
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
    : data.calories.adherence_pct >= 70 ? '#10b981'
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
        background: 'var(--surface)',
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
          position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1,
        }}>
          <h2 style={{ fontWeight: 700, fontSize: 18 }}>Análisis detallado</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-3)', fontSize: 22, padding: '4px 8px', lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 6, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p.value}
              className={`btn btn-sm ${period === p.value ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
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
                              : Math.abs(c - userTarget) <= 250 ? '#2d6a4f'
                              : c > userTarget + 250 ? '#f59e0b'
                              : '#3b82f6';
                            return <Cell key={i} fill={color} fillOpacity={0.85} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                    <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12, fontStyle: 'italic' }}>
                      Tu {MEAL_LABELS[data.meals.most_calories_meal]?.toLowerCase()} representa la mayor parte de tus calorías
                    </p>
                  )}
                </Section>
              )}

              {/* ── Sección 3.5: Patrón calórico ── */}
              {data.projection?.calorie_variability_cv != null && (
                <Section title="Tu patrón calórico">
                  {(() => {
                    const cvPct = Math.round(data.projection.calorie_variability_cv * 100);
                    const cvColor = cvPct < 15 ? '#10b981' : cvPct <= 30 ? '#f59e0b' : '#ef4444';
                    const cvLabel = cvPct < 15 ? 'Muy consistente' : cvPct <= 30 ? 'Variabilidad normal' : 'Alta variabilidad';
                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
                          <p style={{ fontSize: 28, fontWeight: 700, color: cvColor, lineHeight: 1 }}>{cvPct}%</p>
                          <p style={{ fontSize: 13, color: cvColor }}>{cvLabel}</p>
                        </div>
                        {data.calories.days_in_target != null && (
                          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                            {[
                              { label: 'En objetivo', val: data.calories.days_in_target, color: '#10b981' },
                              { label: 'Por encima',  val: data.calories.days_over,       color: '#f59e0b' },
                              { label: 'Por debajo',  val: data.calories.days_under,      color: '#3b82f6' },
                            ].map(item => (
                              <div key={item.label} style={{ flex: 1, background: 'var(--bg)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                                <p style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.val}</p>
                                <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{item.label}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {calorieHistogram.length > 0 && (
                          <ResponsiveContainer width="100%" height={70}>
                            <BarChart data={calorieHistogram} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
                              <XAxis dataKey="range" tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} />
                              <Bar dataKey="count" fill="var(--accent)" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </>
                    );
                  })()}
                </Section>
              )}

              {/* ── Sección 4: Proyección de peso ── */}
              <Section title="📈 Proyección de peso">
                {data.weight?.current == null ? (
                  <EmptyMsg text="Registra tu peso en las entradas para ver proyecciones" />
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 24, marginBottom: 18, flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Peso actual</p>
                        <p style={{ fontFamily: 'Instrument Serif', fontSize: 30, color: 'var(--accent)', lineHeight: 1 }}>
                          {data.weight.current} kg
                        </p>
                      </div>
                      {data.projection?.weekly_rate_realistic != null && (
                        <div>
                          <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Tasa realista</p>
                          <p style={{
                            fontFamily: 'Instrument Serif', fontSize: 30, lineHeight: 1,
                            color: data.projection.weekly_rate_realistic < 0 ? 'var(--accent)' : 'var(--accent-2)',
                          }}>
                            {data.projection.weekly_rate_realistic > 0 ? '+' : ''}{data.projection.weekly_rate_realistic} kg/sem
                          </p>
                        </div>
                      )}
                    </div>

                    {projChartData.length > 1 && (
                      <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={projChartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
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
                          <Line type="monotone" dataKey="actual" stroke="var(--accent)" strokeWidth={2.5}
                            dot={{ r: 3, fill: 'var(--accent)' }} connectNulls={false} />
                          <Line type="monotone" dataKey="optimistic" stroke="#10b981" strokeWidth={1.5} strokeDasharray="6 4"
                            dot={false} connectNulls={false} strokeOpacity={0.75} />
                          <Line type="monotone" dataKey="realistic" stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 4"
                            dot={{ r: 4, fill: 'var(--accent)' }} connectNulls={false} strokeOpacity={0.7} />
                          <Line type="monotone" dataKey="conservative" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4"
                            dot={false} connectNulls={false} strokeOpacity={0.65} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}

                    {/* 3 Scenario cards */}
                    {data.projection?.scenarios && (
                      <div style={{ marginTop: 16 }}>
                        <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Escenarios a 30 / 60 / 90 días
                        </p>
                        {[
                          { key: 'optimistic',   icon: '🟢', label: 'Optimista',   sub: 'adherencia perfecta',   color: '#10b981', border: 'rgba(16,185,129,0.25)' },
                          { key: 'realistic',    icon: '🎯', label: 'Realista',    sub: 'basado en tus hábitos', color: 'var(--accent)', border: 'rgba(45,106,79,0.4)', highlight: true },
                          { key: 'conservative', icon: '🔵', label: 'Conservador', sub: 'adherencia 20% menor',  color: '#6366f1', border: 'rgba(99,102,241,0.25)' },
                        ].map(s => (
                          <div key={s.key} style={{
                            marginBottom: 8, padding: '12px 14px', borderRadius: 12,
                            background: s.highlight ? 'rgba(45,106,79,0.06)' : 'var(--bg)',
                            border: `1px solid ${s.border}`,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 600, color: s.color, marginBottom: 2 }}>{s.icon} {s.label}</p>
                                <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.sub}</p>
                              </div>
                              <div style={{ display: 'flex', gap: 12, textAlign: 'right' }}>
                                {['30d', '60d', '90d'].map(t => (
                                  <div key={t}>
                                    <p style={{ fontSize: 10, color: 'var(--text-3)' }}>{t === '30d' ? '30 días' : t === '60d' ? '60 días' : '90 días'}</p>
                                    <p style={{ fontWeight: 700, fontSize: 15, color: s.color }}>
                                      {data.projection.scenarios[s.key]?.[t] ?? '—'} kg
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Plateau banner */}
                    {data.projection?.plateau_prediction?.will_plateau && (
                      <div style={{
                        marginTop: 14, padding: '12px 14px', borderRadius: 10,
                        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
                      }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#d97706', marginBottom: 4 }}>
                          ⚠️ Plateau probable hacia el día {data.projection.plateau_prediction.estimated_day}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
                          {data.projection.plateau_prediction.reason}
                        </p>
                      </div>
                    )}

                    {/* Days to goal */}
                    {data.projection?.days_to_goal_realistic && data.projection?.goal_weight && (
                      <div style={{
                        marginTop: 12, padding: '12px 14px', borderRadius: 10,
                        background: 'rgba(45,106,79,0.08)', border: '1px solid rgba(45,106,79,0.2)',
                      }}>
                        <p style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                          🎯 A tu objetivo ({data.projection.goal_weight} kg) le quedan ~{data.projection.days_to_goal_realistic} días
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>escenario realista</p>
                      </div>
                    )}

                    {/* Collapsible explanation */}
                    <div style={{ marginTop: 14 }}>
                      <button
                        onClick={() => setShowExplanation(s => !s)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-3)', fontSize: 12, padding: 0,
                          display: 'flex', alignItems: 'center', gap: 4,
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

                    {/* Data quality bar */}
                    {data.projection?.data_quality_score != null && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
                          <span>Calidad del modelo</span>
                          <span>{Math.round(data.projection.data_quality_score * 100)}%</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--border)', borderRadius: 99 }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.round(data.projection.data_quality_score * 100)}%`,
                            background: data.projection.data_quality_score >= 0.7 ? '#10b981' : data.projection.data_quality_score >= 0.4 ? '#f59e0b' : '#ef4444',
                            borderRadius: 99, transition: 'width 0.6s',
                          }} />
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                          Mejora registrando peso y calorías más días
                        </p>
                      </div>
                    )}

                    {/* Confidence */}
                    {data.projection?.confidence && (() => {
                      const c = CONFIDENCE[data.projection.confidence];
                      return (
                        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12 }}>
                          {c.icon} <strong>Confianza {c.label.toLowerCase()}:</strong> {c.text}
                        </p>
                      );
                    })()}

                    {/* Scientific disclaimer */}
                    <p style={{
                      fontSize: 11, color: 'var(--text-3)', marginTop: 16, lineHeight: 1.5,
                      fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 12,
                    }}>
                      Las proyecciones son estimaciones orientativas basadas en tus datos actuales. El peso corporal fluctúa ±1-2 kg diariamente por agua y glucógeno — esto no refleja cambios reales en grasa. Consulta con un profesional de la salud para objetivos médicos.
                    </p>
                  </>
                )}
              </Section>

              {/* ── Sección 5: Tendencia ── */}
              {trendText && (
                <Section title="Tendencia del período">
                  <div style={{
                    padding: '14px 16px', borderRadius: 12,
                    background: data.calories.trend === 'improving' ? 'rgba(16,185,129,0.08)'
                      : data.calories.trend === 'worsening' ? 'rgba(245,158,11,0.08)'
                      : 'rgba(99,102,241,0.08)',
                    border: `1px solid ${
                      data.calories.trend === 'improving' ? 'rgba(16,185,129,0.25)'
                      : data.calories.trend === 'worsening' ? 'rgba(245,158,11,0.25)'
                      : 'rgba(99,102,241,0.25)'}`,
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
