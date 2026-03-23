import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { MEAL_TYPES, getMeal } from '../utils/meals';
import PastMealRegistrar from '../components/PastMealRegistrar';

function formatDateParts(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const weekday = d.toLocaleDateString('es-ES', { weekday: 'long' });
  const rest    = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  return { weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1), rest };
}

function isToday(dateStr) {
  return dateStr === new Date().toISOString().split('T')[0];
}

function groupByDate(entries) {
  const groups = {};
  for (const e of entries) {
    if (!groups[e.date]) groups[e.date] = [];
    groups[e.date].push(e);
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

const EMPTY_FORM = {
  meal_type: 'other', name: '', calories: '',
  protein: '', carbs: '', fat: '', weight: '', notes: '',
};

const MACRO_META = [
  { key: 'protein', color: 'var(--color-protein)', label: 'P' },
  { key: 'carbs',   color: 'var(--color-carbs)',   label: 'C' },
  { key: 'fat',     color: 'var(--color-fat)',      label: 'G' },
];

export default function History() {
  const { token } = useAuth();
  const [entries,    setEntries]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [editingId,  setEditingId]  = useState(null);
  const [editForm,   setEditForm]   = useState(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [limit,      setLimit]      = useState(90);
  const [addingForDate, setAddingForDate] = useState(null);

  async function load(lim = limit) {
    setLoading(true);
    try {
      const data = await api.getAllEntries(lim, token);
      setEntries(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token]);

  function startEdit(entry) {
    setDeletingId(null);
    setEditingId(entry.id);
    setEditForm({
      meal_type: entry.meal_type || 'other',
      name:      entry.name      || '',
      calories:  entry.calories  || '',
      protein:   entry.protein   || '',
      carbs:     entry.carbs     || '',
      fat:       entry.fat       || '',
      weight:    entry.weight    || '',
      notes:     entry.notes     || '',
    });
  }

  async function saveEdit(id) {
    if (!editForm.calories) return;
    setSaving(true);
    try {
      await api.updateEntry(id, {
        meal_type: editForm.meal_type,
        name:      editForm.name     || null,
        calories:  parseInt(editForm.calories),
        protein:   parseFloat(editForm.protein) || null,
        carbs:     parseFloat(editForm.carbs)   || null,
        fat:       parseFloat(editForm.fat)     || null,
        weight:    parseFloat(editForm.weight)  || null,
        notes:     editForm.notes || null,
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
    const newLimit = limit + 90;
    setLimit(newLimit);
    load(newLimit);
  }

  const set = (k, v) => setEditForm(f => ({ ...f, [k]: v }));
  const groups = groupByDate(entries);

  if (loading && entries.length === 0) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  return (
    <section style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 40 }}>

      {/* ── Header ── */}
      <header style={{ padding: '20px 20px 20px' }}>
        <h1 className="page-title">Historial</h1>
      </header>

      {entries.length === 0 ? (
        <div style={{ padding: '0 16px' }}>
          <div className="card card-bordered" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
              Aún no hay entradas registradas.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          {groups.map(([date, dayEntries]) => {
            const dayTotal  = dayEntries.reduce((a, e) => a + (e.calories || 0), 0);
            const { weekday, rest } = formatDateParts(date);
            const today     = isToday(date);

            return (
              <div key={date} style={{ marginBottom: 20 }}>

                {/* ── Cabecera del día ── */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'baseline', padding: '0 4px', marginBottom: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 21, fontStyle: 'italic', fontWeight: 400,
                      color: today ? 'var(--accent)' : 'var(--text-primary)',
                    }}>
                      {today ? 'Hoy' : weekday}
                    </span>
                    {!today && (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
                        {rest}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 13, color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-sans)', fontWeight: 500,
                    }}>
                      {dayTotal.toLocaleString('es')} kcal
                    </span>
                    <button
                      onClick={() => setAddingForDate(date)}
                      aria-label="Añadir comida"
                      style={{
                        width: 22, height: 22, background: 'var(--accent)',
                        border: 'none', borderRadius: '50%', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}
                    >
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                        <path d="M4.5 1v7M1 4.5h7" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* ── Card del día — todas las comidas dentro ── */}
                <div className="card" style={{ overflow: 'hidden' }}>
                  {dayEntries.map((entry, i) => {
                    const meal       = getMeal(entry.meal_type);
                    const isEditing  = editingId  === entry.id;
                    const isDeleting = deletingId === entry.id;
                    const isLast     = i === dayEntries.length - 1;
                    const showDivider = !isLast && !isEditing && !(deletingId === dayEntries[i + 1]?.id);

                    return (
                      <div key={entry.id}>

                        {isEditing ? (
                          /* ── Inline edit ── */
                          <div style={{
                            padding: '14px 16px',
                            borderBottom: isLast ? 'none' : '0.5px solid var(--border)',
                            background: 'var(--surface-2)',
                          }}>
                            <form onSubmit={e => { e.preventDefault(); saveEdit(entry.id); }}>
                              <span className="section-label" style={{ marginBottom: 10 }}>
                                Editando
                              </span>

                              {/* Tipo de comida */}
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                                {MEAL_TYPES.map(m => {
                                  const isActive = editForm.meal_type === m.id;
                                  return (
                                    <button key={m.id} type="button"
                                      onClick={() => set('meal_type', m.id)}
                                      className={`pill pill--sm${isActive ? ' pill--active' : ''}`}
                                    >
                                      {m.label}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Nombre */}
                              <input
                                value={editForm.name}
                                onChange={e => set('name', e.target.value)}
                                placeholder="Nombre (opcional)"
                                className="input"
                                style={{ marginBottom: 8 }}
                              />

                              {/* Kcal + macros */}
                              <div className="macro-grid" style={{ marginBottom: 10 }}>
                                <div>
                                  <label className="form-label">kcal *</label>
                                  <input type="number" value={editForm.calories} onChange={e => set('calories', e.target.value)} required className="input" style={{ textAlign: 'center' }} />
                                </div>
                                {[
                                  { key: 'protein', label: 'Prot' },
                                  { key: 'carbs',   label: 'Carb' },
                                  { key: 'fat',     label: 'Grasa' },
                                ].map(({ key, label }) => (
                                  <div key={key}>
                                    <label className="form-label">{label}</label>
                                    <input type="number" value={editForm[key]} onChange={e => set(key, e.target.value)} className="input" style={{ textAlign: 'center' }} />
                                  </div>
                                ))}
                              </div>

                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  type="submit"
                                  disabled={saving}
                                  className="btn btn-primary"
                                  style={{ padding: '7px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                                >
                                  {saving ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Guardar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="btn btn-secondary"
                                  style={{ padding: '7px 16px', fontSize: 12 }}
                                >Cancelar</button>
                              </div>
                            </form>
                          </div>
                        ) : (
                          /* ── Vista normal ── */
                          <div>
                            <div style={{
                              display: 'flex', alignItems: 'center',
                              padding: '12px 16px',
                              borderBottom: showDivider ? '0.5px solid var(--border)' : 'none',
                              gap: 10,
                            }}>
                              {/* Info principal */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: 14, fontWeight: 500, color: 'var(--text-primary)',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  }}>
                                    {entry.name || meal.label}
                                  </span>
                                  {entry.name && (
                                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>
                                      {meal.label}
                                    </span>
                                  )}
                                </div>
                                {/* Macros inline */}
                                {(entry.protein > 0 || entry.carbs > 0 || entry.fat > 0) && (
                                  <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                                    {MACRO_META.map(m => entry[m.key] > 0 ? (
                                      <span key={m.key} style={{
                                        fontSize: 10, fontFamily: 'var(--font-sans)',
                                        color: 'var(--text-tertiary)',
                                        display: 'flex', alignItems: 'center', gap: 3,
                                      }}>
                                        <span style={{
                                          width: 5, height: 5, borderRadius: '50%',
                                          background: m.color, display: 'inline-block', flexShrink: 0,
                                        }} />
                                        {Math.round(entry[m.key])}g
                                      </span>
                                    ) : null)}
                                  </div>
                                )}
                                {entry.notes && (
                                  <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>
                                    {entry.notes}
                                  </p>
                                )}
                              </div>

                              {/* Calorías + acciones */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                <span style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                                  {entry.calories.toLocaleString('es')}
                                </span>
                                <button
                                  onClick={() => { setDeletingId(null); startEdit(entry); }}
                                  aria-label="Editar comida"
                                  className="icon-btn"
                                  style={{ padding: '2px 4px', fontSize: 11 }}
                                  title="Editar"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </button>
                                <button
                                  onClick={() => { setEditingId(null); setDeletingId(d => d === entry.id ? null : entry.id); }}
                                  aria-label="Eliminar comida"
                                  className="icon-btn"
                                  style={{ fontSize: 16, padding: '0 2px' }}
                                >×</button>
                              </div>
                            </div>

                            {/* Confirmación de borrar — expandida debajo de la fila */}
                            {isDeleting && (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '9px 16px',
                                borderTop: '0.5px solid var(--border)',
                                borderBottom: isLast ? 'none' : '0.5px solid var(--border)',
                              }}>
                                <span style={{
                                  flex: 1, fontSize: 12, color: 'var(--text-secondary)',
                                  fontFamily: 'var(--font-sans)',
                                }}>
                                  ¿Eliminar esta entrada?
                                </span>
                                <button
                                  onClick={() => confirmDelete(entry.id)}
                                  className="btn btn-primary"
                                  style={{ padding: '4px 12px', fontSize: 12, background: '#ef4444' }}
                                >Eliminar</button>
                                <button
                                  onClick={() => setDeletingId(null)}
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 12px', fontSize: 12 }}
                                >Cancelar</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {entries.length >= limit && (
            <button
              onClick={loadMore}
              disabled={loading}
              style={{
                width: '100%', background: 'none',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '11px',
                fontSize: 13, color: 'var(--text-secondary)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              {loading ? 'Cargando…' : 'Ver más entradas'}
            </button>
          )}
        </div>
      )}
      {addingForDate && (
        <PastMealRegistrar
          targetDate={addingForDate}
          onClose={(saved) => {
            setAddingForDate(null);
            if (saved) load();
          }}
        />
      )}
    </section>
  );
}
