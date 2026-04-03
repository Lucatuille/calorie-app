import { usePageTitle } from '../hooks/usePageTitle';
import { useState, useEffect, lazy, Suspense } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ADHERENCE_TOLERANCE } from '../utils/constants';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
const AdvancedAnalytics = lazy(() => import('../components/AdvancedAnalytics'));

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)', border: '0.5px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12,
      fontFamily: 'var(--font-sans)', boxShadow: 'var(--shadow-md)',
    }}>
      <p style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color, fontWeight: 500 }}>
          {p.name}: {p.value} {p.dataKey === 'weight' ? 'kg' : 'kcal'}
        </p>
      ))}
    </div>
  );
}

// Macro stacked bar — sin recharts
function MacroBar({ protein, carbs, fat }) {
  const total = protein + carbs + fat;
  if (!total) return null;
  const pP = Math.round(protein / total * 100);
  const pC = Math.round(carbs   / total * 100);
  const pF = 100 - pP - pC;
  const segments = [
    { label: 'Proteína', pct: pP, color: 'var(--color-protein)' },
    { label: 'Carbos',   pct: pC, color: 'var(--color-carbs)' },
    { label: 'Grasa',    pct: pF, color: 'var(--color-fat)' },
  ];
  return (
    <div>
      {/* Bar */}
      <div style={{ display: 'flex', height: 8, borderRadius: 100, overflow: 'hidden', gap: 2 }}>
        {segments.map(s => s.pct > 0 && (
          <div key={s.label} style={{ flex: s.pct, background: s.color, borderRadius: 100 }} />
        ))}
      </div>
      {/* Labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 12 }}>
        {segments.map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 18, fontWeight: 600, color: s.color,
              fontFamily: 'var(--font-sans)', lineHeight: 1,
            }}>
              {s.pct}%
            </div>
            <div style={{
              fontSize: 9, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.5px',
              marginTop: 3, fontFamily: 'var(--font-sans)',
            }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Progress() {
  usePageTitle('Progreso');
  const { token } = useAuth();
  const [data,         setData]         = useState([]);
  const [summary,      setSummary]      = useState(null);
  const [days,         setDays]         = useState(7);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(false);
  const [retryKey,     setRetryKey]     = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    Promise.all([
      api.getChart(days, token),
      api.getSummary(token),
    ]).then(([chart, sum]) => {
      const formatted = chart.map(e => ({
        ...e,
        date: new Date(e.date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' }),
      }));
      setData(formatted);
      setSummary(sum.summary);
    }).catch(() => { setLoadError(true); })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, token, retryKey]);

  // Métricas del período
  const periodCalories = data.map(d => d.calories).filter(Boolean);
  const periodWeights  = data.map(d => d.weight).filter(Boolean);

  const periodAvgCal = periodCalories.length
    ? Math.round(periodCalories.reduce((a, b) => a + b, 0) / periodCalories.length)
    : null;

  const periodWeightTrend = periodWeights.length >= 2
    ? +((periodWeights[periodWeights.length - 1] - periodWeights[0]).toFixed(1))
    : null;

  const targetCal = summary?.targetCalories ?? null;
  const periodAdherence = (targetCal && periodCalories.length)
    ? Math.round(periodCalories.filter(c => Math.abs(c - targetCal) <= ADHERENCE_TOLERANCE).length / periodCalories.length * 100)
    : null;

  const trendLabel = periodWeightTrend != null
    ? `${periodWeightTrend > 0 ? '+' : ''}${periodWeightTrend} kg`
    : null;

  // Macros del período
  const macroPeriod = (() => {
    const withMacros = data.filter(d => d.protein || d.carbs || d.fat);
    if (!withMacros.length) return null;
    return {
      protein: withMacros.reduce((s, e) => s + (e.protein || 0), 0) * 4,
      carbs:   withMacros.reduce((s, e) => s + (e.carbs   || 0), 0) * 4,
      fat:     withMacros.reduce((s, e) => s + (e.fat     || 0), 0) * 9,
    };
  })();

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  if (loadError && data.length === 0) return (
    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12, fontFamily: 'var(--font-sans)' }}>
        No se pudo cargar el progreso
      </p>
      <button
        onClick={() => setRetryKey(k => k + 1)}
        style={{
          background: 'var(--text-primary)', color: 'var(--bg)', border: 'none',
          borderRadius: 'var(--radius-sm)', padding: '8px 20px',
          fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}
      >Reintentar</button>
    </div>
  );


  return (
    <section style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 40 }}>

      {/* ── Header ── */}
      <header style={{
        padding: '20px 20px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <h1 className="page-title">Progreso</h1>

        {/* Period pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`pill pill--lg${days === d ? ' pill--active' : ''}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </header>

      {/* ── 1. Stat grid 2×2 con celda dark ── */}
      {summary && (
        <div style={{ padding: '0 16px', marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

            {/* Media — dark, ancla de la composición */}
            <div style={{
              background: '#111111',
              borderRadius: 14,
              padding: 14,
            }}>
              <div style={{
                fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.4)', marginBottom: 6, fontFamily: 'var(--font-sans)', fontWeight: 600,
              }}>
                Media · {days}d
              </div>
              <div style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 28, color: 'white', lineHeight: 1,
              }}>
                {periodAvgCal?.toLocaleString('es') ?? '—'}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 3, fontFamily: 'var(--font-sans)' }}>
                kcal/día
              </div>
            </div>

            {/* Días registrados */}
            <div style={{
              background: 'var(--surface)',
              borderRadius: 14,
              padding: 14,
              boxShadow: 'var(--shadow-md)',
            }}>
              <div className="section-label" style={{ marginBottom: 6 }}>Días</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--text-primary)', lineHeight: 1 }}>
                {data.length}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, fontFamily: 'var(--font-sans)' }}>
                de {days}
              </div>
            </div>

            {/* Adherencia */}
            {periodAdherence != null && (
              <div style={{
                background: 'var(--surface)',
                borderRadius: 14,
                padding: 14,
                boxShadow: 'var(--shadow-md)',
              }}>
                <div className="section-label" style={{ marginBottom: 6 }}>Adherencia</div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontSize: 28, lineHeight: 1,
                  color: periodAdherence >= 70 ? 'var(--accent)' : periodAdherence >= 40 ? '#f59e0b' : 'var(--text-primary)',
                }}>
                  {periodAdherence}%
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, fontFamily: 'var(--font-sans)' }}>
                  objetivo ±250
                </div>
              </div>
            )}

            {/* Tendencia de peso */}
            {trendLabel && (
              <div style={{
                background: 'var(--surface)',
                borderRadius: 14,
                padding: 14,
                boxShadow: 'var(--shadow-md)',
              }}>
                <div className="section-label" style={{ marginBottom: 6 }}>Peso</div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontSize: 28, lineHeight: 1,
                  color: periodWeightTrend < 0 ? 'var(--accent)' : periodWeightTrend > 0 ? '#e76f51' : 'var(--text-primary)',
                }}>
                  {trendLabel}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, fontFamily: 'var(--font-sans)' }}>
                  en {days} días
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div style={{ padding: '0 16px' }}>
          <div className="card card-shadow" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
              Aún no hay datos suficientes. Empieza a registrar tus días.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ── 2. Calorías diarias ── */}
          <div style={{ padding: '0 16px', marginBottom: 10 }}>
            <div className="card card-padded card-shadow">
              <span className="section-label" style={{ marginBottom: 14 }}>
                Calorías diarias
              </span>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}
                    tickLine={false} axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}
                    tickLine={false} axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {targetCal && (
                    <ReferenceLine
                      y={targetCal}
                      stroke="var(--accent)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                      label={{ value: 'objetivo', fill: 'var(--accent)', fontSize: 10, fontFamily: 'var(--font-sans)' }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="calories"
                    name="Calorías"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: 'var(--accent)', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── 3. Distribución de macros ── */}
          {macroPeriod && (macroPeriod.protein + macroPeriod.carbs + macroPeriod.fat) > 0 && (
            <div style={{ padding: '0 16px', marginBottom: 10 }}>
              <div className="card card-padded card-shadow">
                <span className="section-label" style={{ marginBottom: 14 }}>
                  Distribución de macros · media del período
                </span>
                <MacroBar {...macroPeriod} />
              </div>
            </div>
          )}

          {/* ── 4. Evolución del peso ── */}
          {data.some(d => d.weight) && (
            <div style={{ padding: '0 16px', marginBottom: 10 }}>
              <div className="card card-padded card-shadow">
                <span className="section-label" style={{ marginBottom: 14 }}>
                  Evolución del peso
                </span>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart
                    data={data.filter(d => d.weight)}
                    margin={{ top: 5, right: 10, bottom: 0, left: -16 }}
                  >
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}
                      tickLine={false} axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}
                      tickLine={false} axisLine={false}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      name="Peso"
                      stroke="#e76f51"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#e76f51', strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 5. Análisis profundo — dark card, al final ── */}
      <div style={{ padding: '4px 16px 32px' }}>
        <button
          onClick={() => setShowAdvanced(true)}
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
              fontSize: 10, background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.6)', padding: '2px 8px',
              borderRadius: 'var(--radius-full)', fontWeight: 600,
              alignSelf: 'flex-start', fontFamily: 'var(--font-sans)',
              letterSpacing: '0.3px',
            }}>
              Pro
            </span>
            <span style={{
              fontSize: 15, fontWeight: 500, color: '#ffffff',
              fontFamily: 'var(--font-sans)', marginTop: 2,
            }}>
              Análisis profundo
            </span>
            <span style={{
              fontSize: 11, color: 'rgba(255,255,255,0.35)',
              fontFamily: 'var(--font-sans)', lineHeight: 1.4,
            }}>
              Proyección de peso · patrón calórico · tendencias por día
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
      </div>

      {showAdvanced && (
        <Suspense fallback={null}>
          <AdvancedAnalytics
            isOpen={showAdvanced}
            onClose={() => setShowAdvanced(false)}
            userTarget={summary?.targetCalories}
          />
        </Suspense>
      )}
    </section>
  );
}
