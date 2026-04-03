import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function WeightInput() {
  const { token } = useAuth();
  const [today, setToday]               = useState<number | null>(null);
  const [yesterday, setYesterday]       = useState<number | null>(null);
  const [lastRecorded, setLastRecorded] = useState<number | null>(null);
  const [editing, setEditing]           = useState(false);
  const [value, setValue]               = useState('');
  const [saving, setSaving]             = useState(false);
  const [loading, setLoading]           = useState(true);
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

  // Delta vs yesterday
  const prev = yesterday;
  let delta: string | null = null;
  let deltaColor = 'var(--text-secondary)';
  if (today && prev) {
    const diff = Math.round((today - prev) * 10) / 10;
    if (diff < -0.05) { delta = `↓${Math.abs(diff)}`; deltaColor = 'var(--accent)'; }
    else if (diff > 0.05) { delta = `↑${diff}`; deltaColor = 'var(--color-carbs)'; }
    else { delta = '—'; }
  }

  if (loading) return null;

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow)',
      padding: '8px 14px',
      display: 'inline-flex', alignItems: 'center', gap: 8,
    }}>
      {editing ? (
        <form
          onSubmit={e => { e.preventDefault(); handleSave(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span style={{ fontSize: 14 }}>⚖️</span>
          <input
            ref={inputRef}
            type="number"
            step="0.1"
            min="20"
            max="300"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={lastRecorded ? String(lastRecorded) : '70.0'}
            style={{
              width: 58, textAlign: 'center', fontWeight: 600,
              fontSize: 14, border: '1px solid var(--border)',
              borderRadius: 6, padding: '3px 4px',
              background: 'var(--bg)', color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)', outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>kg</span>
          <button
            type="submit"
            disabled={saving}
            style={{
              background: 'var(--accent)', color: 'white', border: 'none',
              borderRadius: 6, padding: '3px 10px',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >{saving ? '…' : '✓'}</button>
          <button
            type="button"
            onClick={() => { setEditing(false); setValue(today ? String(today) : ''); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-tertiary)', fontSize: 13, padding: 0, lineHeight: 1,
            }}
          >×</button>
        </form>
      ) : today ? (
        <button
          onClick={() => { setValue(String(today)); setEditing(true); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, padding: 0,
          }}
        >
          <span style={{ fontSize: 14 }}>⚖️</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
            {today}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>kg</span>
          {delta && (
            <span style={{ fontSize: 11, fontWeight: 600, color: deltaColor, fontFamily: 'var(--font-sans)' }}>
              {delta}
            </span>
          )}
        </button>
      ) : (
        <button
          onClick={() => { setValue(lastRecorded ? String(lastRecorded) : ''); setEditing(true); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, padding: 0,
          }}
        >
          <span style={{ fontSize: 14 }}>⚖️</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
            + Peso
          </span>
          {lastRecorded && (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', opacity: 0.5, fontFamily: 'var(--font-sans)' }}>
              {lastRecorded}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
