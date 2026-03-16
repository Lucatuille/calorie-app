import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { MEAL_TYPES, getMeal } from '../utils/meals';
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

const EMPTY_FORM = {
  meal_type: 'lunch', name: '', calories: '',
  protein: '', carbs: '', fat: '', weight: '', notes: '',
};

const MACROS_DISPLAY = [
  { key: 'protein', label: 'Prot',  chipClass: 'chip-protein' },
  { key: 'carbs',   label: 'Carb',  chipClass: 'chip-carbs'   },
  { key: 'fat',     label: 'Grasa', chipClass: 'chip-fat'     },
];

export default function Calculator() {
  const { token } = useAuth();

  // Today's meals
  const [entries,    setEntries]    = useState([]);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [saved,      setSaved]      = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Barcode scanner
  const [scannerOpen,    setScannerOpen]    = useState(false);
  const [scanFeedback,   setScanFeedback]   = useState(false);

  // Text analyzer
  const [textAnalyzerOpen, setTextAnalyzerOpen] = useState(false);

  // Photo analysis
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoData,    setPhotoData]    = useState(null);   // { base64, mediaType }
  const [photoContext, setPhotoContext] = useState('');
  const [analyzing,    setAnalyzing]    = useState(false);
  const [aiResult,     setAiResult]     = useState(null);
  const fileRef = useRef(null);
  // Stores AI metadata between "Usar estimación" and final save (fire-and-forget)
  const photoAnalysisRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.getTodayEntries(token).then(setEntries).catch(() => {});
  }, [token]);

  const total = entries.reduce((a, e) => ({
    calories: a.calories + (e.calories || 0),
    protein:  a.protein  + (e.protein  || 0),
    carbs:    a.carbs    + (e.carbs    || 0),
    fat:      a.fat      + (e.fat      || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

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
      setForm(EMPTY_FORM);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);

      // Fire-and-forget correction save if this came from a photo analysis
      if (photoAnalysisRef.current) {
        const pa = photoAnalysisRef.current;
        api.saveAiCorrection({
          entry_id:               entry.id,
          ai_raw:                 pa.ai_raw,
          ai_calibrated:          pa.ai_calibrated,
          user_final:             finalCalories,
          food_categories:        pa.categories,
          meal_type:              finalMealType,
          meal_name:              finalName || pa.name,
          has_context:            pa.has_context,
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
    } catch (err) { console.error(err); }
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setPhotoPreview(dataUrl);
      setPhotoData({ base64: dataUrl.split(',')[1], mediaType: file.type });
      setAiResult(null);
      setPhotoContext('');
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
        image:     photoData.base64,
        mediaType: photoData.mediaType,
        context:   photoContext.trim(),
        meal_type: form.meal_type,
      }, token);
      setAiResult(result);
    } catch (err) {
      setAiResult({ error: err.message });
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
    // Save AI metadata for correction tracking (same fire-and-forget as photos)
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
    // Save AI metadata for correction tracking
    photoAnalysisRef.current = {
      ai_raw:       aiResult.ai_raw || aiResult.calories,
      ai_calibrated: aiResult.calories,
      categories:   aiResult.categories || [],
      has_context:  photoContext.trim().length > 0,
      name:         aiResult.name,
    };
    setPhotoPreview(null);
    setPhotoData(null);
    setPhotoContext('');
    setAiResult(null);
  }

  const CONFIDENCE_STYLE = {
    alta:  { bg: 'rgba(16,185,129,0.1)',  color: '#059669' },
    media: { bg: 'rgba(245,158,11,0.1)', color: '#d97706' },
    baja:  { bg: 'rgba(193,18,31,0.1)',  color: 'var(--danger)' },
  };

  const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="page">
      <h1 className="title-xl" style={{ marginBottom: 4 }}>Registrar</h1>
      <p className="body-sm" style={{ marginBottom: 24, textTransform: 'capitalize' }}>{todayLabel}</p>

      {/* ── Today's meals summary ─────────────────────────────── */}
      {entries.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <p className="muted" style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>
              Total hoy · {entries.length} {entries.length === 1 ? 'comida' : 'comidas'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 46, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {total.calories.toLocaleString()}
            </span>
            <span style={{ fontSize: 15, color: 'var(--text-3)' }}>kcal</span>
          </div>

          {(total.protein > 0 || total.carbs > 0 || total.fat > 0) && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {MACROS_DISPLAY.map(m => total[m.key] > 0 ? (
                <div key={m.key} className={`macro-chip ${m.chipClass}`} style={{ fontSize: 11 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0, opacity: 0.7 }} />
                  <span style={{ fontWeight: 700 }}>{Math.round(total[m.key])}g</span>
                  <span style={{ opacity: 0.7 }}>{m.label}</span>
                </div>
              ) : null)}
            </div>
          )}

          {/* Meal list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {entries.map(entry => {
              const meal = getMeal(entry.meal_type);
              const isDeleting = deletingId === entry.id;
              return (
                <div key={entry.id}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{meal.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>
                        {entry.name || meal.label}
                      </span>
                      {entry.name && (
                        <span style={{ color: 'var(--text-3)', fontSize: 12, marginLeft: 6 }}>
                          {meal.label}
                        </span>
                      )}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                      {entry.calories.toLocaleString()} kcal
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeletingId(d => d === entry.id ? null : entry.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-3)', fontSize: 16, padding: '2px 4px',
                        lineHeight: 1, flexShrink: 0,
                      }}
                    >✕</button>
                  </div>
                  {isDeleting && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', marginBottom: 2,
                      background: 'rgba(193,18,31,0.06)', borderRadius: 8, flexWrap: 'wrap',
                    }}>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--danger)' }}>
                        ¿Eliminar esta entrada?
                      </span>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--danger)', color: 'white', border: 'none' }}
                        onClick={() => removeMeal(entry.id)}
                      >Eliminar</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setDeletingId(null)}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Add meal form ─────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h2 className="title-md" style={{ marginBottom: 12 }}>Añadir comida</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '8px 4px' }}
            onClick={() => fileRef.current?.click()}
            disabled={analyzing}
          >
            {analyzing ? <span className="spinner" style={{ width: 12, height: 12, marginRight: 4 }} /> : '📸 '}
            {analyzing ? 'Analizando...' : 'Foto'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '8px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            onClick={() => setScannerOpen(true)}
          >
            <BarcodeIcon />
            Escanear
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '8px 4px' }}
            onClick={() => setTextAnalyzerOpen(true)}
          >
            ✏️ Describir
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handlePhotoChange}
        />

        {/* ── Photo preview & AI result ── */}
        {photoPreview && (
          <div style={{ marginBottom: 16 }}>
            <img
              src={photoPreview}
              alt="preview"
              style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }}
            />

            {/* Textarea de contexto + botón Analizar (sólo antes de analizar) */}
            {!aiResult && !analyzing && (
              <>
                <div className="field" style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <label style={{ margin: 0 }}>Contexto adicional (opcional)</label>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{photoContext.length}/300</span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={300}
                    placeholder={'Ej: "son 2 raciones", "comida de restaurante", "lleva nata y bacon", "200g aproximadamente"...'}
                    value={photoContext}
                    onChange={e => setPhotoContext(e.target.value)}
                    style={{ resize: 'vertical', fontSize: 13 }}
                  />
                </div>
                <button type="button" className="btn btn-primary btn-full" onClick={handleAnalyze}>
                  🔍 Analizar con IA
                </button>
              </>
            )}

            {analyzing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-2)', fontSize: 13, marginTop: 8 }}>
                <span className="spinner" style={{ width: 14, height: 14 }} />
                Analizando con IA...
              </div>
            )}
            {aiResult && !aiResult.error && (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{aiResult.name}</p>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    background: CONFIDENCE_STYLE[aiResult.confidence]?.bg || 'rgba(0,0,0,0.05)',
                    color:      CONFIDENCE_STYLE[aiResult.confidence]?.color || 'var(--text-2)',
                  }}>
                    confianza {aiResult.confidence}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 13, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span><b>{aiResult.calories}</b> kcal</span>
                  {aiResult.protein > 0 && <span style={{ color: '#059669' }}><b>{aiResult.protein}g</b> prot</span>}
                  {aiResult.carbs   > 0 && <span style={{ color: '#d97706' }}><b>{aiResult.carbs}g</b> carb</span>}
                  {aiResult.fat     > 0 && <span style={{ color: '#3b82f6' }}><b>{aiResult.fat}g</b> grasa</span>}
                </div>

                {/* Calibración aplicada */}
                {aiResult.calibration_applied && aiResult.calibration_confidence > 0.3 && (
                  <p style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8 }}>
                    🎯 Ajustado a tus hábitos · {aiResult.calibration_data_points} correcciones
                  </p>
                )}

                {/* Comida similar del historial */}
                {aiResult.similar_meal && (
                  <div style={{
                    padding: '8px 10px', background: 'var(--bg)', borderRadius: 8,
                    marginBottom: 8, border: '1px solid var(--border)',
                  }}>
                    <p style={{ fontSize: 12, margin: '0 0 4px' }}>
                      💡 Parece similar a <strong>{aiResult.similar_meal.name}</strong>
                      {' '}({aiResult.similar_meal.avg_kcal} kcal · {aiResult.similar_meal.times}× registrada)
                    </p>
                    <button
                      type="button"
                      onClick={() => applyAiResult(aiResult.similar_meal.avg_kcal)}
                      style={{ fontSize: 11, color: 'var(--accent)', background: 'none',
                               border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Usar {aiResult.similar_meal.avg_kcal} kcal →
                    </button>
                  </div>
                )}

                {aiResult.notes && (
                  <p style={{ fontSize: 12, color: 'var(--text-2)', fontStyle: 'italic', marginBottom: 8 }}>
                    {aiResult.notes}
                  </p>
                )}
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>
                  ⚠️ Estimación aproximada — revisa y ajusta antes de guardar
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => applyAiResult()}>
                    Usar estimación
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm"
                    onClick={() => { setPhotoPreview(null); setPhotoData(null); setPhotoContext(''); setAiResult(null); }}>
                    Descartar
                  </button>
                </div>
              </div>
            )}
            {aiResult?.error && (
              <div className="alert alert-error">{aiResult.error}</div>
            )}
          </div>
        )}

        <form onSubmit={addMeal} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Meal type */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            {MEAL_TYPES.map(m => (
              <button key={m.id} type="button"
                className={`btn btn-sm ${form.meal_type === m.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => set('meal_type', m.id)}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          <div className="field">
            <label>Nombre (opcional)</label>
            <input
              placeholder="Porridge, Pollo con arroz..."
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          <div className="field">
            <label>Calorías *</label>
            <input
              type="number" placeholder="450"
              value={form.calories}
              onChange={e => set('calories', e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <div className="field">
              <label>Proteína (g)</label>
              <input type="number" placeholder="30" value={form.protein} onChange={e => set('protein', e.target.value)} />
            </div>
            <div className="field">
              <label>Carbos (g)</label>
              <input type="number" placeholder="50" value={form.carbs} onChange={e => set('carbs', e.target.value)} />
            </div>
            <div className="field">
              <label>Grasa (g)</label>
              <input type="number" placeholder="15" value={form.fat} onChange={e => set('fat', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Peso corporal (kg)</label>
              <input type="number" step="0.1" placeholder="74.5" value={form.weight} onChange={e => set('weight', e.target.value)} />
            </div>
            <div className="field">
              <label>Notas</label>
              <input placeholder="Opcional..." value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>

          {error        && <div className="alert alert-error">  {error}</div>}
          {saved        && <div className="alert alert-success">✓ Comida añadida</div>}
          {scanFeedback && <div className="alert alert-success">▦ Producto añadido al formulario — revisa y guarda</div>}

          <button className="btn btn-primary btn-full" type="submit" disabled={saving}>
            {saving ? <span className="spinner" /> : '+ Añadir comida'}
          </button>
        </form>
      </div>

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
      />
    </div>
  );
}
