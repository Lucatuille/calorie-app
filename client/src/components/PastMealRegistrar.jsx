// ============================================================
//  PastMealRegistrar — Add meals for past dates from History
//  Independent from Calculator.jsx to avoid regressions.
//  Reuses TextAnalyzer and BarcodeScanner components.
// ============================================================

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { MEAL_TYPES } from '../utils/meals';
import TextAnalyzer from './TextAnalyzer';
import BarcodeScanner from './BarcodeScanner';

function formatTargetDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

const METHODS = [
  { key: 'photo', label: 'Foto IA' },
  { key: 'scan',  label: 'Escanear' },
  { key: 'text',  label: 'Describir' },
];

const inputStyle = {
  width: '100%', background: 'var(--surface)',
  border: '0.5px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 10px', fontSize: 13,
  color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
  outline: 'none', boxSizing: 'border-box',
};

const CONFIDENCE_STYLE = {
  alta:  { bg: 'rgba(16,185,129,0.1)',  color: '#059669' },
  media: { bg: 'rgba(245,158,11,0.1)', color: '#d97706' },
  baja:  { bg: 'rgba(193,18,31,0.1)',  color: '#ef4444' },
};

export default function PastMealRegistrar({ targetDate, onClose }) {
  const { token } = useAuth();

  const [method,  setMethod]  = useState('photo');
  const [form,    setForm]    = useState({
    meal_type: 'other', name: '', calories: '',
    protein: '', carbs: '', fat: '', notes: '',
  });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [saved,   setSaved]   = useState(false);

  // Photo state
  const [photoPreview,   setPhotoPreview]   = useState(null);
  const [photoData,      setPhotoData]      = useState(null);
  const [photoContext,   setPhotoContext]    = useState('');
  const [photoLocation,  setPhotoLocation]  = useState(null);
  const [photoPlateSize, setPhotoPlateSize] = useState(null);
  const [analyzing,      setAnalyzing]      = useState(false);
  const [aiResult,       setAiResult]       = useState(null);
  const [aiLimitData,    setAiLimitData]    = useState(null);
  const fileRef = useRef(null);
  const photoAnalysisRef = useRef(null);

  // Sub-component state
  const [scannerOpen,      setScannerOpen]      = useState(false);
  const [textAnalyzerOpen, setTextAnalyzerOpen] = useState(false);
  const [scanFeedback,     setScanFeedback]     = useState(false);

  if (!targetDate) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const dateLabel = formatTargetDate(targetDate);

  // ── Photo handling (same as Calculator) ────────────────────
  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const original = reader.result;
      setPhotoPreview(original);
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else                { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        setPhotoData({ base64: compressed.split(',')[1], mediaType: 'image/jpeg' });
      };
      img.src = original;
      setAiResult(null);
      setPhotoContext('');
      setPhotoLocation(null);
      setPhotoPlateSize(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleAnalyze() {
    if (!photoData) return;
    setAnalyzing(true);
    setAiResult(null);
    try {
      const result = await api.analyzePhoto({
        image:            photoData.base64,
        mediaType:        photoData.mediaType,
        context:          photoContext.trim(),
        meal_type:        form.meal_type,
        photo_location:   photoLocation  || undefined,
        photo_plate_size: photoPlateSize || undefined,
        date:             targetDate,
      }, token);
      setAiResult(result);
    } catch (err) {
      if (err.data?.error === 'ai_limit_reached') {
        setAiLimitData(err.data);
      } else {
        setAiResult({ error: err.data?.message || err.message });
      }
    } finally { setAnalyzing(false); }
  }

  function applyAiResult(overrideCalories) {
    if (!aiResult || aiResult.error) return;
    const calories = overrideCalories ?? aiResult.calories;
    setForm(f => ({
      ...f,
      name:     aiResult.name     || f.name,
      calories: calories          ? String(calories)          : f.calories,
      protein:  aiResult.protein  ? String(aiResult.protein)  : f.protein,
      carbs:    aiResult.carbs    ? String(aiResult.carbs)    : f.carbs,
      fat:      aiResult.fat      ? String(aiResult.fat)      : f.fat,
    }));
    photoAnalysisRef.current = {
      ai_raw:        aiResult.ai_raw || aiResult.calories,
      ai_calibrated: aiResult.calories,
      categories:    aiResult.categories || [],
      has_context:   photoContext.trim().length > 0 || !!photoLocation || !!photoPlateSize,
      name:          aiResult.name,
    };
    setPhotoPreview(null);
    setPhotoData(null);
    setPhotoContext('');
    setPhotoLocation(null);
    setPhotoPlateSize(null);
    setAiResult(null);
  }

  // ── Text result handler ────────────────────────────────────
  function handleTextResult(r) {
    setForm(f => ({
      ...f,
      name:     r.name     || f.name,
      calories: r.calories ? String(r.calories) : f.calories,
      protein:  r.protein  ? String(r.protein)  : f.protein,
      carbs:    r.carbs    ? String(r.carbs)    : f.carbs,
      fat:      r.fat      ? String(r.fat)      : f.fat,
    }));
    if (r._ai) {
      photoAnalysisRef.current = {
        ai_raw:        r._ai.ai_raw,
        ai_calibrated: r._ai.ai_calibrated,
        categories:    r._ai.categories,
        has_context:   true,
        name:          r.name,
      };
    }
    setScanFeedback(true);
    setTimeout(() => setScanFeedback(false), 3000);
  }

  // ── Barcode result handler ─────────────────────────────────
  function handleAddScannedProduct(product, nutrition) {
    const name = product.brand ? `${product.name} (${product.brand})` : product.name;
    setForm(f => ({
      ...f, name,
      calories: nutrition.calories != null ? String(nutrition.calories) : f.calories,
      protein:  nutrition.protein  != null ? String(nutrition.protein)  : f.protein,
      carbs:    nutrition.carbs    != null ? String(nutrition.carbs)    : f.carbs,
      fat:      nutrition.fat      != null ? String(nutrition.fat)      : f.fat,
    }));
    setScanFeedback(true);
    setTimeout(() => setScanFeedback(false), 3000);
  }

  // ── Save entry with target date ────────────────────────────
  async function handleSave(e) {
    e.preventDefault();
    if (!form.calories) { setError('Las calorías son obligatorias'); return; }
    setError(''); setSaving(true);
    const finalCalories = parseInt(form.calories);
    const finalMealType = form.meal_type;
    const finalName     = form.name;
    try {
      const entry = await api.saveEntry({
        meal_type: finalMealType,
        name:      finalName     || null,
        calories:  finalCalories,
        protein:   parseFloat(form.protein) || null,
        carbs:     parseFloat(form.carbs)   || null,
        fat:       parseFloat(form.fat)     || null,
        notes:     form.notes || null,
        date:      targetDate,
      }, token);
      if (photoAnalysisRef.current) {
        const pa = photoAnalysisRef.current;
        api.saveAiCorrection({
          entry_id:                entry.id,
          ai_raw:                  pa.ai_raw,
          ai_calibrated:           pa.ai_calibrated,
          user_final:              finalCalories,
          food_categories:         pa.categories,
          meal_type:               finalMealType,
          meal_name:               finalName || pa.name,
          has_context:             pa.has_context,
          accepted_without_change: finalCalories === pa.ai_calibrated,
        }, token).catch(() => {});
        photoAnalysisRef.current = null;
      }
      setSaved(true);
      setTimeout(() => onClose(true), 1200);
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  const LOCATION_OPTIONS = [
    { key: 'casa',       label: 'Casa' },
    { key: 'restaurante', label: 'Restaurante' },
    { key: 'takeaway',   label: 'Takeaway' },
    { key: 'fastfood',   label: 'Fast food' },
  ];

  const PLATE_OPTIONS = [
    { key: 'small',  label: 'Pequeño' },
    { key: 'normal', label: 'Normal' },
    { key: 'large',  label: 'Grande' },
    { key: 'bowl',   label: 'Bol' },
  ];

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(false); }}
    >
      <div style={{
        width: '100%', maxWidth: 520, margin: '0 auto',
        background: 'var(--bg)',
        borderRadius: '20px 20px 0 0',
        padding: '0 0 env(safe-area-inset-bottom, 16px)',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border)' }} />
        </div>

        <div style={{ padding: '0 20px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              Añadir comida
            </h3>
            <button
              onClick={() => onClose(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18,
                       color: 'var(--text-tertiary)', lineHeight: 1, padding: 4 }}
            >✕</button>
          </div>

          {/* Date banner */}
          <p style={{
            fontSize: 13, color: 'var(--accent)', fontWeight: 500,
            margin: '0 0 16px', fontFamily: 'var(--font-sans)',
          }}>
            {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
          </p>

          {/* Success feedback */}
          {saved && (
            <div style={{
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 10, padding: '12px 16px', textAlign: 'center',
              fontSize: 14, color: '#059669', fontWeight: 600, marginBottom: 16,
            }}>
              Comida guardada
            </div>
          )}

          {!saved && (
            <form onSubmit={handleSave}>
              {/* Method tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                {METHODS.map(m => {
                  const active = method === m.key;
                  return (
                    <button key={m.key} type="button"
                      onClick={() => {
                        setMethod(m.key);
                        if (m.key === 'text')  setTextAnalyzerOpen(true);
                        if (m.key === 'scan')  setScannerOpen(true);
                      }}
                      style={{
                        flex: 1, padding: '8px 0', fontSize: 12, fontWeight: active ? 600 : 400,
                        border: `0.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                        background: active ? 'rgba(45,106,79,0.08)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text-secondary)',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >{m.label}</button>
                  );
                })}
              </div>

              {/* Photo section */}
              {method === 'photo' && (
                <div style={{ marginBottom: 14 }}>
                  {!photoPreview ? (
                    <button type="button" onClick={() => fileRef.current?.click()} style={{
                      width: '100%', padding: '24px 16px',
                      background: 'var(--surface)', border: '1.5px dashed var(--border)',
                      borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                      color: 'var(--text-tertiary)', fontSize: 13,
                      fontFamily: 'var(--font-sans)',
                    }}>
                      Toca para elegir una foto
                    </button>
                  ) : (
                    <div style={{
                      background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden', border: '0.5px solid var(--border)',
                    }}>
                      <img src={photoPreview} alt="Preview" style={{
                        width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block',
                      }} />
                      <div style={{ padding: '10px 12px' }}>
                        {/* Context input */}
                        <input
                          value={photoContext}
                          onChange={e => setPhotoContext(e.target.value)}
                          placeholder="Contexto opcional (ej: casero, 200g)"
                          style={{ ...inputStyle, marginBottom: 8, fontSize: 12 }}
                        />

                        {/* Location pills */}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                          {LOCATION_OPTIONS.map(o => (
                            <button key={o.key} type="button"
                              onClick={() => setPhotoLocation(l => l === o.key ? null : o.key)}
                              style={{
                                padding: '3px 10px', fontSize: 11, borderRadius: 99,
                                border: `0.5px solid ${photoLocation === o.key ? 'var(--accent)' : 'var(--border)'}`,
                                background: photoLocation === o.key ? 'rgba(45,106,79,0.1)' : 'transparent',
                                color: photoLocation === o.key ? 'var(--accent)' : 'var(--text-tertiary)',
                                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                              }}
                            >{o.label}</button>
                          ))}
                        </div>

                        {/* Plate size pills */}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                          {PLATE_OPTIONS.map(o => (
                            <button key={o.key} type="button"
                              onClick={() => setPhotoPlateSize(s => s === o.key ? null : o.key)}
                              style={{
                                padding: '3px 10px', fontSize: 11, borderRadius: 99,
                                border: `0.5px solid ${photoPlateSize === o.key ? 'var(--accent)' : 'var(--border)'}`,
                                background: photoPlateSize === o.key ? 'rgba(45,106,79,0.1)' : 'transparent',
                                color: photoPlateSize === o.key ? 'var(--accent)' : 'var(--text-tertiary)',
                                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                              }}
                            >{o.label}</button>
                          ))}
                        </div>

                        {/* Analyze / Discard */}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" onClick={handleAnalyze} disabled={analyzing}
                            style={{
                              flex: 1, background: 'var(--accent)', color: 'white', border: 'none',
                              borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'var(--font-sans)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }}>
                            {analyzing ? <><span className="spinner" style={{ width: 14, height: 14 }} />Analizando...</> : '✨ Analizar'}
                          </button>
                          <button type="button" onClick={() => {
                            setPhotoPreview(null); setPhotoData(null); setAiResult(null);
                            setPhotoContext(''); setPhotoLocation(null); setPhotoPlateSize(null);
                          }}
                            style={{
                              background: 'none', border: '0.5px solid var(--border)',
                              borderRadius: 8, padding: '9px 14px', fontSize: 12,
                              cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
                            }}>Quitar</button>
                        </div>
                      </div>

                      {/* AI Result */}
                      {aiResult && !aiResult.error && (
                        <div style={{ padding: '12px', borderTop: '0.5px solid var(--border)' }}>
                          <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>{aiResult.name}</p>
                          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', margin: '0 0 4px' }}>
                            {aiResult.calories} kcal
                            {aiResult.calories_min && aiResult.calories_max && (
                              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                                ({aiResult.calories_min}–{aiResult.calories_max})
                              </span>
                            )}
                          </p>
                          {aiResult.confidence && (
                            <span style={{
                              fontSize: 10, padding: '2px 8px', borderRadius: 99,
                              background: CONFIDENCE_STYLE[aiResult.confidence]?.bg || 'var(--surface)',
                              color: CONFIDENCE_STYLE[aiResult.confidence]?.color || 'var(--text-tertiary)',
                            }}>
                              {aiResult.confidence}
                            </span>
                          )}
                          {aiResult.similar_meal && (
                            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                              💡 Similar a <strong>{aiResult.similar_meal.name}</strong> ({aiResult.similar_meal.avg_kcal} kcal)
                              <button type="button" onClick={() => applyAiResult(aiResult.similar_meal.avg_kcal)}
                                style={{ marginLeft: 6, fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                Usar →
                              </button>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button type="button" onClick={() => applyAiResult()} style={{
                              flex: 1, background: 'var(--accent)', color: 'white', border: 'none',
                              borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            }}>Aplicar</button>
                          </div>
                        </div>
                      )}
                      {aiResult?.error && (
                        <p style={{ padding: '10px 12px', fontSize: 12, color: '#ef4444' }}>{aiResult.error}</p>
                      )}
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                </div>
              )}

              {/* AI limit reached */}
              {aiLimitData && (
                <div style={{
                  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400e',
                }}>
                  Has alcanzado el límite de análisis IA por hoy ({aiLimitData.limit}). Puedes añadir la comida manualmente.
                </div>
              )}

              {/* Scan feedback */}
              {scanFeedback && (
                <div style={{
                  background: 'rgba(16,185,129,0.1)', borderRadius: 8,
                  padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#059669',
                }}>
                  Datos aplicados al formulario
                </div>
              )}

              {/* Meal type pills */}
              <div style={{ marginBottom: 10 }}>
                <span style={{
                  fontSize: 9, color: 'var(--text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 600,
                  display: 'block', marginBottom: 6,
                }}>Tipo de comida</span>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {MEAL_TYPES.map(m => {
                    const active = form.meal_type === m.id;
                    return (
                      <button key={m.id} type="button"
                        onClick={() => set('meal_type', m.id)}
                        style={{
                          padding: '5px 12px', borderRadius: 'var(--radius-full)',
                          fontSize: 12, fontWeight: active ? 600 : 400,
                          cursor: 'pointer', fontFamily: 'var(--font-sans)',
                          border: `0.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          background: active ? 'rgba(45,106,79,0.1)' : 'transparent',
                          color: active ? 'var(--accent)' : 'var(--text-secondary)',
                        }}
                      >{m.label}</button>
                    );
                  })}
                </div>
              </div>

              {/* Name */}
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Nombre (opcional)"
                style={{ ...inputStyle, marginBottom: 8 }}
              />

              {/* Kcal + macros grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
                <div>
                  <label style={{
                    fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase',
                    letterSpacing: '0.4px', fontWeight: 600, display: 'block', marginBottom: 3,
                  }}>kcal *</label>
                  <input type="number" value={form.calories} onChange={e => set('calories', e.target.value)}
                    required style={{ ...inputStyle, textAlign: 'center' }} />
                </div>
                {[
                  { key: 'protein', label: 'Prot' },
                  { key: 'carbs',   label: 'Carb' },
                  { key: 'fat',     label: 'Grasa' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label style={{
                      fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase',
                      letterSpacing: '0.4px', fontWeight: 600, display: 'block', marginBottom: 3,
                    }}>{label}</label>
                    <input type="number" value={form[key]} onChange={e => set(key, e.target.value)}
                      style={{ ...inputStyle, textAlign: 'center' }} />
                  </div>
                ))}
              </div>

              {/* Notes */}
              <input
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Notas (opcional)"
                style={{ ...inputStyle, marginBottom: 14 }}
              />

              {/* Error */}
              {error && (
                <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{error}</p>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={saving} style={{
                  flex: 1, background: 'var(--accent)', color: 'white', border: 'none',
                  borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} />Guardando...</> : 'Guardar'}
                </button>
                <button type="button" onClick={() => onClose(false)} style={{
                  background: 'none', border: '0.5px solid var(--border)',
                  borderRadius: 8, padding: '11px 20px', fontSize: 13,
                  cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
                }}>Cancelar</button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* TextAnalyzer portal */}
      <TextAnalyzer
        isOpen={textAnalyzerOpen}
        onClose={() => setTextAnalyzerOpen(false)}
        mealType={form.meal_type}
        onResult={handleTextResult}
        onAiLimit={data => setAiLimitData(data)}
        date={targetDate}
      />

      {/* BarcodeScanner portal */}
      {scannerOpen && (
        <BarcodeScanner
          onClose={() => setScannerOpen(false)}
          onAdd={handleAddScannedProduct}
        />
      )}
    </div>,
    document.body
  );
}
