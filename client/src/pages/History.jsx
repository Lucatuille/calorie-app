import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const MACROS = [
  { key: 'protein', label: 'Prot',  chipClass: 'chip-protein' },
  { key: 'carbs',   label: 'Carb',  chipClass: 'chip-carbs'   },
  { key: 'fat',     label: 'Grasa', chipClass: 'chip-fat'     },
];

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

const EMPTY_FORM = { calories: '', protein: '', carbs: '', fat: '', weight: '', notes: '' };

export default function History() {
  const { token } = useAuth();
  const [entries,    setEntries]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [editingId,  setEditingId]  = useState(null);
  const [editForm,   setEditForm]   = useState(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [limit,      setLimit]      = useState(30);
  const [total,      setTotal]      = useState(0);

  async function load(lim = limit) {
    setLoading(true);
    try {
      const data = await api.getAllEntries(lim, token);
      setEntries(data);
      setTotal(data.length);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token]);

  function startEdit(entry) {
    setDeletingId(null);
    setEditingId(entry.id);
    setEditForm({
      calories: entry.calories || '',
      protein:  entry.protein  || '',
      carbs:    entry.carbs    || '',
      fat:      entry.fat      || '',
      weight:   entry.weight   || '',
      notes:    entry.notes    || '',
    });
  }

  async function saveEdit(id) {
    if (!editForm.calories) return;
    setSaving(true);
    try {
      await api.updateEntry(id, {
        calories: parseInt(editForm.calories),
        protein:  parseFloat(editForm.protein)  || null,
        carbs:    parseFloat(editForm.carbs)    || null,
        fat:      parseFloat(editForm.fat)      || null,
        weight:   parseFloat(editForm.weight)   || null,
        notes:    editForm.notes || null,
      }, token);
      setEditingId(null);
      load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function confirmDelete(id) {
    try {
      await api.deleteEntry(id, token);
      setDeletingId(null);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (e) { console.error(e); }
  }

  async function loadMore() {
    const newLimit = limit + 30;
    setLimit(newLimit);
    load(newLimit);
  }

  const set = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  if (loading && entries.length === 0) return (
    <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  return (
    <div className="page stagger">
      <div style={{ marginBottom: 28 }}>
        <h1 className="title-xl" style={{ marginBottom: 4 }}>Historial</h1>
        <p className="body-sm">Todas tus entradas — edita o elimina si te equivocaste</p>
      </div>

      {entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>📋</p>
          <p style={{ color: 'var(--text-2)' }}>Aún no hay entradas registradas.</p>
          <p className="body-sm">Empieza registrando tu primer día.</p>
        </div>
      ) : (
        <>
          {entries.map(entry => (
            <div key={entry.id} className="card" style={{ marginBottom: 10 }}>

              {editingId === entry.id ? (
                /* ── Inline edit form ── */
                <form onSubmit={e => { e.preventDefault(); saveEdit(entry.id); }}>
                  <p className="muted" style={{ marginBottom: 12, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Editando — {formatDate(entry.date)}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
                    <div className="field">
                      <label>Calorías *</label>
                      <input type="number" value={editForm.calories} onChange={e => set('calories', e.target.value)} required />
                    </div>
                    <div className="field">
                      <label>Proteína (g)</label>
                      <input type="number" value={editForm.protein} onChange={e => set('protein', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Carbos (g)</label>
                      <input type="number" value={editForm.carbs} onChange={e => set('carbs', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Grasa (g)</label>
                      <input type="number" value={editForm.fat} onChange={e => set('fat', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Peso (kg)</label>
                      <input type="number" step="0.1" value={editForm.weight} onChange={e => set('weight', e.target.value)} />
                    </div>
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Notas</label>
                    <input value={editForm.notes} onChange={e => set('notes', e.target.value)} placeholder="Opcional..." />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
                      {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Guardar'}
                    </button>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditingId(null)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                /* ── Display mode ── */
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p className="muted" style={{ marginBottom: 4, textTransform: 'capitalize' }}>
                        {formatDate(entry.date)}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>
                          {entry.calories.toLocaleString()}
                        </span>
                        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>kcal</span>
                        {entry.weight && (
                          <span style={{ color: 'var(--text-3)', fontSize: 13, marginLeft: 4 }}>
                            · {entry.weight} kg
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setDeletingId(null); startEdit(entry); }}
                        style={{ fontSize: 12 }}
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setEditingId(null); setDeletingId(d => d === entry.id ? null : entry.id); }}
                        style={{ color: 'var(--text-3)', fontSize: 14, padding: '7px 10px' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Macro chips */}
                  {(entry.protein || entry.carbs || entry.fat) && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                      {MACROS.map(m => entry[m.key] ? (
                        <div key={m.key} className={`macro-chip ${m.chipClass}`} style={{ fontSize: 11 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0, opacity: 0.7 }} />
                          <span style={{ fontWeight: 700 }}>{Math.round(entry[m.key])}g</span>
                          <span style={{ opacity: 0.7 }}>{m.label}</span>
                        </div>
                      ) : null)}
                    </div>
                  )}

                  {/* Notes */}
                  {entry.notes && (
                    <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-2)', fontStyle: 'italic' }}>
                      {entry.notes}
                    </p>
                  )}

                  {/* Delete confirm */}
                  {deletingId === entry.id && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
                      padding: '10px 12px', background: 'rgba(193,18,31,0.06)',
                      borderRadius: 8, flexWrap: 'wrap',
                    }}>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--danger)' }}>
                        ¿Eliminar esta entrada?
                      </span>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--danger)', color: 'white', border: 'none' }}
                        onClick={() => confirmDelete(entry.id)}
                      >
                        Eliminar
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setDeletingId(null)}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {total === limit && (
            <button
              className="btn btn-secondary btn-full"
              style={{ marginTop: 4 }}
              onClick={loadMore}
              disabled={loading}
            >
              {loading ? 'Cargando...' : 'Cargar más'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
