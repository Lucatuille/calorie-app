import { useState, useEffect } from 'react';
import {
  BarChart, Bar,
  ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { projectWithAdjustment, daysToGoalWithAdjustment } from '../utils/projection';

const PERIOD_OPTIONS = [
  { value: 'week',   label: '7 días'  },
  { value: 'month',  label: '30 días' },
  { value: '90days', label: '90 días' },
];

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

function Section({ title, children, style = {} }) {
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
  const [loadError,       setLoadError]       = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  // Simulador "¿Y si...?" — ajuste de kcal/día
  const [kcalAdjust, setKcalAdjust] = useState(0);

  // Reset slider al cambiar de período o cerrar/abrir el modal
  useEffect(() => { setKcalAdjust(0); }, [period, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setData(null);
    setLoadError(false);
    api.getAdvancedAnalytics(period, token)
      .then(setData)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [isOpen, period, token]);

  // Base de proyección para el simulador (parámetros que vienen del backend)
  const projBase = data?.projection ? {
    current_weight:  data.weight?.current || 0,
    weighted_avg_cal: data.projection.projection_avg_cal || 0,
    tdee_effective:   data.projection.tdee_effective || 0,
    adherence_rate:   data.projection.adherence_rate || 0,
  } : null;

  // Los 3 escenarios recalculados por el slider (cada uno con su adherencia)
  //   Optimista:   adherencia 1.0 (perfecta)
  //   Realista:    adherencia actual del usuario
  //   Conservador: adherencia × 0.8 (20% peor)
  // Todos usan el kcalAdjust del slider, así el rango se mueve junto
  const baseAdh = projBase?.adherence_rate || 0.5;
  const mkScenarios = (days: number) => projBase ? {
    optimistic:   projectWithAdjustment(projBase, kcalAdjust, days, 1.0),
    realistic:    projectWithAdjustment(projBase, kcalAdjust, days, Math.max(0.1, baseAdh)),
    conservative: projectWithAdjustment(projBase, kcalAdjust, days, Math.max(0.1, baseAdh * 0.8)),
  } : null;

  const adjustedScenarios = projBase && data?.projection?.scenarios && projBase.weighted_avg_cal
    ? {
        '30d': mkScenarios(30),
        '60d': mkScenarios(60),
        '90d': mkScenarios(90),
      }
    : null;

  // Legacy shortcut — realista para compatibilidad con código existente
  const adjustedRealistic = adjustedScenarios
    ? {
        '30d': adjustedScenarios['30d']!.realistic,
        '60d': adjustedScenarios['60d']!.realistic,
        '90d': adjustedScenarios['90d']!.realistic,
      }
    : null;

  // Días al objetivo recalculado con el ajuste actual
  const adjustedDaysToGoal = projBase && data?.projection?.goal_weight && projBase.weighted_avg_cal
    ? daysToGoalWithAdjustment(projBase, kcalAdjust, data.projection.goal_weight)
    : data?.projection?.days_to_goal_realistic;

  // Projection chart data: historical weight (actual + trend) + 3 projected scenarios
  const projChartData = (() => {
    if (!data?.daily_data) return [];
    const weightPts = data.daily_data
      .filter(d => d.weight != null)
      .map(d => ({
        date: new Date(d.date + 'T12:00:00Z').toLocaleDateString('es', { day: 'numeric', month: 'short' }),
        actual: d.weight,                           // báscula real (protagonista)
        trend:  d.weight_smoothed ?? d.weight,      // tendencia suavizada (contexto)
      }));
    if (!weightPts.length || !data.projection?.scenarios) return weightPts;

    const { scenarios } = data.projection;
    // Cuando el slider está activo (o siempre si tenemos adjustedScenarios),
    // usar los valores recalculados en el frontend. Si no hay projBase, fallback al backend.
    const getValue = (scenario, day) => {
      if (adjustedScenarios?.[day]) return adjustedScenarios[day][scenario];
      return scenarios[scenario]?.[day];
    };
    const today = new Date();
    const fmt   = n => new Date(today.getTime() + n * 86400000).toLocaleDateString('es', { day: 'numeric', month: 'short' });
    const cw = data.weight.current;
    const mkRange = (a, b) => [Math.min(a, b), Math.max(a, b)];

    const makePoint = (day, days) => {
      const opt = getValue('optimistic', day);
      const rea = getValue('realistic', day);
      const con = getValue('conservative', day);
      return {
        date: fmt(days),
        optimistic: opt,
        realistic: rea,
        conservative: con,
        rangeBand: mkRange(opt, con),
      };
    };

    return [
      ...weightPts,
      { date: 'Hoy', actual: cw, optimistic: cw, realistic: cw, conservative: cw, rangeBand: [cw, cw] },
      makePoint('30d', 30),
      makePoint('60d', 60),
      makePoint('90d', 90),
    ];
  })();

  const adherenceColor = !data?.calories?.adherence_pct ? 'var(--text-2)'
    : data.calories.adherence_pct >= 70 ? 'var(--color-success)'
    : data.calories.adherence_pct >= 40 ? '#f59e0b'
    : '#ef4444';

  const trendText = (() => {
    const t = data?.calories?.trend, p = Math.abs(data?.calories?.trend_pct || 0);
    if (!t) return null;
    if (t === 'improving') return `¡Vas mejorando! Tu segunda mitad ha sido un ${p}% mejor`;
    if (t === 'worsening') return `Cuidado — tu segunda mitad ha sido un ${p}% peor`;
    return 'Muy consistente — tus hábitos son estables';
  })();

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

          {/* Error state */}
          {!loading && loadError && (
            <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--text-2)' }}>
              <p style={{ fontSize: 14, marginBottom: 12 }}>No se pudo cargar el análisis</p>
              <button
                onClick={() => { setLoadError(false); setLoading(true); api.getAdvancedAnalytics(period, token).then(setData).catch(() => setLoadError(true)).finally(() => setLoading(false)); }}
                style={{ background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >Reintentar</button>
            </div>
          )}

          {/* No data */}
          {!loading && !loadError && data && data.days_with_data === 0 && (
            <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--text-3)' }}>
              <p style={{ fontSize: 36, marginBottom: 12 }}>📊</p>
              <p style={{ fontWeight: 500 }}>No hay datos para este período</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>Empieza a registrar para ver el análisis</p>
            </div>
          )}

          {/* Data available */}
          {!loading && data && data.days_with_data > 0 && (
            <>

              {/* ── KPIs rápidos: adherencia + racha ── */}
              <Section title="Tu constancia">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <StatBox
                    label="Adherencia"
                    value={data.calories.adherence_pct != null ? `${data.calories.adherence_pct}%` : '—'}
                    sub={`${data.days_with_data} de ${data.total_days} días`}
                    valueColor={adherenceColor}
                  />
                  <StatBox
                    label="Racha más larga"
                    value={`${data.streaks.longest_in_period} ${data.streaks.longest_in_period === 1 ? 'día' : 'días'}`}
                    sub={data.streaks.current > 0 ? `🔥 ${data.streaks.current} seguidos ahora` : 'sin racha activa'}
                    valueColor={null}
                  />
                </div>
              </Section>

              {/* ── Semana vs Fin de Semana ── */}
              {data.weekday_weekend && (
                <Section title="Semana vs fin de semana">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div style={{
                      background: 'var(--surface)', borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-sm)', padding: '12px 14px',
                    }}>
                      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>Lun—Vie</p>
                      <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
                        {data.weekday_weekend.weekday.avg.toLocaleString()}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>kcal/día</p>
                      <p style={{ fontSize: 11, color: 'var(--color-success)', marginTop: 6, fontWeight: 500 }}>
                        {data.weekday_weekend.weekday.adherence_pct}% en objetivo
                      </p>
                    </div>
                    <div style={{
                      background: 'var(--surface)', borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-sm)', padding: '12px 14px',
                    }}>
                      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>Sáb—Dom</p>
                      <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
                        {data.weekday_weekend.weekend.avg.toLocaleString()}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>kcal/día</p>
                      <p style={{
                        fontSize: 11,
                        color: data.weekday_weekend.weekend.adherence_pct >= 60 ? 'var(--color-success)' : '#f59e0b',
                        marginTop: 6, fontWeight: 500,
                      }}>
                        {data.weekday_weekend.weekend.adherence_pct}% en objetivo
                      </p>
                    </div>
                  </div>
                  {data.weekday_weekend.extra_kcal_weekly > 0 && (
                    <div style={{
                      background: 'rgba(245,158,11,0.08)',
                      border: '0.5px solid rgba(245,158,11,0.25)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                    }}>
                      <p style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>
                        Tu fin de semana añade <strong>+{data.weekday_weekend.extra_kcal_weekly.toLocaleString()} kcal/semana</strong>
                      </p>
                      {data.weekday_weekend.kg_impact_monthly > 0.05 && (
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          Equivale a ~{data.weekday_weekend.kg_impact_monthly} kg/mes menos de progreso
                        </p>
                      )}
                    </div>
                  )}
                </Section>
              )}

              {/* ── Macro Gaps ── */}
              {data.macro_gaps && (
                <Section title="Tus macros">
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10, marginTop: -8 }}>
                    Diferencia entre tu media diaria y tus objetivos
                  </p>
                  <div style={{
                    background: 'var(--surface)', borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
                  }}>
                    {[
                      {
                        key: 'protein', label: 'Proteína', color: '#16a34a',
                        deficitTips: ['Una pechuga de pollo = +30g', '3 huevos = +18g', 'Un yogur griego = +15g'],
                        excessTips: ['Reduce porciones de carne', 'Cambia parte por verduras'],
                      },
                      {
                        key: 'carbs', label: 'Carbos', color: '#f59e0b',
                        deficitTips: ['Una fruta = +20g', 'Una rebanada de pan integral = +15g', 'Un puñado de arroz = +25g'],
                        excessTips: ['Reduce pasta/arroz a media ración', 'Cambia pan blanco por integral'],
                      },
                      {
                        key: 'fat', label: 'Grasa', color: '#4a90d9',
                        deficitTips: ['Un aguacate = +20g', 'Un puñado de nueces = +15g', 'Una cucharada de aceite = +12g'],
                        excessTips: ['Reduce aceite en cocción', 'Cambia quesos curados por frescos'],
                      },
                    ].map((m, i, arr) => {
                      const gap = data.macro_gaps[m.key];
                      if (!gap || gap.status === 'no_target') return null;

                      const isOnTarget = gap.status === 'on_target';
                      const isDeficit  = gap.status === 'deficit';

                      const statusColor = isOnTarget ? 'var(--color-success)'
                        : isDeficit ? 'var(--color-fat)' : '#f59e0b';

                      return (
                        <div key={m.key} style={{
                          padding: '14px',
                          borderBottom: i < arr.length - 1 ? '0.5px solid var(--border)' : 'none',
                        }}>
                          {/* Header: nombre + status */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {m.label}
                              </span>
                            </div>
                            <span style={{ fontSize: 11, color: statusColor, fontWeight: 500 }}>
                              {isOnTarget ? '✓ En objetivo'
                                : isDeficit ? `−${gap.diff_g}g`
                                : `+${gap.diff_g}g`}
                            </span>
                          </div>

                          {/* Barra visual: progreso vs objetivo */}
                          <div style={{ marginBottom: 8 }}>
                            <div style={{
                              height: 6, borderRadius: 99,
                              background: 'var(--border)', overflow: 'hidden',
                              position: 'relative',
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.min(100, (gap.avg_daily / gap.target) * 100)}%`,
                                background: m.color,
                                opacity: isOnTarget ? 1 : 0.7,
                                borderRadius: 99,
                                transition: 'width 0.6s',
                              }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                                {gap.avg_daily}g / día
                              </span>
                              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                                objetivo {gap.target}g
                              </span>
                            </div>
                          </div>

                          {/* Sugerencia accionable */}
                          {!isOnTarget && (
                            <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 6, lineHeight: 1.4 }}>
                              {isDeficit ? 'Para cubrir el déficit:' : 'Para ajustar:'}{' '}
                              <span style={{ color: 'var(--text-tertiary)', fontStyle: 'normal' }}>
                                {(isDeficit ? m.deficitTips : m.excessTips).join(' · ')}
                              </span>
                            </p>
                          )}
                        </div>
                      );
                    })}
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

              {/* ── Top comidas ── */}
              {data.top_foods?.length > 0 && (
                <Section title="Comidas más registradas">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {data.top_foods.map((f, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
                        padding: '8px 12px', border: '0.5px solid var(--border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, width: 18, flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>{f.times}×</span>
                          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>{f.avg_cal} kcal</span>
                        </div>
                      </div>
                    ))}
                  </div>
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
                      {/* Peso actual — báscula real del dashboard */}
                      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
                        <div style={{ height: 2, background: 'var(--color-success)' }} />
                        <div style={{ padding: '10px 10px 12px' }}>
                          <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5, fontFamily: 'var(--font-sans)' }}>Peso actual</p>
                          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-success)', lineHeight: 1, fontFamily: 'var(--font-sans)' }}>
                            {data.weight.current}
                          </p>
                          <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
                            kg{data.weight.smoothed_current != null && data.weight.smoothed_current !== data.weight.current
                              ? ` · tendencia ${data.weight.smoothed_current}`
                              : ''}
                          </p>
                        </div>
                      </div>
                      {/* Tasa semanal — color condicional segun objetivo, recalculada con slider */}
                      {(() => {
                        const cur = data.weight?.current;
                        // Si hay slider activo, calcular tasa desde adjustedRealistic
                        const rate = (adjustedRealistic && cur)
                          ? +(((adjustedRealistic['30d'] - cur) / (30 / 7)).toFixed(2))
                          : data.projection?.weekly_rate_realistic;
                        const goal = data.projection?.goal_weight;
                        // Verde si va hacia el objetivo, amber si va al reves
                        const wantsLoss = goal && cur && goal < cur;
                        const wantsGain = goal && cur && goal > cur;
                        let rateColor = 'var(--text-secondary)';
                        if (rate != null && Math.abs(rate) >= 0.05) {
                          if (wantsLoss && rate < 0) rateColor = 'var(--color-success)';
                          else if (wantsGain && rate > 0) rateColor = 'var(--color-success)';
                          else rateColor = '#f59e0b';
                        }
                        return (
                          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
                            <div style={{ height: 2, background: rateColor }} />
                            <div style={{ padding: '10px 10px 12px' }}>
                              <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5, fontFamily: 'var(--font-sans)' }}>Tasa semanal</p>
                              <p style={{ fontSize: 22, fontWeight: 700, color: rateColor, lineHeight: 1, fontFamily: 'var(--font-sans)' }}>
                                {rate != null
                                  ? `${rate > 0 ? '+' : ''}${rate}`
                                  : '—'}
                              </p>
                              <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>kg/sem</p>
                            </div>
                          </div>
                        );
                      })()}
                      {/* Días al objetivo — dark */}
                      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
                        <div style={{ height: 2, background: 'var(--text-primary)' }} />
                        <div style={{ padding: '10px 10px 12px' }}>
                          <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5, fontFamily: 'var(--font-sans)' }}>Días al objetivo</p>
                          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, fontFamily: 'var(--font-sans)' }}>
                            {adjustedDaysToGoal != null
                              ? adjustedDaysToGoal >= 730 ? '>2 años' : `~${adjustedDaysToGoal}`
                              : '—'}
                          </p>
                          <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>días</p>
                        </div>
                      </div>
                    </div>

                    {/* Pasado real (último mes) — separado de la proyección */}
                    {data.projection?.projection_real_change_kg != null && (
                      <div style={{
                        background: 'var(--surface-2)',
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 12px',
                        marginBottom: 10,
                      }}>
                        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                          Tu último mes
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          {(() => {
                            const realChange = data.projection.projection_real_change_kg;
                            const goal = data.projection?.goal_weight;
                            const cur  = data.weight?.current;
                            const wantsLoss = goal && cur && goal < cur;
                            // Color: verde si va hacia objetivo, amber si en contra
                            let changeColor = 'var(--text-secondary)';
                            if (Math.abs(realChange) >= 0.1) {
                              if (wantsLoss && realChange < 0) changeColor = 'var(--color-success)';
                              else if (!wantsLoss && realChange > 0) changeColor = 'var(--color-success)';
                              else changeColor = '#f59e0b';
                            }
                            return (
                              <span style={{ fontSize: 13, fontWeight: 600, color: changeColor, fontFamily: 'var(--font-sans)' }}>
                                {realChange > 0 ? '+' : ''}{realChange} kg
                              </span>
                            );
                          })()}
                          {data.projection?.projection_avg_cal && (
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                              · {data.projection.projection_avg_cal} kcal/día de media
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Mensaje contextual cuando hay contradicción pasado vs objetivo */}
                    {(() => {
                      const realChange = data.projection?.projection_real_change_kg;
                      const goal = data.projection?.goal_weight;
                      const cur  = data.weight?.current;
                      if (realChange == null || !goal || !cur) return null;
                      const wantsLoss = goal < cur;
                      const wantsGain = goal > cur;
                      const absChange = Math.abs(realChange);

                      // Solo mostrar si hay contradicción clara (>0.5 kg en la dirección equivocada)
                      const contradiction = (wantsLoss && realChange > 0.5) || (wantsGain && realChange < -0.5);
                      if (!contradiction) return null;

                      const headline = wantsLoss
                        ? `Has ganado ${absChange.toFixed(1)} kg este mes, pero tu objetivo es perder peso.`
                        : `Has perdido ${absChange.toFixed(1)} kg este mes, pero tu objetivo es ganar peso.`;

                      return (
                        <div style={{
                          background: 'rgba(245, 158, 11, 0.08)',
                          border: '0.5px solid rgba(245, 158, 11, 0.3)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '12px 14px',
                          marginBottom: 12,
                        }}>
                          <p style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 6, fontWeight: 600 }}>
                            Tu progreso no refleja tu objetivo
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 8 }}>
                            {headline} Esto puede deberse a:
                          </p>
                          <ul style={{
                            fontSize: 11, color: 'var(--text-secondary)',
                            lineHeight: 1.5, margin: '0 0 8px 16px', padding: 0,
                          }}>
                            <li>Subregistro calórico (aceite, salsas, bebidas, snacks no contados)</li>
                            <li>Días sin registrar o con registros incompletos</li>
                            <li>Fluctuaciones normales de agua, sal o ciclo</li>
                          </ul>
                          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                            Revisa tus registros recientes e intenta ser lo más preciso posible las próximas 2-3 semanas para ver una tendencia real.
                          </p>
                        </div>
                      );
                    })()}

                    {/* Pills: TDEE + Balance diario + Ventana de cálculo */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      {data.projection?.tdee_effective != null && (
                        <span
                          title={data.projection.tdee_calibrated
                            ? `TDEE calibrado con tu cambio de peso real (teórico: ${data.projection.tdee_theoretical} kcal)`
                            : 'TDEE teórico (aún sin datos suficientes para calibrar)'}
                          style={{
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-sans)',
                            background: 'var(--surface-2)',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            cursor: 'help',
                          }}
                        >
                          TDEE {data.projection.tdee_calibrated ? 'real' : 'teórico'}: {data.projection.tdee_effective} kcal
                        </span>
                      )}
                      {data.projection?.daily_deficit_theoretical != null && (() => {
                        // Balance: positivo = déficit (bajada), negativo = superávit (subida)
                        const balance = data.projection.daily_deficit_theoretical;
                        const isDeficit = balance > 50;
                        const isSurplus = balance < -50;
                        const label = isDeficit ? 'Déficit' : isSurplus ? 'Superávit' : 'Balance';
                        const color = isDeficit ? 'var(--color-success)' : isSurplus ? '#f59e0b' : 'var(--text-secondary)';
                        const value = Math.abs(Math.round(balance));
                        return (
                          <span
                            title="Diferencia diaria entre tu TDEE real y lo que comes en promedio"
                            style={{
                              fontSize: 11, color, fontFamily: 'var(--font-sans)',
                              background: 'var(--surface-2)', padding: '3px 8px',
                              borderRadius: 'var(--radius-full)', cursor: 'help', fontWeight: 500,
                            }}
                          >
                            {label}: {value} kcal/día
                          </span>
                        );
                      })()}
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 12, fontStyle: 'italic' }}>
                      Proyección basada en tus últimos {data.projection?.projection_window_days || 30} días
                    </p>

                    {/* Gráfico de proyección */}
                    {projChartData.length > 1 && (
                      <div style={{
                        background: 'var(--surface)', borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-md)', padding: '14px 10px 10px',
                        position: 'relative', marginBottom: 16,
                      }}>
                        {/* Leyenda horizontal arriba del chart — no tapa lineas */}
                        <div style={{
                          display: 'flex', flexWrap: 'wrap', gap: 12,
                          padding: '0 4px 10px',
                          justifyContent: 'center',
                        }}>
                          {[
                            { color: 'var(--text-primary)', label: 'Báscula', dash: false },
                            { color: 'var(--color-success)', label: 'Tendencia', dash: false },
                            { color: '#f59e0b', label: 'Realista',    dash: false },
                            { color: 'var(--color-success)', label: 'Optimista',   dash: true  },
                            { color: '#94a3b8', label: 'Conservador', dash: true  },
                          ].map(item => (
                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <svg width="16" height="6" viewBox="0 0 16 6" style={{ flexShrink: 0 }}>
                                {item.dash
                                  ? <line x1="0" y1="3" x2="16" y2="3" stroke={item.color} strokeWidth="1.5" strokeDasharray="3 2" />
                                  : <line x1="0" y1="3" x2="16" y2="3" stroke={item.color} strokeWidth="2" />
                                }
                              </svg>
                              <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>{item.label}</span>
                            </div>
                          ))}
                        </div>

                        <ResponsiveContainer width="100%" height={240}>
                          <ComposedChart data={projChartData} margin={{ top: 12, right: 16, bottom: 5, left: 0 }}>
                            <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                            <Tooltip
                              cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '3 3' }}
                              formatter={(v, name) => {
                                const labels = {
                                  actual: 'Báscula',
                                  trend: 'Tendencia',
                                  optimistic: 'Optimista',
                                  realistic: 'Realista',
                                  conservative: 'Conservador',
                                };
                                const num = typeof v === 'number' ? v.toFixed(1) : v;
                                return [`${num} kg`, labels[name] || name];
                              }}
                              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, padding: '8px 10px' }}
                              labelStyle={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}
                            />

                            {/* Rango entre optimista y conservador — area muy sutil */}
                            <Area
                              type="monotone"
                              dataKey="rangeBand"
                              fill="#f59e0b"
                              fillOpacity={0.07}
                              stroke="none"
                              connectNulls={false}
                              legendType="none"
                              isAnimationActive={false}
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

                            {/* Conservador — gris sutil, 1.25px, dash corto */}
                            <Line
                              type="monotone"
                              dataKey="conservative"
                              stroke="#94a3b8"
                              strokeWidth={1.25}
                              strokeDasharray="2 3"
                              strokeOpacity={0.75}
                              dot={false}
                              connectNulls={false}
                              legendType="none"
                              isAnimationActive={true}
                              animationDuration={200}
                              animationEasing="ease-out"
                            />
                            {/* Optimista — verde sutil, 1.25px, dash largo */}
                            <Line
                              type="monotone"
                              dataKey="optimistic"
                              stroke="var(--color-success)"
                              strokeWidth={1.25}
                              strokeDasharray="6 3"
                              strokeOpacity={0.75}
                              dot={false}
                              connectNulls={false}
                              legendType="none"
                              isAnimationActive={true}
                              animationDuration={200}
                              animationEasing="ease-out"
                            />
                            {/* Realista — amber, 2.5px sólida, PROTAGONISTA, anima con slider */}
                            <Line
                              type="monotone"
                              dataKey="realistic"
                              stroke="#f59e0b"
                              strokeWidth={2.5}
                              dot={{ r: 3.5, fill: '#f59e0b', strokeWidth: 0 }}
                              connectNulls={false}
                              legendType="none"
                              isAnimationActive={true}
                              animationDuration={200}
                              animationEasing="ease-out"
                            />
                            {/* Tendencia (peso ajustado EMA) — línea guía sutil bajo la báscula */}
                            <Line
                              type="monotone"
                              dataKey="trend"
                              stroke="var(--color-success, #16a34a)"
                              strokeWidth={1.5}
                              strokeOpacity={0.55}
                              connectNulls={false}
                              legendType="none"
                              dot={false}
                              activeDot={{ r: 4, fill: 'var(--color-success, #16a34a)' }}
                            />
                            {/* Báscula real — protagonista, negra gruesa, punto actual con halo */}
                            <Line
                              type="monotone"
                              dataKey="actual"
                              stroke="var(--text-primary, #111111)"
                              strokeWidth={2}
                              connectNulls={false}
                              legendType="none"
                              dot={(props) => {
                                const { cx, cy, payload } = props;
                                if (!cx || !cy) return null;
                                if (payload.date === 'Hoy') {
                                  return (
                                    <g key={`dot-hoy-${cx}-${cy}`}>
                                      <circle cx={cx} cy={cy} r={10} fill="var(--text-primary, #111111)" fillOpacity={0.1} />
                                      <circle cx={cx} cy={cy} r={5} fill="var(--text-primary, #111111)" />
                                    </g>
                                  );
                                }
                                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="var(--text-primary, #111111)" />;
                              }}
                              activeDot={{ r: 5, fill: '#111111' }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Simulador "¿Y si...?" — slider de kcal/día */}
                    {projBase && projBase.weighted_avg_cal > 0 && (
                      <div style={{
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-sm)',
                        padding: '14px 16px',
                        marginBottom: 16,
                      }}>
                        <p style={{
                          fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
                          textTransform: 'uppercase', color: 'var(--text-tertiary)',
                          fontFamily: 'var(--font-sans)', marginBottom: 4,
                        }}>
                          ¿Y si...?
                        </p>

                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                          marginBottom: 12, gap: 8,
                        }}>
                          <p style={{
                            fontSize: 13, color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-sans)', margin: 0, flex: 1, minWidth: 0,
                          }}>
                            Comes{' '}
                            <strong style={{ color: 'var(--text-primary)' }}>
                              {projBase.weighted_avg_cal + kcalAdjust} kcal/día
                            </strong>
                            {kcalAdjust !== 0 && (
                              <span style={{
                                marginLeft: 6,
                                color: kcalAdjust < 0 ? 'var(--color-success)' : '#f59e0b',
                                fontWeight: 600,
                              }}>
                                ({kcalAdjust > 0 ? '+' : ''}{kcalAdjust})
                              </span>
                            )}
                          </p>
                          {kcalAdjust !== 0 && (
                            <button
                              onClick={() => setKcalAdjust(0)}
                              style={{
                                background: 'none', border: 'none',
                                fontSize: 11, color: 'var(--text-tertiary)',
                                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                                textDecoration: 'underline', padding: 0,
                                flexShrink: 0,
                              }}
                            >
                              Reiniciar
                            </button>
                          )}
                        </div>

                        {/* Slider con marca en el centro (0) */}
                        <div style={{ position: 'relative' }}>
                          <input
                            type="range"
                            min={-400}
                            max={400}
                            step={25}
                            value={kcalAdjust}
                            onChange={e => setKcalAdjust(Number(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: '#f59e0b',
                              cursor: 'pointer',
                              position: 'relative',
                              zIndex: 1,
                            }}
                          />
                          {/* Marca visual en el centro (0) */}
                          <div style={{
                            position: 'absolute',
                            left: '50%', top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 2, height: 10,
                            background: 'var(--border)',
                            pointerEvents: 'none',
                            zIndex: 0,
                          }} />
                        </div>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          fontSize: 9, color: 'var(--text-tertiary)',
                          marginTop: 4, fontFamily: 'var(--font-sans)',
                        }}>
                          <span>−400 kcal</span>
                          <span style={{ fontWeight: kcalAdjust === 0 ? 600 : 400 }}>0</span>
                          <span>+400 kcal</span>
                        </div>
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
                          { key: 'realistic',    label: 'Realista',    sub: 'basado en tus hábitos', accentColor: '#f59e0b',              textColor: 'var(--text-primary)' },
                          { key: 'conservative', label: 'Conservador', sub: 'adherencia 20% menor',  accentColor: '#94a3b8',              textColor: 'var(--text-secondary)' },
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
                                      {(adjustedScenarios?.[t]
                                        ? adjustedScenarios[t][s.key]
                                        : data.projection.scenarios[s.key]?.[t]) ?? '—'} <span style={{ fontSize: 10, fontWeight: 400 }}>kg</span>
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
                    {adjustedDaysToGoal != null && data.projection?.goal_weight && (
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
                            {adjustedDaysToGoal >= 730
                              ? `A tu objetivo (${data.projection.goal_weight} kg) — más de 2 años al ritmo actual`
                              : `A tu objetivo (${data.projection.goal_weight} kg) le quedan ~${adjustedDaysToGoal} días`}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
                            {kcalAdjust !== 0 ? `con ${kcalAdjust > 0 ? '+' : ''}${kcalAdjust} kcal/día` : 'escenario realista'}
                          </p>
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
