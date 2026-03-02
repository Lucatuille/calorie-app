import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 13,
      boxShadow: 'var(--shadow-md)',
    }}>
      <p style={{ color: 'var(--text-3)', marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color, fontWeight: 500 }}>
          {p.name}: {p.value} {p.dataKey === 'weight' ? 'kg' : 'kcal'}
        </p>
      ))}
    </div>
  );
}

export default function Progress() {
  const { token } = useAuth();
  const [data,    setData]    = useState([]);
  const [summary, setSummary] = useState(null);
  const [days,    setDays]    = useState(30);
  const [loading, setLoading] = useState(true);

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

  const trendColor = summary?.weightTrend > 0 ? 'var(--accent-2)'
    : summary?.weightTrend < 0 ? 'var(--accent)' : 'var(--text-3)';

  const trendLabel = summary?.weightTrend > 0 ? `+${summary.weightTrend} kg` 
    : summary?.weightTrend != null ? `${summary.weightTrend} kg` : null;

  if (loading) return (
    <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div>
          <h1 className="title-xl" style={{ marginBottom: 4 }}>Progreso</h1>
          <p className="body-sm">Tu evolución en el tiempo</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 30, 90].map(d => (
            <button key={d}
              className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDays(d)}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="stat-grid stagger" style={{ marginBottom: 24 }}>
          <div className="stat-box">
            <div className="stat-label">Media calorías</div>
            <div className="stat-value">{summary.avgCalories?.toLocaleString() ?? '—'}</div>
            <div className="stat-unit">kcal/día</div>
          </div>
          {summary.weightTrend != null && (
            <div className="stat-box">
              <div className="stat-label">Variación peso</div>
              <div className="stat-value" style={{ color: trendColor }}>{trendLabel ?? '—'}</div>
              <div className="stat-unit">en {days} días</div>
            </div>
          )}
          {summary.adherence != null && (
            <div className="stat-box">
              <div className="stat-label">Adherencia</div>
              <div className="stat-value">{summary.adherence}%</div>
              <div className="stat-unit">días en objetivo</div>
            </div>
          )}
          <div className="stat-box">
            <div className="stat-label">Días registrados</div>
            <div className="stat-value">{summary.totalDaysLogged}</div>
            <div className="stat-unit">de {days}</div>
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>📊</p>
          <p style={{ color: 'var(--text-2)' }}>Aún no hay datos suficientes.</p>
          <p className="body-sm">Empieza a registrar tus días para ver tus gráficos aquí.</p>
        </div>
      ) : (
        <>
          {/* Calories chart */}
          <div className="card" style={{ marginBottom: 12 }}>
            <h2 className="title-md" style={{ marginBottom: 20 }}>Calorías diarias</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                {summary?.targetCalories && (
                  <ReferenceLine y={summary.targetCalories} stroke="var(--accent)" strokeDasharray="4 4"
                    label={{ value: 'Objetivo', fill: 'var(--accent)', fontSize: 11 }} />
                )}
                <Line type="monotone" dataKey="calories" name="Calorías"
                  stroke="var(--accent)" strokeWidth={2} dot={false}
                  activeDot={{ r: 4, fill: 'var(--accent)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Weight chart */}
          {data.some(d => d.weight) && (
            <div className="card">
              <h2 className="title-md" style={{ marginBottom: 20 }}>Evolución del peso</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.filter(d => d.weight)} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} domain={['auto','auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="weight" name="Peso"
                    stroke="var(--accent-2)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent-2)' }}
                    activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
