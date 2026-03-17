import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import AdvancedAnalytics from '../components/AdvancedAnalytics';

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
    { label: 'Proteína', pct: pP, color: 'var(--accent)' },
    { label: 'Carbos',   pct: pC, color: '#f59e0b' },
    { label: 'Grasa',    pct: pF, color: '#60a5fa' },
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
  const { token } = useAuth();
  const [data,         setData]         = useState([]);
  const [summary,      setSummary]      = useState(null);
  const [days,         setDays]         = useState(7);
  const [loading,      setLoading]      = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getChart(days, token),
      api.getSummary(token),
    ]).then(([chart, sum]) => {
      const formatted = chart.map(e => ({
        ...e,
        date: new Date(e.date).toLocaleDateString('es', { day: 'numeric', month: 'short' }),
      }));
      setData(formatted);
      setSummary(sum.summary);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [days, token]);

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
    ? Math.round(periodCalories.filter(c => Math.abs(c - targetCal) <= 250).length / periodCalories.length * 100)
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

  const cardStyle = {
    background: 'var(--surface)',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px 16px',
  };

  const sectionLabel = {
    fontSize: 9, color: 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.7px',
    fontWeight: 600, fontFamily: 'var(--font-sans)',
    display: 'block',
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 40 }}>

      {/* ── Header ── */}
      <div style={{
        padding: '20px 20px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 32, fontStyle: 'italic',
          fontWeight: 400, color: 'var(--text-primary)', margin: 0,
        }}>
          Progreso
        </h1>

        {/* Period pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: '5px 12px', borderRadius: 'var(--radius-full)',
              fontSize: 12, fontWeight: days === d ? 600 : 400,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
              border: `0.5px solid ${days === d ? 'var(--accent)' : 'var(--border)'}`,
              background: days === d ? 'rgba(45,106,79,0.1)' : 'transparent',
              color: days === d ? 'var(--accent)' : 'var(--text-secondary)',
            }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* ── 1. Hero stats ── */}
      {summary && (
        <div style={{ padding: '0 16px', marginBottom: 10 }}>
          <div style={cardStyle}>
            <span style={{ ...sectionLabel, marginBottom: 8 }}>
              Media · {days} días
            </span>

            {/* Hero izquierda + métricas derecha */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Número grande */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 52, fontStyle: 'italic',
                  fontWeight: 400, color: 'var(--text-primary)',
                  lineHeight: 1, letterSpacing: '-2px',
                }}>
                  {periodAvgCal?.toLocaleString('es') ?? '—'}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)', marginTop: 4,
                }}>
                  kcal/día de media
                </div>
              </div>

              {/* Métricas secundarias — columna derecha */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                borderLeft: '0.5px solid var(--border)',
                paddingLeft: 16, flexShrink: 0,
              }}>
                {periodAdherence != null && (
                  <div>
                    <div style={{ fontSize: 9, ...sectionLabel, marginBottom: 2 }}>Adherencia</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                      <span style={{
                        fontSize: 18, fontWeight: 600,
                        color: periodAdherence >= 70 ? 'var(--accent)' : periodAdherence >= 40 ? '#f59e0b' : 'var(--text-primary)',
                      }}>
                        {periodAdherence}%
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>objetivo</span>
                    </div>
                  </div>
                )}
                {trendLabel && (
                  <div>
                    <div style={{ fontSize: 9, ...sectionLabel, marginBottom: 2 }}>Peso</div>
                    <span style={{
                      fontSize: 18, fontWeight: 600,
                      color: periodWeightTrend < 0 ? 'var(--accent)' : periodWeightTrend > 0 ? '#e76f51' : 'var(--text-primary)',
                    }}>
                      {trendLabel}
                    </span>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 9, ...sectionLabel, marginBottom: 2 }}>Días</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                    <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{data.length}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>de {days}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div style={{ padding: '0 16px' }}>
          <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
              Aún no hay datos suficientes. Empieza a registrar tus días.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ── 2. Calorías diarias ── */}
          <div style={{ padding: '0 16px', marginBottom: 10 }}>
            <div style={cardStyle}>
              <span style={{ ...sectionLabel, marginBottom: 14, display: 'block' }}>
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
              <div style={cardStyle}>
                <span style={{ ...sectionLabel, marginBottom: 14, display: 'block' }}>
                  Distribución de macros · media del período
                </span>
                <MacroBar {...macroPeriod} />
              </div>
            </div>
          )}

          {/* ── 4. Evolución del peso ── */}
          {data.some(d => d.weight) && (
            <div style={{ padding: '0 16px', marginBottom: 10 }}>
              <div style={cardStyle}>
                <span style={{ ...sectionLabel, marginBottom: 14, display: 'block' }}>
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

      <AdvancedAnalytics
        isOpen={showAdvanced}
        onClose={() => setShowAdvanced(false)}
        userTarget={summary?.targetCalories}
      />
    </div>
  );
}
