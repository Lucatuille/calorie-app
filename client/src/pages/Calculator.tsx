import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MEAL_TYPES, getMeal } from '../utils/meals';
import { MEAL_HOURS, MAX_IMAGE_PX, JPEG_QUALITY } from '../utils/constants';
import BarcodeScanner from '../components/BarcodeScanner';
import TextAnalyzer   from '../components/TextAnalyzer';

const BarcodeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
    <rect x="1" y="4" width="2" height="16"/>
    <rect x="5" y="4" width="1" height="16"/>
    <rect x="8" y="4" width="2" height="16"/>
    <rect x="12" y="4" width="1" height="16"/>
    <rect x="15" y="4" width="3" height="16"/>
    <rect x="20" y="4" width="2" height="16"/>
  </svg>
);

const METHODS = [
  {
    key: 'photo',
    label: 'Foto IA',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1" y="3" width="16" height="12" rx="2"
          stroke={active ? 'var(--accent)' : 'var(--text-secondary)'} strokeWidth="1.2"/>
        <circle cx="9" cy="9" r="3.5"
          stroke={active ? 'var(--accent)' : 'var(--text-secondary)'} strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    key: 'scan',
    label: 'Escanear',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="4" width="14" height="2" rx="1" fill={active ? 'var(--accent)' : 'var(--text-secondary)'}/>
        <rect x="2" y="8" width="14" height="2" rx="1" fill={active ? 'var(--accent)' : 'var(--text-secondary)'}/>
        <rect x="2" y="12" width="9" height="2" rx="1" fill={active ? 'var(--accent)' : 'var(--text-secondary)'}/>
      </svg>
    ),
  },
  {
    key: 'text',
    label: 'Describir',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 13 L6 10 L10 12 L15 6"
          stroke={active ? 'var(--accent)' : 'var(--text-secondary)'} strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
];


function getDefaultMealType() {
  const h = new Date().getHours();
  for (const [type, [start, end]] of Object.entries(MEAL_HOURS)) {
    if (h >= start && h < end) return type;
  }
  return 'other';
}

function getContextHint(mealType) {
  const h = new Date().getHours();
  if (mealType === 'breakfast') return h < 9 ? 'Buen comienzo del día' : 'Desayuno tardío';
  if (mealType === 'lunch')     return 'A por la comida';
  if (mealType === 'dinner')    return h >= 22 ? 'Cena tardía — intenta algo ligero' : 'Hora de cenar';
  if (mealType === 'snack')     return 'Un snack inteligente';
  return null;
}

const emptyForm = () => ({
  meal_type: getDefaultMealType(), name: '', calories: '',
  protein: '', carbs: '', fat: '', weight: '', notes: '',
});

const CONFIDENCE_STYLE = {
  alta:  { bg: 'rgba(16,185,129,0.1)',  color: 'var(--color-protein)' },
  media: { bg: 'rgba(245,158,11,0.1)', color: 'var(--color-carbs)' },
  baja:  { bg: 'rgba(193,18,31,0.1)',  color: '#ef4444' },
};

export default function Calculator() {
  const { token, user } = useAuth();

  const [entries,    setEntries]    = useState([]);
  const [profile,    setProfile]    = useState(null);
  const [form,       setForm]       = useState(emptyForm);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [saved,      setSaved]      = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showExtra,  setShowExtra]  = useState(false);

  const [scannerOpen,      setScannerOpen]      = useState(false);
  const [scanFeedback,     setScanFeedback]     = useState(false);
  const [textAnalyzerOpen, setTextAnalyzerOpen] = useState(false);

  const [method, setMethod] = useState('photo');

  const [photoPreview,    setPhotoPreview]    = useState(null);
  const [photoData,       setPhotoData]       = useState(null);
  const [photoContext,    setPhotoContext]     = useState('');
  const [photoLocation,   setPhotoLocation]   = useState(null);
  const [photoPlateSize,  setPhotoPlateSize]  = useState(null);
  const [analyzing,       setAnalyzing]       = useState(false);
  const [aiResult,     setAiResult]     = useState(null);
  const [aiLimitData,  setAiLimitData]  = useState(null);
  const fileRef = useRef(null);
  const photoAnalysisRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.getTodayEntries(token).then(setEntries).catch(() => {});
    api.getProfile(token).then(setProfile).catch(() => {});
  }, [token]);

  const total = entries.reduce((a, e) => ({
    calories: a.calories + (e.calories || 0),
    protein:  a.protein  + (e.protein  || 0),
    carbs:    a.carbs    + (e.carbs    || 0),
    fat:      a.fat      + (e.fat      || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const targetCalories = profile?.target_calories || user?.target_calories || 0;

  async function addMeal(e) {
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
        protein:   parseFloat(form.protein)  || null,
        carbs:     parseFloat(form.carbs)    || null,
        fat:       parseFloat(form.fat)      || null,
        weight:    parseFloat(form.weight)   || null,
        notes:     form.notes || null,
      }, token);
      setEntries(prev => [...prev, entry]);
      setForm(emptyForm());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
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
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  async function removeMeal(id) {
    try {
      await api.deleteEntry(id, token);
      setEntries(prev => prev.filter(e => e.id !== id));
      setDeletingId(null);
    } catch { }
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const original = reader.result;
      setPhotoPreview(original);
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_IMAGE_PX || height > MAX_IMAGE_PX) {
          if (width > height) { height = Math.round(height * MAX_IMAGE_PX / width); width = MAX_IMAGE_PX; }
          else                { width = Math.round(width * MAX_IMAGE_PX / height); height = MAX_IMAGE_PX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
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

  function handleAddScannedProduct(product, nutrition) {
    const name = product.brand ? `${product.name} (${product.brand})` : product.name;
    setForm(f => ({
      ...f,
      name,
      calories: nutrition.calories != null ? String(nutrition.calories) : f.calories,
      protein:  nutrition.protein  != null ? String(nutrition.protein)  : f.protein,
      carbs:    nutrition.carbs    != null ? String(nutrition.carbs)    : f.carbs,
      fat:      nutrition.fat      != null ? String(nutrition.fat)      : f.fat,
    }));
    setScanFeedback(true);
    setTimeout(() => setScanFeedback(false), 3000);
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

  const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const contextHint = getContextHint(form.meal_type);

  // Calorie hint (no red — never punish)
  const kcalTyped = parseInt(form.calories) || 0;
  const kcalOver  = targetCalories > 0 && (total.calories + kcalTyped) > targetCalories;

  // ── Shared styles ─────────────────────────────────────────────

  const inputStyle = {
    width: '100%', background: 'var(--surface-2)',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 12px',
    fontSize: 14, color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <section style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 40 }}>

      {/* ── Header ── */}
      <header style={{ padding: '20px 20px 16px' }}>
        <p style={{
          fontSize: 11, color: 'var(--text-secondary)',
          margin: '0 0 2px', fontFamily: 'var(--font-sans)',
          textTransform: 'capitalize',
        }}>
          {todayLabel}
        </p>
        <h1 className="page-title">Registrar</h1>
      </header>

      {/* ── 1. Formulario — primero ── */}
      <div style={{ padding: '0 16px', marginBottom: 10 }}>
        <div className="card card-padded card-bordered card-shadow">

          {/* Header del formulario: label + hint contextual */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="section-label" style={{ marginBottom: 0 }}>Añadir comida</span>
            {contextHint && (
              <span style={{
                fontSize: 10, color: 'var(--accent)',
                fontFamily: 'var(--font-sans)', fontStyle: 'italic',
              }}>
                {contextHint}
              </span>
            )}
          </div>

          {/* Selector de método — igual jerarquía */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
            {METHODS.map(m => {
              const active = method === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setMethod(m.key);
                    if (m.key === 'scan') setScannerOpen(true);
                    if (m.key === 'text') setTextAnalyzerOpen(true);
                    if (m.key === 'photo') fileRef.current?.click();
                  }}
                  disabled={m.key === 'photo' && analyzing}
                  style={{
                    background: active ? 'var(--accent-light)' : 'var(--surface-2)',
                    border: active ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 8px',
                    textAlign: 'center',
                    cursor: (m.key === 'photo' && analyzing) ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                    opacity: (m.key === 'photo' && analyzing) ? 0.6 : 1,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <div style={{
                    width: 32, height: 32,
                    background: active ? 'var(--accent-light)' : 'var(--surface)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 6px',
                  }}>
                    {m.key === 'photo' && analyzing
                      ? <span className="spinner" style={{ width: 14, height: 14 }} />
                      : m.icon(active)}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 500,
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  }}>
                    {m.key === 'photo' && analyzing ? 'Analizando…' : m.label}
                  </span>
                </button>
              );
            })}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoChange}
          />

          {/* Foto preview + AI result */}
          {photoPreview && (
            <div style={{ marginBottom: 14 }}>
              <img
                src={photoPreview}
                alt="preview"
                style={{
                  width: '100%', maxHeight: 200, objectFit: 'cover',
                  borderRadius: 'var(--radius-md)', marginBottom: 10,
                }}
              />
              {!aiResult && !analyzing && (
                <>
                  {/* Optional context toggles */}
                  <div style={{ marginBottom: 10 }}>
                    {/* Location row */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      {[
                        { key: 'home',       label: 'Casa'       },
                        { key: 'restaurant', label: 'Restaurante' },
                        { key: 'takeaway',   label: 'Takeaway'   },
                        { key: 'fastfood',   label: 'Fast food'  },
                      ].map(opt => {
                        const active = photoLocation === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setPhotoLocation(active ? null : opt.key)}
                            style={{
                              padding: '4px 10px',
                              fontSize: 11,
                              borderRadius: 99,
                              border: active ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                              background: active ? 'rgba(45,106,79,0.08)' : 'var(--surface-2)',
                              color: active ? 'var(--accent)' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              fontFamily: 'var(--font-sans)',
                              fontWeight: active ? 600 : 400,
                              transition: 'all 0.12s ease',
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Plate size row */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[
                        { key: 'small',  label: 'Plato pequeño' },
                        { key: 'normal', label: 'Plato normal'  },
                        { key: 'large',  label: 'Plato grande'  },
                        { key: 'bowl',   label: 'Bol'           },
                      ].map(opt => {
                        const active = photoPlateSize === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setPhotoPlateSize(active ? null : opt.key)}
                            style={{
                              padding: '4px 10px',
                              fontSize: 11,
                              borderRadius: 99,
                              border: active ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                              background: active ? 'rgba(45,106,79,0.08)' : 'var(--surface-2)',
                              color: active ? 'var(--accent)' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              fontFamily: 'var(--font-sans)',
                              fontWeight: active ? 600 : 400,
                              transition: 'all 0.12s ease',
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                        Contexto (opcional)
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{photoContext.length}/300</span>
                    </div>
                    <textarea
                      rows={2}
                      maxLength={300}
                      placeholder='Ej: "son 2 raciones", "200g aprox"…'
                      value={photoContext}
                      onChange={e => setPhotoContext(e.target.value)}
                      style={{ ...inputStyle, resize: 'vertical', fontSize: 13 }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    style={{
                      width: '100%', background: 'var(--accent)', color: 'white',
                      border: 'none', borderRadius: 'var(--radius-sm)',
                      padding: '11px', fontSize: 13, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Analizar con IA
                  </button>
                </>
              )}
              {analyzing && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: 'var(--text-secondary)', fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                }}>
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  Analizando…
                </div>
              )}
              {aiResult && !aiResult.error && (
                <div style={{
                  background: 'var(--surface-2)', border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, margin: 0, color: 'var(--text-primary)' }}>{aiResult.name}</p>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                      background: CONFIDENCE_STYLE[aiResult.confidence]?.bg || 'rgba(0,0,0,0.05)',
                      color:      CONFIDENCE_STYLE[aiResult.confidence]?.color || 'var(--text-secondary)',
                    }}>
                      confianza {aiResult.confidence}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 13, marginBottom: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <span>
                      <b>{aiResult.calories}</b> kcal
                      {aiResult.calories_min && aiResult.calories_max && (
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>
                          ({aiResult.calories_min}–{aiResult.calories_max})
                        </span>
                      )}
                    </span>
                    {aiResult.protein > 0 && <span className="color-protein"><b>{aiResult.protein}g</b> prot</span>}
                    {aiResult.carbs   > 0 && <span className="color-carbs"><b>{aiResult.carbs}g</b> carb</span>}
                    {aiResult.fat     > 0 && <span className="color-fat"><b>{aiResult.fat}g</b> grasa</span>}
                  </div>
                  {aiResult.similar_meal && (
                    <div style={{
                      padding: '8px 10px', background: 'var(--surface)', borderRadius: 8,
                      marginBottom: 8, border: '0.5px solid var(--border)',
                    }}>
                      <p style={{ fontSize: 12, margin: '0 0 4px', color: 'var(--text-secondary)' }}>
                        Parece similar a <strong>{aiResult.similar_meal.name}</strong>
                        {' '}({aiResult.similar_meal.avg_kcal} kcal · {aiResult.similar_meal.times}× registrada)
                      </p>
                      <button
                        type="button"
                        onClick={() => applyAiResult(aiResult.similar_meal.avg_kcal)}
                        style={{
                          fontSize: 11, color: 'var(--accent)', background: 'none',
                          border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)',
                        }}
                      >
                        Usar {aiResult.similar_meal.avg_kcal} kcal →
                      </button>
                    </div>
                  )}
                  {aiResult.notes && (
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', margin: '0 0 8px' }}>
                      {aiResult.notes}
                    </p>
                  )}
                  <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '0 0 10px' }}>
                    Estimación aproximada — revisa antes de guardar
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => applyAiResult()}
                      style={{
                        background: 'var(--accent)', color: 'white', border: 'none',
                        borderRadius: 6, padding: '6px 14px', fontSize: 13,
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      }}
                    >
                      Usar estimación
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPhotoPreview(null); setPhotoData(null); setPhotoContext(''); setPhotoLocation(null); setPhotoPlateSize(null); setAiResult(null); }}
                      style={{
                        background: 'none', border: '0.5px solid var(--border)',
                        borderRadius: 6, padding: '6px 14px', fontSize: 13,
                        cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
                      }}
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              )}
              {aiResult?.error && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.2)',
                  borderRadius: 'var(--radius-sm)', padding: '10px 12px',
                  fontSize: 13, color: '#ef4444', fontFamily: 'var(--font-sans)',
                }}>
                  {aiResult.error}
                </div>
              )}
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={addMeal} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Tipo de comida — tab bar */}
            <div className="meal-selector">
              {MEAL_TYPES.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => set('meal_type', m.id)}
                  className={`meal-selector__tab${form.meal_type === m.id ? ' meal-selector__tab--active' : ''}`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Nombre */}
            <input
              placeholder="¿Qué has comido?"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              style={inputStyle}
            />

            {/* Calorías — protagonista con color contextual */}
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={form.calories}
                onChange={e => set('calories', Math.max(0, parseInt(e.target.value) || 0) || '')}
                style={{
                  ...inputStyle,
                  fontSize: 32, fontWeight: 700,
                  padding: '12px 56px 12px 16px',
                  letterSpacing: '-1px',
                  color: 'var(--text-primary)',
                }}
              />
              <span style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                fontSize: 12, color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-sans)', pointerEvents: 'none',
              }}>
                kcal
              </span>
              {/* Hint contextual — nunca rojo */}
              {kcalTyped > 0 && targetCalories > 0 && (
                <div style={{
                  position: 'absolute', bottom: -18, left: 0,
                  fontSize: 10,
                  color: kcalOver ? 'var(--color-carbs)' : 'var(--accent)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {kcalOver
                    ? `${(total.calories + kcalTyped - targetCalories).toLocaleString('es')} sobre el objetivo`
                    : `${(targetCalories - total.calories - kcalTyped).toLocaleString('es')} restantes`}
                </div>
              )}
            </div>

            {/* Macros con accent bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, paddingTop: kcalTyped > 0 && targetCalories > 0 ? 10 : 0 }}>
              {[
                { key: 'protein', label: 'Proteína', cls: 'macro-input--protein' },
                { key: 'carbs',   label: 'Carbos',   cls: 'macro-input--carbs'   },
                { key: 'fat',     label: 'Grasa',    cls: 'macro-input--fat'     },
              ].map(({ key, label, cls }) => (
                <div key={key} className={`macro-input ${cls}`}>
                  <input
                    type="number"
                    placeholder="0"
                    value={form[key]}
                    onChange={e => set(key, e.target.value)}
                  />
                  <div className="macro-input__label">{label}</div>
                </div>
              ))}
            </div>

            {/* Más detalles */}
            <button
              type="button"
              onClick={() => setShowExtra(v => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-sans)', padding: 0,
                textAlign: 'left', alignSelf: 'flex-start',
              }}
            >
              {showExtra ? '− Ocultar' : '+ Peso corporal / Notas'}
            </button>

            {showExtra && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label" style={{ marginBottom: 4 }}>
                    Peso corporal (kg)
                  </label>
                  <input
                    type="number" step="0.1" placeholder="74.5"
                    value={form.weight} onChange={e => set('weight', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ marginBottom: 4 }}>
                    Notas
                  </label>
                  <input
                    placeholder="Opcional…"
                    value={form.notes} onChange={e => set('notes', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--radius-sm)', padding: '9px 12px',
                fontSize: 13, color: '#ef4444', fontFamily: 'var(--font-sans)',
              }}>
                {error}
              </div>
            )}
            {(saved || scanFeedback) && (
              <div style={{
                background: 'rgba(45,106,79,0.08)', border: '0.5px solid rgba(45,106,79,0.2)',
                borderRadius: 'var(--radius-sm)', padding: '9px 12px',
                fontSize: 13, color: 'var(--accent)', fontFamily: 'var(--font-sans)',
              }}>
                {saved ? '✓ Comida añadida' : 'Datos importados — revisa y guarda'}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !form.calories}
              className="save-btn-dark"
            >
              {saving
                ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.2)' }} />
                : 'Guardar comida'}
            </button>
          </form>
        </div>
      </div>

      {/* ── 2. Historial de hoy — debajo ── */}
      {entries.length > 0 && (
        <div style={{ padding: '0 16px', marginBottom: 10 }}>
          <div className="card card-padded card-bordered card-shadow">
            <span className="section-label" style={{ marginBottom: 10 }}>
              Hoy · {total.calories.toLocaleString('es')} kcal · {entries.length} {entries.length === 1 ? 'comida' : 'comidas'}
            </span>
            <div>
              {entries.map((entry, i) => {
                const meal = getMeal(entry.meal_type);
                const isDeleting = deletingId === entry.id;
                return (
                  <div key={entry.id}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 0',
                      borderBottom: (i < entries.length - 1 || isDeleting) ? '0.5px solid var(--border)' : 'none',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          fontSize: 13, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                        }}>
                          {entry.name || meal.label}
                        </span>
                        {entry.protein > 0 && (
                          <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                            {Math.round(entry.protein)}g prot · {Math.round(entry.carbs || 0)}g carbos · {Math.round(entry.fat || 0)}g grasa
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>
                          {entry.calories}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDeletingId(d => d === entry.id ? null : entry.id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-tertiary)', fontSize: 16,
                            padding: '0 2px', lineHeight: 1, borderRadius: 4,
                          }}
                        >×</button>
                      </div>
                    </div>
                    {isDeleting && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 0',
                        borderBottom: i < entries.length - 1 ? '0.5px solid var(--border)' : 'none',
                      }}>
                        <span style={{ flex: 1, fontSize: 12, color: '#ef4444' }}>¿Eliminar esta entrada?</span>
                        <button
                          onClick={() => removeMeal(entry.id)}
                          style={{
                            background: '#ef4444', color: 'white', border: 'none',
                            borderRadius: 6, padding: '4px 12px', fontSize: 12,
                            cursor: 'pointer', fontFamily: 'var(--font-sans)',
                          }}
                        >Eliminar</button>
                        <button
                          onClick={() => setDeletingId(null)}
                          style={{
                            background: 'none', border: '0.5px solid var(--border)',
                            borderRadius: 6, padding: '4px 12px', fontSize: 12,
                            cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
                          }}
                        >Cancelar</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onAddProduct={handleAddScannedProduct}
      />

      <TextAnalyzer
        isOpen={textAnalyzerOpen}
        onClose={() => setTextAnalyzerOpen(false)}
        mealType={form.meal_type}
        onResult={handleTextResult}
        onAiLimit={(data) => { setTextAnalyzerOpen(false); setAiLimitData(data); }}
      />

      {/* Bottom sheet: límite de IA */}
      {aiLimitData && (
        <>
          <div
            onClick={() => setAiLimitData(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 8000 }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: 'var(--bg)', borderRadius: '20px 20px 0 0',
            padding: '24px 24px 40px', zIndex: 8001,
            boxShadow: '0 -4px 30px rgba(0,0,0,0.15)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
              <p style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)', marginBottom: 6, fontFamily: 'var(--font-sans)' }}>
                Has usado tus {aiLimitData.limit} análisis de hoy
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
                Se renuevan a las 00:00 · Quedan ~{aiLimitData.hours_left}h
              </p>
            </div>
            <div style={{
              borderTop: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)',
              padding: '16px 0', margin: '0 0 20px', textAlign: 'center',
            }}>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4, fontFamily: 'var(--font-sans)' }}>¿Quieres análisis ilimitados?</p>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 2, fontFamily: 'var(--font-sans)' }}>∞ Pro — 1.99€/mes</p>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)' }}>Sin límites · Sin anuncios</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
              <button
                onClick={() => { setAiLimitData(null); alert('Próximamente'); }}
                style={{
                  width: '100%', background: 'var(--accent)', color: 'white',
                  border: 'none', padding: '13px', borderRadius: 100,
                  fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Ver planes
              </button>
              <button
                onClick={() => setAiLimitData(null)}
                style={{
                  width: '100%', background: 'none', border: '0.5px solid var(--border)',
                  color: 'var(--text-secondary)', padding: '12px', borderRadius: 100,
                  fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                Registrar manualmente
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
