import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { COMMON_SUPPLEMENTS, EMOJI_PICKER_OPTIONS } from '../utils/supplements';

export default function SupplementManager({ isOpen, onClose, onUpdate }) {
  const { token } = useAuth();
  const [supplements, setSupplements] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [newName,     setNewName]     = useState('');
  const [newEmoji,    setNewEmoji]    = useState('💊');
  const [nameError,   setNameError]   = useState('');
  const [addingId,    setAddingId]    = useState(null); // common supplement being added
  const [deletingId,  setDeletingId]  = useState(null);
  const [showPicker,  setShowPicker]  = useState(false);

  useEffect(() => {
    if (isOpen) fetchSupplements();
  }, [isOpen]);

  async function fetchSupplements() {
    setLoading(true);
    try {
      const data = await api.getSupplementsToday(new Date().toLocaleDateString('en-CA'), token);
      setSupplements(data);
    } catch { /* silent */ } finally { setLoading(false); }
  }

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) { setNameError('El nombre es obligatorio'); return; }
    if (supplements.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setNameError('Ya tienes un suplemento con este nombre'); return;
    }
    setNameError('');
    try {
      await api.addSupplement({ name: trimmed, emoji: newEmoji, order_index: supplements.length }, token);
      setNewName('');
      setNewEmoji('💊');
      await fetchSupplements();
      onUpdate?.();
    } catch (err) {
      setNameError(err.message || 'Error al añadir');
    }
  }

  async function handleAddCommon(sup) {
    setAddingId(sup.name);
    try {
      await api.addSupplement({ name: sup.name, emoji: sup.emoji, order_index: supplements.length }, token);
      await fetchSupplements();
      onUpdate?.();
    } catch (err) {
      if (!err.message?.includes('409') && !err.message?.includes('nombre')) {
        console.error(err);
      }
    } finally { setAddingId(null); }
  }

  async function handleDelete(sup) {
    try {
      await api.deleteSupplement(sup.id, token);
      setDeletingId(null);
      await fetchSupplements();
      onUpdate?.();
    } catch (err) { console.error(err); }
  }

  const existingNames = new Set(supplements.map(s => s.name.toLowerCase()));
  const availableCommon = COMMON_SUPPLEMENTS.filter(s => !existingNames.has(s.name.toLowerCase()));
  const atMax = supplements.length >= 20;

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 998,
        background: 'rgba(0,0,0,0.45)',
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'opacity 0.3s',
      }} />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999,
        maxWidth: 600, marginLeft: 'auto', marginRight: 'auto',
        background: 'var(--surface)',
        borderRadius: '20px 20px 0 0',
        maxHeight: '88vh', overflowY: 'auto',
        transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
      }}>
        {/* Handle */}
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px 12px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1,
        }}>
          <h2 style={{ fontWeight: 700, fontSize: 18 }}>Mis suplementos</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-3)', fontSize: 22, padding: '4px 8px', lineHeight: 1,
          }}>✕</button>
        </div>

        <div style={{ padding: '20px' }}>

          {/* Lista actual */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[1, 2].map(i => (
                <div key={i} style={{ height: 44, borderRadius: 10, background: 'var(--border)', opacity: 0.5 }} />
              ))}
            </div>
          ) : supplements.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', marginBottom: 20 }}>
              Aún no tienes suplementos configurados
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              {supplements.map(sup => (
                <div key={sup.id}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 10,
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 18 }}>{sup.emoji}</span>
                    <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{sup.name}</span>
                    <button
                      onClick={() => setDeletingId(d => d === sup.id ? null : sup.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '2px 4px', color: 'var(--text-3)' }}
                    >🗑️</button>
                  </div>

                  {/* Confirm delete */}
                  {deletingId === sup.id && (
                    <div style={{
                      padding: '10px 12px', background: 'rgba(193,18,31,0.06)',
                      border: '1px solid rgba(193,18,31,0.2)', borderRadius: 10,
                      marginTop: 4,
                    }}>
                      <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 8 }}>
                        ¿Eliminar {sup.name}? Se perderá el historial de este suplemento.
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-sm"
                          style={{ background: 'var(--danger)', color: 'white', border: 'none' }}
                          onClick={() => handleDelete(sup)}
                        >Eliminar</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDeletingId(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Suplementos frecuentes */}
          {availableCommon.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
                Suplementos frecuentes
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {availableCommon.map(sup => (
                  <button
                    key={sup.name}
                    className="btn btn-secondary btn-sm"
                    disabled={addingId === sup.name || atMax}
                    onClick={() => handleAddCommon(sup)}
                    style={{ fontSize: 13 }}
                  >
                    {addingId === sup.name
                      ? <span className="spinner" style={{ width: 12, height: 12 }} />
                      : `${sup.emoji} ${sup.name}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Formulario personalizado */}
          {atMax ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
              Has alcanzado el máximo de 20 suplementos
            </p>
          ) : (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
                Añadir personalizado
              </p>
              <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  {/* Emoji picker button */}
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setShowPicker(p => !p)}
                      style={{
                        width: 44, height: 44, borderRadius: 10, fontSize: 22,
                        background: 'var(--bg)', border: '1px solid var(--border)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >{newEmoji}</button>

                    {showPicker && (
                      <div style={{
                        position: 'absolute', bottom: '110%', left: 0, zIndex: 10,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 12, padding: 8,
                        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      }}>
                        {EMOJI_PICKER_OPTIONS.map(em => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => { setNewEmoji(em); setShowPicker(false); }}
                            style={{
                              width: 36, height: 36, borderRadius: 8, fontSize: 18,
                              background: newEmoji === em ? 'rgba(45,106,79,0.15)' : 'none',
                              border: 'none', cursor: 'pointer',
                            }}
                          >{em}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="field" style={{ flex: 1, margin: 0 }}>
                    <input
                      placeholder="Ej: Creatina, Proteína..."
                      maxLength={20}
                      value={newName}
                      onChange={e => { setNewName(e.target.value); setNameError(''); }}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary btn-sm" style={{ height: 44, flexShrink: 0 }}>
                    Añadir
                  </button>
                </div>

                {nameError && (
                  <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: -4 }}>{nameError}</p>
                )}
              </form>
            </div>
          )}

          {/* Botón cerrar */}
          <button
            className="btn btn-secondary btn-full"
            style={{ marginTop: 24 }}
            onClick={onClose}
          >Listo</button>

          <div style={{ height: 16 }} />
        </div>
      </div>
    </>
  );
}
