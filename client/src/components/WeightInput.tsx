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
  let deltaText: string | null = null;
  let deltaArrow: string | null = null;
  let deltaColor = 'var(--text-secondary)';
  if (today && prev) {
    const diff = Math.round((today - prev) * 10) / 10;
    if (diff < -0.05) {
      deltaArrow = '↓';
      deltaText = String(Math.abs(diff));
      deltaColor = 'var(--accent)';
    } else if (diff > 0.05) {
      deltaArrow = '↑';
      deltaText = String(diff);
      deltaColor = '#ef4444';
    } else {
      deltaArrow = '—';
      deltaText = null;
    }
  }

  if (loading) return null;

  return (
    <div style={{ padding: '0 16px', marginBottom: 10 }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow)',
        padding: '8px 16px',
        display: 'flex', alignItems: 'center',
        minHeight: 40,
      }}>
        {editing ? (
          <form
            onSubmit={e => { e.preventDefault(); handleSave(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
          >
            <span style={{
              fontSize: 11, color: 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)', fontWeight: 500,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Peso
            </span>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={value}
              onChange={e => {
                const v = e.target.value.replace(',', '.');
                if (/^\d{0,3}\.?\d{0,1}$/.test(v)) setValue(v);
              }}
              placeholder={lastRecorded ? String(lastRecorded) : '70.0'}
              style={{
                width: 56, textAlign: 'center', fontWeight: 600,
                fontSize: 15, border: '1px solid var(--accent)',
                borderRadius: 6, padding: '3px 4px',
                background: 'var(--bg)', color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)', outline: 'none',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>kg</span>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: 'var(--accent)', color: 'white', border: 'none',
                borderRadius: 6, padding: '4px 12px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >{saving ? '…' : '✓'}</button>
            <button
              type="button"
              onClick={() => { setEditing(false); setValue(today ? String(today) : ''); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-tertiary)', fontSize: 14, padding: 0, lineHeight: 1,
              }}
            >×</button>
          </form>
        ) : today ? (
          <button
            onClick={() => { setValue(String(today)); setEditing(true); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, padding: 0, width: '100%',
            }}
          >
            <span style={{
              fontSize: 11, color: 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)', fontWeight: 500,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Peso
            </span>
            <span style={{
              fontSize: 15, fontWeight: 600,
              color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
            }}>
              {today} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>kg</span>
            </span>
            {deltaArrow && (
              <span style={{
                fontSize: 12, fontWeight: 600, color: deltaColor,
                fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 2,
              }}>
                {deltaArrow}{deltaText && <span style={{ fontSize: 11, fontWeight: 500 }}>{deltaText}</span>}
              </span>
            )}
          </button>
        ) : (
          <button
            onClick={() => { setValue(lastRecorded ? String(lastRecorded) : ''); setEditing(true); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, padding: 0, width: '100%',
            }}
          >
            <span style={{
              fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)',
            }}>
              + Añadir peso de hoy
            </span>
            {lastRecorded && (
              <span style={{
                fontSize: 11, color: 'var(--text-tertiary)',
                opacity: 0.5, fontFamily: 'var(--font-sans)',
              }}>
                (último: {lastRecorded} kg)
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
