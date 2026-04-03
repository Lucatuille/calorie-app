import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function WeightInput() {
  const { token } = useAuth();
  const [today, setToday]         = useState<number | null>(null);
  const [yesterday, setYesterday] = useState<number | null>(null);
  const [lastRecorded, setLastRecorded] = useState<number | null>(null);
  const [editing, setEditing]     = useState(false);
  const [value, setValue]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getWeightToday(token)
      .then(data => {
        setToday(data.today);
        setYesterday(data.yesterday);
        setLastRecorded(data.last_recorded);
        if (data.today) setValue(String(data.today));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  async function handleSave() {
    const kg = parseFloat(value);
    if (!kg || kg < 20 || kg > 300) return;
    setSaving(true);
    try {
      await api.saveWeight({ weight_kg: kg }, token);
      setYesterday(today ?? yesterday);
      setToday(kg);
      setEditing(false);
    } catch {} finally { setSaving(false); }
  }

  // Trend indicator
  const ref = today ?? lastRecorded;
  const prev = yesterday;
  let trend: '↓' | '↑' | '—' | null = null;
  if (today && prev) {
    const diff = today - prev;
    trend = diff < -0.05 ? '↓' : diff > 0.05 ? '↑' : '—';
  }

  const trendColor = trend === '↓' ? 'var(--accent)' : trend === '↑' ? 'var(--color-carbs)' : 'var(--text-secondary)';

  if (loading) return null;

  return (
    <div style={{
      padding: '0 16px', marginBottom: 10,
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        padding: '10px 16px',
        boxShadow: 'var(--shadow)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        minHeight: 42,
      }}>
        {editing ? (
          /* ── Inline edit mode ── */
          <form
            onSubmit={e => { e.preventDefault(); handleSave(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
              Peso hoy
            </span>
            <input
              ref={inputRef}
              type="number"
              step="0.1"
              min="20"
              max="300"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={ref ? String(ref) : '70.0'}
              style={{
                width: 72, textAlign: 'center', fontWeight: 600,
                fontSize: 15, border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '4px 6px',
                background: 'var(--bg)', color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)', outline: 'none',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>kg</span>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: 'var(--accent)', color: 'white', border: 'none',
                borderRadius: 'var(--radius-sm)', padding: '4px 12px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {saving ? '...' : '✓'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setValue(today ? String(today) : ''); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: 14, padding: '0 4px',
              }}
            >×</button>
          </form>
        ) : today ? (
          /* ── Logged state ── */
          <button
            onClick={() => { setValue(String(today)); setEditing(true); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: 0,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
              Peso hoy
            </span>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
              {today} kg
            </span>
            {trend && (
              <span style={{ fontSize: 13, color: trendColor, fontWeight: 500 }}>
                {trend}
              </span>
            )}
            {prev && trend !== '—' && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
                ({prev} kg ayer)
              </span>
            )}
          </button>
        ) : (
          /* ── Empty state ── */
          <button
            onClick={() => { setValue(lastRecorded ? String(lastRecorded) : ''); setEditing(true); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: 0,
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
              + Añadir peso de hoy
            </span>
            {lastRecorded && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', opacity: 0.6 }}>
                (último: {lastRecorded} kg)
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
