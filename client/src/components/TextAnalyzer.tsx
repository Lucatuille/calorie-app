import { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { MAX_TEXT_LENGTH } from '../utils/constants';
import FocusTrap from './FocusTrap';

const EXAMPLES = [
  { label: '🍳 Huevos', text: '2 huevos revueltos con un poco de mantequilla' },
  { label: '🍝 Pasta',  text: 'Un plato de pasta con tomate, unos 200g' },
  { label: '🥗 Ensalada', text: 'Ensalada mixta con lechuga, tomate, atún y aceite de oliva' },
  { label: '🍗 Pollo',  text: 'Pechuga de pollo a la plancha, unos 150g' },
];

const CONFIDENCE_COLOR = { high: 'var(--color-protein)', medium: 'var(--color-carbs)', low: 'var(--text-3)' };
const CONFIDENCE_LABEL = { high: 'Alta', medium: 'Media', low: 'Baja' };

export default function TextAnalyzer({ isOpen, onClose, mealType, onResult, onAiLimit, date }) {
  const { token } = useAuth();
  const [text,      setText]   = useState('');
  const [status,    setStatus] = useState('idle');   // idle | loading | result | error
  const [result,    setResult] = useState(null);
  const [errorMsg,  setErrorMsg] = useState('');

  // Adjust state
  const [adjusting,    setAdjusting]    = useState(false);
  const [adjustedKcal, setAdjustedKcal] = useState('');

  // Clarification state
  const [clarified, setClarified] = useState(false);

  if (!isOpen) return null;

  const charCount = text.length;
  const charColor = charCount >= MAX_TEXT_LENGTH - 100 ? 'var(--accent-2)' : 'var(--text-3)';

  async function handleAnalyze(refinementText = null) {
    const analysisText = refinementText || text.trim();
    if (!analysisText || analysisText.length < 3) return;
    setStatus('loading');
    setResult(null);
    setErrorMsg('');
    setClarified(false);
    try {
      const r = await api.analyzeText({ text: analysisText, meal_type: mealType, ...(date && { date }) }, token);
      setResult(r);
      setAdjustedKcal(String(r.total.calories));
      setStatus('result');
    } catch (err) {
      if (err.data?.error === 'ai_limit_reached' && onAiLimit) {
        onAiLimit(err.data);
      } else {
        setErrorMsg(err.data?.message || err.message || 'Error al analizar. Inténtalo de nuevo.');
        setStatus('error');
      }
    }
  }

  function getFinalCalories() {
    const v = parseInt(adjustedKcal);
    return isNaN(v) ? result.total.calories : v;
  }

  function handleSave() {
    if (!result) return;
    const finalCal = getFinalCalories();
    const ratio    = finalCal / (result.total.calories || 1);

    onResult({
      name:     result.name,
      calories: finalCal,
      protein:  parseFloat((result.total.protein * ratio).toFixed(1)),
      carbs:    parseFloat((result.total.carbs   * ratio).toFixed(1)),
      fat:      parseFloat((result.total.fat     * ratio).toFixed(1)),
      // Calibration metadata for correction tracking
      _ai: {
        ai_raw:            result.ai_raw_calories,
        ai_calibrated:     result.total.calories,
        categories:        result.categories,
        source:            'text',
        input_text:        result.input_text || null,
        ai_response_text:  result.ai_response_text || null,
      },
    });
    handleClose();
  }

  function handleClose() {
    setText('');
    setStatus('idle');
    setResult(null);
    setErrorMsg('');
    setAdjusting(false);
    setAdjustedKcal('');
    setClarified(false);
    onClose();
  }

  return createPortal(
    <FocusTrap>
    <div
      className="modal-overlay"
      data-focus-trap-fallback
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="modal-sheet">
        {/* Handle */}
        <div className="modal-handle" />

        <div style={{ padding: '0 20px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Describir comida</h3>
            <button
              onClick={handleClose}
              aria-label="Cerrar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18,
                       color: 'var(--text-3)', lineHeight: 1, padding: 4 }}
            >✕</button>
          </div>

          {status !== 'result' && (
            <>
              {/* Textarea */}
              <div style={{ marginBottom: 12 }}>
                <textarea
                  rows={4}
                  maxLength={MAX_TEXT_LENGTH}
                  placeholder={"Ej: 150g de pechuga a la plancha con ensalada, un yogur griego y una pieza de fruta"}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    resize: 'vertical', fontSize: 14,
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                    outline: 'none',
                    lineHeight: 1.5,
                  }}
                />
                <div style={{ textAlign: 'right', fontSize: 11, color: charColor, marginTop: 3 }}>
                  {charCount}/{MAX_TEXT_LENGTH}
                </div>
              </div>

              {/* Tips */}
              <div style={{
                fontSize: 12, color: 'var(--text-2)',
                background: 'var(--surface)', borderRadius: 10,
                padding: '10px 14px', marginBottom: 16,
                border: '1px solid var(--border)',
              }}>
                <p style={{ margin: '0 0 4px', fontWeight: 600 }}>💡 Mejor precisión:</p>
                <p style={{ margin: '2px 0' }}>· Indica la cantidad si la sabes (150g, 1 taza...)</p>
                <p style={{ margin: '2px 0' }}>· Menciona el método de cocción (plancha, frito, hervido)</p>
                <p style={{ margin: '2px 0' }}>· Especifica si es casero o de restaurante</p>
              </div>

              {/* Analyze button */}
              <button
                className="btn btn-primary btn-full"
                disabled={text.trim().length < 3 || status === 'loading'}
                onClick={() => handleAnalyze()}
                style={{ marginBottom: 20, fontSize: 15, padding: '12px 0' }}
              >
                {status === 'loading'
                  ? <><span className="spinner" style={{ width: 14, height: 14, marginRight: 8 }} />Analizando...</>
                  : '✨ Analizar con IA'}
              </button>

              {/* Example chips */}
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, textAlign: 'center' }}>
                  — O prueba estos ejemplos —
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {EXAMPLES.map(ex => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => setText(ex.text)}
                      style={{
                        fontSize: 12, padding: '5px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: 99, background: 'var(--surface)',
                        color: 'var(--text-2)', cursor: 'pointer',
                      }}
                    >{ex.label}</button>
                  ))}
                </div>
              </div>

              {status === 'error' && (
                <div className="alert alert-error" style={{ marginTop: 16 }}>{errorMsg}</div>
              )}
            </>
          )}

          {/* Result */}
          {status === 'result' && result && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 6 }}>
                ✨ Análisis completado
              </p>
              <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>{result.name}</p>

              {/* Item breakdown */}
              {result.items?.length > 0 && (
                <div style={{
                  border: '1px solid var(--border)', borderRadius: 10,
                  overflow: 'hidden', marginBottom: 16,
                }}>
                  {result.items.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '9px 14px',
                      borderBottom: i < result.items.length - 1 ? '1px solid var(--border)' : 'none',
                      fontSize: 13,
                    }}>
                      <span style={{ color: 'var(--text-2)' }}>
                        {item.name}
                        {item.quantity && <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 6 }}>({item.quantity})</span>}
                      </span>
                      <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                        {item.calories} kcal
                      </span>
                    </div>
                  ))}
                  {/* Total row */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px',
                    background: 'var(--surface)',
                    borderTop: '2px solid var(--border)',
                    fontSize: 14, fontWeight: 700,
                  }}>
                    <span>Total</span>
                    {adjusting ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="number"
                          value={adjustedKcal}
                          onChange={e => setAdjustedKcal(e.target.value)}
                          style={{
                            width: 72, textAlign: 'right', fontWeight: 700,
                            border: '1px solid var(--accent)', borderRadius: 6,
                            padding: '3px 6px', fontSize: 14,
                            background: 'var(--bg)', color: 'var(--text)',
                          }}
                        />
                        <span style={{ fontSize: 13 }}>kcal</span>
                        <button
                          type="button" onClick={() => setAdjusting(false)}
                          aria-label="Confirmar calorías"
                          style={{ fontSize: 11, color: 'var(--accent)', background: 'none',
                                   border: 'none', cursor: 'pointer', padding: 0 }}
                        >✓</button>
                      </div>
                    ) : (
                      <span>
                        {getFinalCalories()} kcal{' '}
                        <button
                          type="button" onClick={() => { setAdjusting(true); setAdjustedKcal(String(getFinalCalories())); }}
                          aria-label="Ajustar calorías"
                          style={{ fontSize: 12, color: 'var(--text-3)', background: 'none',
                                   border: 'none', cursor: 'pointer', padding: 0, marginLeft: 4 }}
                        >✏️</button>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Macros */}
              <div style={{ display: 'flex', gap: 12, fontSize: 13, marginBottom: 14, flexWrap: 'wrap' }}>
                {result.total.protein > 0 && <span className="color-protein"><b>{result.total.protein}g</b> prot</span>}
                {result.total.carbs   > 0 && <span className="color-carbs"><b>{result.total.carbs}g</b> carb</span>}
                {result.total.fat     > 0 && <span className="color-fat"><b>{result.total.fat}g</b> grasa</span>}
              </div>

              {/* Calibración aplicada */}
              {result.calibration_applied && result.calibration_confidence > 0.3 && (
                <p style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8 }}>
                  🎯 Ajustado a tus hábitos · {result.calibration_data_points} correcciones
                </p>
              )}

              {/* Comida similar */}
              {result.similar_meal && (
                <div style={{
                  padding: '8px 10px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 8, marginBottom: 10,
                }}>
                  <p style={{ fontSize: 12, margin: '0 0 4px' }}>
                    💡 Similar a <strong>{result.similar_meal.name}</strong>
                    {' '}({result.similar_meal.avg_kcal} kcal · {result.similar_meal.times}× registrada)
                  </p>
                  <button
                    type="button"
                    onClick={() => setAdjustedKcal(String(result.similar_meal.avg_kcal))}
                    style={{ fontSize: 11, color: 'var(--accent)', background: 'none',
                             border: 'none', cursor: 'pointer', padding: 0 }}
                  >Usar {result.similar_meal.avg_kcal} kcal →</button>
                </div>
              )}

              {/* Confianza + notas */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: CONFIDENCE_COLOR[result.confidence] || 'var(--text-3)',
                  flexShrink: 0,
                }} />
                Confianza: {CONFIDENCE_LABEL[result.confidence] || result.confidence}
              </div>
              {result.notes && (
                <p style={{ fontSize: 12, color: 'var(--text-2)', fontStyle: 'italic', marginBottom: 12 }}>
                  {result.notes}
                </p>
              )}

              {/* Clarification prompt — only for low confidence */}
              {result.confidence === 'low' && result.clarification_question && !clarified && (
                <div style={{
                  background: 'var(--surface)', border: '0.5px solid var(--border)',
                  borderRadius: 8, padding: '8px 12px', marginBottom: 12,
                }}>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '0 0 6px' }}>
                    {result.clarification_question}
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {result.clarification_options?.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleAnalyze(text.trim() + ' — ' + opt)}
                        style={{
                          padding: '4px 10px', fontSize: 11, borderRadius: 99,
                          border: '0.5px solid var(--border)',
                          background: 'var(--surface-2)',
                          color: 'var(--text-2)', cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setClarified(true)}
                      style={{
                        padding: '4px 8px', fontSize: 11, borderRadius: 99,
                        border: 'none', background: 'none',
                        color: 'var(--text-3)', cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Ignorar
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>
                  ✓ Guardar
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setStatus('idle'); setResult(null); }}
                >
                  Volver
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </FocusTrap>,
    document.body
  );
}
