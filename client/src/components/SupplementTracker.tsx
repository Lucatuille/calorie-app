import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { todayDate } from '../utils/supplements';
import SupplementManager from './SupplementManager';

export default function SupplementTracker() {
  const { token } = useAuth();
  const [supplements,    setSupplements]    = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [showManager,    setShowManager]    = useState(false);
  const [bouncingId,     setBouncingId]     = useState(null);
  const [lastFetchDate,  setLastFetchDate]  = useState('');

  async function fetchSupplements() {
    const date = todayDate();
    setLastFetchDate(date);
    try {
      const data = await api.getSupplementsToday(date, token);
      setSupplements(data);
    } catch { /* silent */ } finally { setLoading(false); }
  }

  useEffect(() => {
    fetchSupplements();
  }, [token]);

  // Refetch when app comes back to foreground and date changed
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        const today = todayDate();
        if (today !== lastFetchDate) fetchSupplements();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [lastFetchDate]);

  async function handleToggle(sup) {
    const newTaken = !sup.taken;

    // Optimistic update
    setSupplements(prev => prev.map(s => s.id === sup.id ? { ...s, taken: newTaken } : s));
    if (newTaken) {
      setBouncingId(sup.id);
      setTimeout(() => setBouncingId(null), 300);
    }

    try {
      await api.toggleSupplement(sup.id, { date: todayDate(), taken: newTaken }, token);
    } catch {
      // Revert on failure
      setSupplements(prev => prev.map(s => s.id === sup.id ? { ...s, taken: sup.taken } : s));
    }
  }

  const takenCount = supplements.filter(s => s.taken).length;
  const allDone    = supplements.length > 0 && takenCount === supplements.length;
  const count      = supplements.length;
  const columns    = count === 1 ? 1 : count === 2 ? 2 : 3;

  // Loading skeletons
  if (loading) {
    return (
      <div style={{ marginTop: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
          Suplementos
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: 80, borderRadius: 12,
              background: 'linear-gradient(90deg, var(--border) 25%, var(--surface) 50%, var(--border) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.4s infinite',
            }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginTop: 10 }}>
        {/* Section header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
            Suplementos
          </p>
          {supplements.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: allDone ? 'var(--color-success)' : 'var(--text-2)',
                transition: 'color 0.3s',
              }}>
                {takenCount}/{supplements.length}{allDone ? ' ✓' : ''}
              </span>
              <button
                onClick={() => setShowManager(true)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, color: 'var(--text-3)', padding: '2px 4px',
                }}
              >✏️</button>
            </div>
          )}
        </div>

        {/* Empty state */}
        {supplements.length === 0 ? (
          <button
            onClick={() => setShowManager(true)}
            style={{
              width: '100%', padding: '18px 0', borderRadius: 12,
              border: '2px dashed var(--border)',
              background: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              color: 'var(--text-3)', fontSize: 14, fontWeight: 500,
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)'; }}
          >
            <span style={{ fontSize: 18 }}>+</span> Añadir suplementos
          </button>
        ) : (
          /* Supplement grid */
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8 }}>
            {supplements.map(sup => (
              <button
                key={sup.id}
                onClick={() => handleToggle(sup)}
                style={{
                  height: 80, borderRadius: 12,
                  border: sup.taken ? '1px solid transparent' : '1px solid var(--border)',
                  background: sup.taken ? 'var(--accent)' : 'var(--bg)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 4,
                  position: 'relative', overflow: 'hidden',
                  transition: 'background-color 0.25s ease, color 0.2s ease, border-color 0.25s ease',
                }}
              >
                {/* Checkmark */}
                {sup.taken && (
                  <span style={{
                    position: 'absolute', top: 5, right: 7,
                    fontSize: 10, color: 'rgba(255,255,255,0.8)',
                    animation: 'fadeIn 0.2s ease',
                  }}>✓</span>
                )}

                {/* Emoji with bounce */}
                <span style={{
                  fontSize: 22, lineHeight: 1,
                  animation: bouncingId === sup.id ? 'emojiPop 0.25s ease' : 'none',
                  display: 'block',
                }}>
                  {sup.emoji}
                </span>

                {/* Name */}
                <span style={{
                  fontSize: 10, fontWeight: 600, lineHeight: 1.2,
                  color: sup.taken ? 'rgba(255,255,255,0.95)' : 'var(--text-2)',
                  textAlign: 'center', padding: '0 4px',
                  maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  transition: 'color 0.2s ease',
                }}>
                  {sup.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes emojiPop {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <SupplementManager
        isOpen={showManager}
        onClose={() => setShowManager(false)}
        onUpdate={fetchSupplements}
      />
    </>
  );
}
