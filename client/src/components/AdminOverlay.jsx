import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { key: 'overview',    label: '📊 Overview'   },
  { key: 'users',       label: '👥 Usuarios'   },
  { key: 'engagement',  label: '📈 Engagement' },
  { key: 'ai',          label: '🤖 IA & Uso'   },
];

const MEAL_LABELS = { breakfast: 'Desayuno', lunch: 'Comida', dinner: 'Cena', snack: 'Snack', other: 'Otro' };
const MEAL_COLORS = { breakfast: '#f59e0b', lunch: '#2d6a4f', dinner: '#6366f1', snack: '#f97316', other: '#94a3b8' };

function Skeleton({ h = 16 }) {
  return (
    <div style={{
      height: h, borderRadius: 8,
      background: 'linear-gradient(90deg, var(--border) 25%, var(--surface) 50%, var(--border) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  );
}

function KPICard({ label, value, sub, valueColor, accent }) {
  return (
    <div style={{
      background: accent ? 'rgba(45,106,79,0.07)' : 'var(--bg)',
      border: `1px solid ${accent ? 'rgba(45,106,79,0.3)' : 'var(--border)'}`,
      borderRadius: 12, padding: '14px 16px',
    }}>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontFamily: 'Instrument Serif', fontSize: 32, lineHeight: 1, color: valueColor || 'var(--text)' }}>
        {value ?? '—'}
      </p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// ── Tab 1: Overview ─────────────────────────────────────────

function TabOverview({ data, loading }) {
  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={80} /><Skeleton h={160} /><Skeleton h={100} /></div>;
  if (!data) return null;

  const { users, platform, daily_activity, alerts } = data;

  return (
    <>
      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
        <KPICard label="Total usuarios"   value={users.total}        accent />
        <KPICard label="Activos hoy"       value={users.active_today} sub={`${users.active_week} esta semana`} valueColor="var(--accent)" />
        <KPICard label="Nuevos 7 días"     value={users.new_last_7d}  valueColor="#10b981" />
        <KPICard label="Entradas BD"       value={platform.total_entries?.toLocaleString()} sub={`+${platform.entries_today} hoy`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
        <KPICard label="Media kcal plataforma" value={platform.avg_calories_7d ? `${platform.avg_calories_7d.toLocaleString()} kcal` : '—'} sub="últimos 7 días" />
        <KPICard label="Racha máxima"
          value={platform.max_streak ? `🔥 ${platform.max_streak.days}d` : '—'}
          sub={platform.max_streak?.user || null}
          valueColor="#e76f51"
        />
      </div>

      {/* Daily activity chart */}
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
        Actividad diaria (30 días)
      </p>
      {daily_activity?.length > 0 ? (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={daily_activity.map(d => ({
            date: new Date(d.date + 'T12:00:00Z').toLocaleDateString('es', { day: 'numeric', month: 'short' }),
            usuarios: d.active_users,
            entradas: d.entry_count,
          }))} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
            <Area type="monotone" dataKey="usuarios" stroke="#2d6a4f" fill="rgba(45,106,79,0.15)" strokeWidth={2} />
            <Area type="monotone" dataKey="entradas" stroke="#e76f51" fill="rgba(231,111,81,0.08)" strokeWidth={1.5} strokeDasharray="4 3" />
          </AreaChart>
        </ResponsiveContainer>
      ) : <p style={{ color: 'var(--text-3)', fontSize: 13, fontStyle: 'italic' }}>Sin actividad reciente</p>}

      {/* Alerts */}
      <div style={{ marginTop: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
          Alertas
        </p>
        {alerts?.length === 0 ? (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 13, color: '#10b981' }}>
            🟢 Todos los usuarios activos — sin alertas
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alerts.map(a => {
              const level = !a.days_inactive ? 'red' : a.days_inactive >= 14 ? 'red' : a.days_inactive >= 7 ? 'yellow' : 'green';
              const icon  = level === 'red' ? '🔴' : level === 'yellow' ? '🟡' : '🟢';
              return (
                <div key={a.user_id} style={{
                  padding: '8px 12px', borderRadius: 8, fontSize: 12,
                  background: level === 'red' ? 'rgba(231,111,81,0.07)' : 'rgba(233,196,106,0.07)',
                  border: `1px solid ${level === 'red' ? 'rgba(231,111,81,0.25)' : 'rgba(233,196,106,0.25)'}`,
                  color: 'var(--text-2)',
                }}>
                  {icon} <strong>{a.name}</strong> — {a.days_inactive != null ? `${a.days_inactive} días sin registrar` : 'nunca ha registrado'}
                  {a.last_entry && <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>(última vez: {a.last_entry})</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ── Tab 2: Usuarios ──────────────────────────────────────────

function TabUsers({ data, loading }) {
  const [sortKey,    setSortKey]    = useState('last_entry');
  const [sortDir,    setSortDir]    = useState(-1);
  const [expanded,   setExpanded]   = useState(null);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(-1); }
  };

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[...Array(4)].map((_, i) => <Skeleton key={i} h={44} />)}</div>;
  if (!data?.length) return <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No hay usuarios</p>;

  const sorted = [...data].sort((a, b) => {
    const va = a[sortKey] ?? '';
    const vb = b[sortKey] ?? '';
    if (va < vb) return sortDir;
    if (va > vb) return -sortDir;
    return 0;
  });

  const lastEntryColor = (d) => {
    if (!d) return '#ef4444';
    const days = Math.floor((Date.now() - new Date(d + 'T12:00:00Z').getTime()) / 86400000);
    if (days <= 1) return '#10b981';
    if (days <= 4) return '#f59e0b';
    return '#ef4444';
  };

  const Th = ({ k, label }) => (
    <th
      onClick={() => toggleSort(k)}
      style={{ padding: '8px 10px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', textAlign: 'left' }}
    >
      {label}{sortKey === k ? (sortDir === -1 ? ' ↓' : ' ↑') : ''}
    </th>
  );

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            <Th k="name"        label="Usuario"      />
            <Th k="created_at"  label="Registro"     />
            <Th k="last_entry"  label="Último acceso"/>
            <Th k="days_7d"     label="7d activos"   />
            <Th k="avg_cal_7d"  label="Kcal media"   />
          </tr>
        </thead>
        <tbody>
          {sorted.map(u => (
            <>
              <tr
                key={u.id}
                onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                style={{
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: expanded === u.id ? 'rgba(45,106,79,0.05)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <td style={{ padding: '10px 10px', fontWeight: 500 }}>
                  <p>{u.name}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-3)' }}>{u.email}</p>
                </td>
                <td style={{ padding: '10px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '—'}
                </td>
                <td style={{ padding: '10px', color: lastEntryColor(u.last_entry), fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {u.last_entry_relative || (u.last_entry ? u.last_entry : '—')}
                </td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <span style={{ fontWeight: 700, color: u.days_7d >= 5 ? '#10b981' : u.days_7d >= 3 ? '#f59e0b' : '#ef4444' }}>
                    {u.days_7d}/7
                  </span>
                </td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>
                  {u.avg_cal_7d ? `${u.avg_cal_7d.toLocaleString()}` : '—'}
                </td>
              </tr>
              {expanded === u.id && (
                <tr key={`exp-${u.id}`} style={{ background: 'var(--bg)' }}>
                  <td colSpan={5} style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, fontSize: 12 }}>
                      <div>
                        <p style={{ color: 'var(--text-3)', marginBottom: 2 }}>Peso / Objetivo</p>
                        <p style={{ fontWeight: 600 }}>{u.weight ?? '—'} kg → {u.goal_weight ?? '—'} kg</p>
                      </div>
                      <div>
                        <p style={{ color: 'var(--text-3)', marginBottom: 2 }}>Target kcal</p>
                        <p style={{ fontWeight: 600 }}>{u.target_calories ?? '—'} kcal</p>
                      </div>
                      {u.tdee && (
                        <div>
                          <p style={{ color: 'var(--text-3)', marginBottom: 2 }}>TDEE calculado</p>
                          <p style={{ fontWeight: 600 }}>{u.tdee} kcal</p>
                        </div>
                      )}
                      <div>
                        <p style={{ color: 'var(--text-3)', marginBottom: 2 }}>Días totales registrados</p>
                        <p style={{ fontWeight: 600 }}>{u.total_days}</p>
                      </div>
                      {u.top_food && (
                        <div>
                          <p style={{ color: 'var(--text-3)', marginBottom: 2 }}>Comida más registrada</p>
                          <p style={{ fontWeight: 600 }}>"{u.top_food.name}" ({u.top_food.count}×)</p>
                        </div>
                      )}
                      {u.supplements && (
                        <div style={{ gridColumn: 'span 2' }}>
                          <p style={{ color: 'var(--text-3)', marginBottom: 2 }}>Suplementos activos</p>
                          <p style={{ fontWeight: 600 }}>{u.supplements}</p>
                        </div>
                      )}
                    </div>
                    {/* 7-day activity grid */}
                    <div style={{ marginTop: 10 }}>
                      <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>Últimos 7 días</p>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[...Array(7)].map((_, i) => {
                          const d = new Date();
                          d.setUTCDate(d.getUTCDate() - (6 - i));
                          const dateStr = d.toISOString().split('T')[0];
                          const dayLabel = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][d.getUTCDay()];
                          return (
                            <div key={i} style={{ textAlign: 'center' }}>
                              <p style={{ fontSize: 9, color: 'var(--text-3)' }}>{dayLabel}</p>
                              <div style={{
                                width: 20, height: 20, borderRadius: 4, marginTop: 2,
                                background: 'var(--border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10,
                              }}>?</div>
                            </div>
                          );
                        })}
                      </div>
                      <p style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4 }}>
                        (Actividad exacta por día disponible en análisis avanzado por usuario)
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab 3: Engagement ────────────────────────────────────────

function TabEngagement({ data, loading }) {
  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={160} /><Skeleton h={120} /><Skeleton h={80} /></div>;
  if (!data) return null;

  const { meal_distribution, top_foods, heatmap, cohort_retention } = data;

  // Build heatmap grid: 4 weeks × 7 days
  const heatmapMap = Object.fromEntries((heatmap || []).map(r => [r.date, r.active_users]));
  const maxUsers = Math.max(...(heatmap || []).map(r => r.active_users), 1);
  const heatGrid = [];
  for (let w = 3; w >= 0; w--) {
    const row = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date();
      dt.setUTCDate(dt.getUTCDate() - w * 7 - (6 - d));
      const dateStr = dt.toISOString().split('T')[0];
      row.push({ date: dateStr, users: heatmapMap[dateStr] || 0 });
    }
    heatGrid.push(row);
  }

  const mealTotalCal = meal_distribution?.reduce((a, m) => a + m.total_cal, 0) || 1;

  return (
    <>
      {/* Meal distribution */}
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
        Distribución de comidas
      </p>
      {meal_distribution?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {meal_distribution.map(m => (
            <div key={m.meal_type} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>
                  {MEAL_LABELS[m.meal_type] || m.meal_type}
                </span>
                <span style={{ fontWeight: 700 }}>{m.pct}%</span>
              </div>
              <div style={{ height: 7, background: 'var(--border)', borderRadius: 99 }}>
                <div style={{
                  height: '100%', width: `${m.pct}%`,
                  background: MEAL_COLORS[m.meal_type] || '#94a3b8',
                  borderRadius: 99, transition: 'width 0.6s',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activity heatmap */}
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
        Heatmap de actividad
      </p>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
            <div key={d} style={{ width: 28, textAlign: 'center', fontSize: 9, color: 'var(--text-3)' }}>{d}</div>
          ))}
        </div>
        {heatGrid.map((row, wi) => (
          <div key={wi} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            {row.map(({ date, users }, di) => {
              const opacity = users === 0 ? 0 : 0.15 + (users / maxUsers) * 0.85;
              return (
                <div
                  key={di}
                  title={`${date}: ${users} usuario${users !== 1 ? 's' : ''}`}
                  style={{
                    width: 28, height: 22, borderRadius: 4,
                    background: users === 0 ? 'var(--border)' : `rgba(45,106,79,${opacity.toFixed(2)})`,
                  }}
                />
              );
            })}
          </div>
        ))}
        <p style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4 }}>Más oscuro = más usuarios activos ese día</p>
      </div>

      {/* Top foods */}
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
        Top comidas registradas
      </p>
      {top_foods?.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
          {top_foods.map((f, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-2)' }}>
                <span style={{ color: 'var(--text-3)', marginRight: 8 }}>{i + 1}.</span>
                {f.name}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--text-3)' }}>{f.count}×</span>
            </div>
          ))}
        </div>
      ) : <p style={{ color: 'var(--text-3)', fontSize: 13, fontStyle: 'italic', marginBottom: 24 }}>Sin datos de nombres de comidas</p>}

      {/* Cohort retention */}
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
        Retención por cohorte
      </p>
      {cohort_retention?.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Semana registro', 'Usuarios', 'D+7', 'D+14', 'D+30'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohort_retention.map(row => (
                <tr key={row.week} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px', color: 'var(--text-2)' }}>{row.week}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>{row.total}</td>
                  {[row.d7_pct, row.d14_pct, row.d30_pct].map((pct, i) => (
                    <td key={i} style={{ padding: '8px 10px', fontWeight: 600, color: pct == null ? 'var(--text-3)' : pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444' }}>
                      {pct != null ? `${pct}%` : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p style={{ color: 'var(--text-3)', fontSize: 13, fontStyle: 'italic' }}>Datos insuficientes para cohortes</p>}
    </>
  );
}

// ── Tab 4: IA & Uso ──────────────────────────────────────────

function TabAI({ data, loading }) {
  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={100} /><Skeleton h={80} /><Skeleton h={140} /></div>;
  if (!data) return null;

  const { photos, cost, monthly_breakdown, features } = data;

  return (
    <>
      {/* Photos + Cost KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
            Fotos analizadas
          </p>
          <p style={{ fontFamily: 'Instrument Serif', fontSize: 32, lineHeight: 1, color: 'var(--text)' }}>{photos.total}</p>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Esta semana: <strong style={{ color: 'var(--text-2)' }}>{photos.this_week}</strong></p>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Este mes: <strong style={{ color: 'var(--text-2)' }}>{photos.this_month}</strong></p>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Media/usuario: <strong style={{ color: 'var(--text-2)' }}>{photos.avg_per_user}</strong></p>
          </div>
        </div>
        <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '14px 16px' }}>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
            Coste estimado API
          </p>
          <p style={{ fontFamily: 'Instrument Serif', fontSize: 32, lineHeight: 1, color: '#6366f1' }}>
            ${cost.this_month?.toFixed(3)}
          </p>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Total acumulado: <strong style={{ color: 'var(--text-2)' }}>${cost.total?.toFixed(3)}</strong></p>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Por foto: <strong style={{ color: 'var(--text-2)' }}>{cost.per_photo != null ? `$${cost.per_photo}` : '—'}</strong></p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontStyle: 'italic' }}>Haiku 4.5: $0.80/$4.00 por MTok</p>
          </div>
        </div>
      </div>

      {/* Monthly breakdown */}
      {monthly_breakdown?.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
            Historial mensual
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 24 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Mes', 'Llamadas', 'Coste'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthly_breakdown.map(r => (
                <tr key={r.month} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px', color: 'var(--text-2)' }}>{r.month}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>{r.calls}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#6366f1' }}>${r.cost?.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Feature usage */}
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
        Uso por feature
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {['Feature', 'Usuarios', '% del total'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features?.map(f => (
            <tr key={f.feature} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '9px 10px', color: 'var(--text-2)' }}>{f.feature}</td>
              <td style={{ padding: '9px 10px', fontWeight: 700 }}>{f.users}/{f.total}</td>
              <td style={{ padding: '9px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${Math.round(f.users / f.total * 100)}%`, background: 'var(--accent)', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 12, minWidth: 32 }}>{Math.round(f.users / f.total * 100)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ── Main component ───────────────────────────────────────────

export default function AdminOverlay({ isOpen, onClose }) {
  const { token } = useAuth();
  const [activeTab,  setActiveTab]  = useState('overview');
  const [tabData,    setTabData]    = useState({});
  const [loading,    setLoading]    = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchTab = useCallback(async (tab) => {
    setLoading(prev => ({ ...prev, [tab]: true }));
    try {
      let data;
      if (tab === 'overview')   data = await api.getAdminOverview(token);
      if (tab === 'users')      data = await api.getAdminUsers(token);
      if (tab === 'engagement') data = await api.getAdminEngagement(token);
      if (tab === 'ai')         data = await api.getAdminAIStats(token);
      setTabData(prev => ({ ...prev, [tab]: data }));
      setLastUpdate(new Date());
    } catch (e) {
      console.error('Admin fetch error:', e);
    } finally {
      setLoading(prev => ({ ...prev, [tab]: false }));
    }
  }, [token]);

  // Load active tab when overlay opens or tab changes
  useEffect(() => {
    if (!isOpen) return;
    if (!tabData[activeTab]) fetchTab(activeTab);
  }, [isOpen, activeTab]);

  // Auto-refresh every 5 minutes when open
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => fetchTab(activeTab), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOpen, activeTab, fetchTab]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const relativeUpdateTime = lastUpdate
    ? (() => {
        const mins = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);
        return mins === 0 ? 'hace <1min' : `hace ${mins}min`;
      })()
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(4px)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.2s',
        }}
      />

      {/* Panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: isOpen ? 'auto' : 'none',
          padding: '16px',
        }}
      >
        <div style={{
          width: '100%',
          maxWidth: 900,
          maxHeight: '90vh',
          background: 'var(--surface)',
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: isOpen ? 'scale(1)' : 'scale(0.95)',
          opacity: isOpen ? 1 : 0,
          transition: 'transform 0.2s, opacity 0.2s',
        }}>

          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <h2 style={{ fontWeight: 700, fontSize: 17 }}>👑 LucaEats Admin</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {relativeUpdateTime && (
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {relativeUpdateTime}
                </span>
              )}
              <button
                onClick={() => fetchTab(activeTab)}
                title="Actualizar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16, padding: '4px 6px' }}
              >🔄</button>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 22, padding: '4px 8px', lineHeight: 1 }}
              >✕</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 2, padding: '10px 20px',
            borderBottom: '1px solid var(--border)',
            overflowX: 'auto',
            flexShrink: 0,
          }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                  background: activeTab === t.key ? 'var(--accent)' : 'transparent',
                  color: activeTab === t.key ? '#fff' : 'var(--text-3)',
                  transition: 'background 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
            {activeTab === 'overview'   && <TabOverview   data={tabData.overview}   loading={!!loading.overview}   />}
            {activeTab === 'users'      && <TabUsers       data={tabData.users}      loading={!!loading.users}      />}
            {activeTab === 'engagement' && <TabEngagement  data={tabData.engagement} loading={!!loading.engagement} />}
            {activeTab === 'ai'         && <TabAI          data={tabData.ai}         loading={!!loading.ai}         />}
          </div>
        </div>
      </div>
    </>
  );
}
