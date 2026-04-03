import { usePageTitle } from '../hooks/usePageTitle';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { isFree } from '../utils/levels';
import TDEECalculator from '../components/TDEECalculator';

function exportCSV(entries) {
  const header = 'Fecha,Calorías,Proteína(g),Carbos(g),Grasa(g),Peso(kg),Notas';
  const rows = entries.map(e =>
    [e.date, e.calories, e.protein||'', e.carbs||'', e.fat||'', e.weight||'', `"${(e.notes||'').replace(/"/g,'""')}"`].join(',')
  );
  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `historial-kcal-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const card = {
  background: 'var(--surface)',
  border: '0.5px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '16px',
};

// sectionLabel → uses .section-label class + marginBottom override

const inputStyle = {
  background: 'var(--surface)',
  border: '0.5px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 12px',
  fontSize: 14,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const microLabel = {
  fontSize: 10,
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-sans)',
  marginBottom: 4,
  display: 'block',
};

export default function Profile() {
  usePageTitle('Perfil');
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', age: '', weight: '', height: '', gender: 'male',
    target_calories: '', target_protein: '', target_carbs: '', target_fat: '',
    goal_weight: '',
  });
  const [saved,        setSaved]        = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [exporting,    setExporting]    = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showTDEE,     setShowTDEE]     = useState(false);
  const [calibration,  setCalibration]  = useState(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.getCalibrationProfile(token).then(setCalibration).catch(() => {});
  }, [token]);

  useEffect(() => {
    api.getProfile(token).then(p => {
      setForm({
        name:            p.name            || '',
        age:             p.age             || '',
        weight:          p.weight          || '',
        height:          p.height          || '',
        gender:          p.gender          || 'male',
        target_calories: p.target_calories || '',
        target_protein:  p.target_protein  || '',
        target_carbs:    p.target_carbs    || '',
        target_fat:      p.target_fat      || '',
        goal_weight:     p.goal_weight     || '',
      });
    }).catch(() => {});
  }, [token]);

  async function handleSave(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.updateProfile(form, token);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  async function handleTDEESave(tdeeData) {
    const current = await api.getProfile(token);
    await api.updateProfile({ ...current, ...tdeeData }, token);
    const p = await api.getProfile(token);
    setForm(f => ({
      ...f,
      target_calories: p.target_calories || '',
      target_protein:  p.target_protein  || '',
      target_carbs:    p.target_carbs    || '',
      target_fat:      p.target_fat      || '',
    }));
  }

  async function handleResetCalibration() {
    await api.resetCalibration(token);
    setCalibration(null);
    setResetConfirm(false);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const entries = await api.getAllEntries(365, token);
      exportCSV(entries);
    } catch { }
    finally { setExporting(false); }
  }

  // Confidence label
  const confidenceLabel = !calibration ? '' :
    calibration.confidence < 0.3 ? 'Aprendiendo' :
    calibration.confidence < 0.6 ? 'Mejorando' :
    calibration.confidence < 0.8 ? 'Buena precisión' : 'Alta precisión';

  return (
    <section className="page">

      {/* ── Header ── */}
      <header style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 36,
          fontWeight: 400,
          color: 'var(--text-primary)',
          lineHeight: 1.1,
          margin: 0,
        }}>
          {form.name || 'Mi perfil'}
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
          {user?.email}
        </p>
      </header>

      {/* ── Upgrade entry (solo Free) ── */}
      {isFree(user?.access_level) && (
        <Link to="/upgrade" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(145deg, #1c1c1c, #111111)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          marginBottom: 12,
          textDecoration: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
              background: 'var(--accent)', color: 'white',
              borderRadius: 4, padding: '2px 6px',
              fontFamily: 'var(--font-sans)', flexShrink: 0,
            }}>PRO</span>
            <span style={{
              fontFamily: 'var(--font-serif)', fontStyle: 'italic',
              fontSize: 17, color: 'rgba(255,255,255,0.85)', fontWeight: 400,
            }}>Actualiza a Pro</span>
          </div>
          <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }}>›</span>
        </Link>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Card: Sobre ti ── */}
        <div style={card}>
          <p className="section-label" style={{ marginBottom: 12 }}>Sobre ti</p>

          {/* Nombre */}
          <div style={{ marginBottom: 14 }}>
            <span style={microLabel}>Nombre</span>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Tu nombre"
            />
          </div>

          {/* Género — ghost pills */}
          <div style={{ marginBottom: 14 }}>
            <span style={microLabel}>Sexo</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['male','Hombre'], ['female','Mujer']].map(([val, label]) => {
                const active = form.gender === val;
                return (
                  <button key={val} type="button"
                    onClick={() => set('gender', val)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      fontSize: 13,
                      fontFamily: 'var(--font-sans)',
                      fontWeight: active ? 600 : 400,
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      background: active ? 'rgba(45,106,79,0.08)' : 'transparent',
                      border: `0.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Edad / Peso / Altura */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { k: 'age',    label: 'Edad',       placeholder: '25', step: undefined },
              { k: 'weight', label: 'Peso (kg)',   placeholder: '70', step: '0.1' },
              { k: 'height', label: 'Altura (cm)', placeholder: '175', step: undefined },
            ].map(({ k, label, placeholder, step }) => (
              <div key={k}>
                <span style={microLabel}>{label}</span>
                <input
                  type="number"
                  step={step}
                  placeholder={placeholder}
                  value={form[k]}
                  onChange={e => set(k, e.target.value)}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Card: Objetivos ── */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p className="section-label" style={{ marginBottom: 0 }}>Objetivos</p>
            <button type="button"
              onClick={() => setShowTDEE(true)}
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                background: 'transparent',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-full)',
                padding: '3px 10px',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                letterSpacing: '0.02em',
              }}>
              Calcular TDEE
            </button>
          </div>

          {/* Calorías + Peso objetivo en fila */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <span style={microLabel}>Objetivo kcal/día</span>
              <input
                type="number"
                placeholder="2000"
                value={form.target_calories}
                onChange={e => set('target_calories', e.target.value)}
                style={{ ...inputStyle, fontWeight: 600, fontSize: 16 }}
              />
            </div>
            <div>
              <span style={microLabel}>Peso objetivo (kg)</span>
              <input
                type="number"
                step="0.1"
                placeholder="65"
                value={form.goal_weight}
                onChange={e => set('goal_weight', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Macros */}
          <div style={{ marginBottom: 16 }}>
            <span style={{ ...microLabel, marginBottom: 8 }}>Macros diarios (opcional)</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { k: 'target_protein', label: 'Proteína g', color: '#2d6a4f', placeholder: '150' },
                { k: 'target_carbs',   label: 'Carbos g',   color: '#d4a017', placeholder: '200' },
                { k: 'target_fat',     label: 'Grasa g',    color: '#5b8dd9', placeholder: '65' },
              ].map(({ k, label, color, placeholder }) => (
                <div key={k}>
                  <span style={{ ...microLabel, color }}>{label}</span>
                  <input
                    type="number"
                    placeholder={placeholder}
                    value={form[k]}
                    onChange={e => set(k, e.target.value)}
                    style={{
                      ...inputStyle,
                      borderBottom: `1.5px solid ${color}`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: 'var(--radius-md)', marginBottom: 12 }}>
              {error}
            </div>
          )}
          {saved && (
            <div style={{ fontSize: 12, color: 'var(--accent)', padding: '8px 12px', background: 'rgba(45,106,79,0.08)', borderRadius: 'var(--radius-md)', marginBottom: 12 }}>
              Perfil actualizado
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{
              padding: '11px 28px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              alignSelf: 'flex-start',
            }}>
            {loading ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      <TDEECalculator
        isOpen={showTDEE}
        onClose={() => setShowTDEE(false)}
        onSave={handleTDEESave}
      />

      {/* ── Motor personal (dark card) ── */}
      {calibration && calibration.data_points >= 3 && (
        <div style={{
          marginTop: 12,
          background: 'linear-gradient(145deg, #1c1c1c, #111111)',
          border: '0.5px solid rgba(255,255,255,0.06)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
              background: 'var(--accent)', color: 'white',
              borderRadius: 4, padding: '2px 6px',
            }}>Pro</span>
            <span style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 17,
              color: 'rgba(255,255,255,0.9)',
              fontWeight: 400,
            }}>
              Tu motor personal
            </span>
          </div>

          {/* Confianza */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-sans)' }}>
                {calibration.data_points} correcciones registradas
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)' }}>
                {confidenceLabel}
              </span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.round(calibration.confidence * 100)}%`,
                minWidth: calibration.confidence > 0 ? 6 : 0,
                background: calibration.confidence >= 0.6 ? 'var(--accent)' : '#f59e0b',
                borderRadius: 99, transition: 'width 0.6s',
              }} />
            </div>
          </div>

          {/* Bias */}
          {Math.abs(calibration.global_bias) > 0.05 && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12, fontFamily: 'var(--font-sans)', lineHeight: 1.4 }}>
              {calibration.global_bias > 0
                ? `La IA tiende a subestimarte un ${Math.round(calibration.global_bias * 100)}%`
                : `La IA tiende a sobreestimarte un ${Math.round(Math.abs(calibration.global_bias) * 100)}%`
              }
            </p>
          )}

          {/* Comidas frecuentes */}
          {calibration.frequent_meals?.length > 0 && (() => {
            const merged = [];
            for (const meal of calibration.frequent_meals) {
              const words = meal.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
              const existing = merged.find(m => {
                const mw = m.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
                const hits = words.filter(w => mw.includes(w));
                return hits.length >= 2 || (words.length === 1 && hits.length === 1);
              });
              if (existing) {
                const total = existing.times + meal.times;
                existing.avg_kcal = Math.round(
                  (existing.avg_kcal * existing.times + meal.avg_kcal * meal.times) / total
                );
                existing.times = total;
                if (meal.name.length < existing.name.length) existing.name = meal.name;
              } else {
                merged.push({ ...meal });
              }
            }
            const top = merged.sort((a, b) => b.times - a.times).slice(0, 3);
            return (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.7px', fontWeight: 600, color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>
                  Más registradas
                </p>
                {top.map(meal => (
                  <div key={meal.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 7, marginBottom: 7, borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-sans)' }}>{meal.name}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-sans)', flexShrink: 0, marginLeft: 8 }}>{meal.avg_kcal} kcal · {meal.times}×</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Reset */}
          {!resetConfirm ? (
            <button
              onClick={() => setResetConfirm(true)}
              style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)' }}>
              Resetear calibración
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-sans)' }}>¿Borrar historial de aprendizaje?</span>
              <button
                onClick={handleResetCalibration}
                style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                Confirmar
              </button>
              <button
                onClick={() => setResetConfirm(false)}
                style={{ fontSize: 11, padding: '4px 10px', background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Historial (acceso móvil) ── */}
      <Link to="/history" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 20, padding: '14px 16px',
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        textDecoration: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <span style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
            Historial
          </span>
        </div>
        <span style={{ fontSize: 16, color: 'var(--text-tertiary)' }}>›</span>
      </Link>

      {/* ── Gestionar suscripción (solo Pro activo) ── */}
      {user?.access_level === 2 && (
        <button
          onClick={async () => {
            setPortalLoading(true);
            try {
              const { url } = await api.createPortalSession(token);
              window.location.href = url;
            } catch { /* silent */ }
            finally { setPortalLoading(false); }
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '14px 16px', marginTop: 8, marginBottom: 0,
            background: 'var(--surface)', border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)', textDecoration: 'none',
            cursor: 'pointer', opacity: portalLoading ? 0.5 : 1,
            pointerEvents: portalLoading ? 'none' : 'auto',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>💳</span>
            <span style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
              Gestionar suscripción
            </span>
          </div>
          <span style={{ fontSize: 16, color: 'var(--text-tertiary)' }}>›</span>
        </button>
      )}

      {/* ── Footer: export + legal ── */}
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '0.5px solid var(--border)' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
          Exportar historial
        </span>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-full)',
            padding: '5px 14px',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}>
          {exporting ? 'Exportando…' : 'CSV'}
        </button>
      </div>

      <p style={{
        marginTop: 8,
        marginBottom: 8,
        fontSize: 10,
        color: 'var(--text-tertiary)',
        lineHeight: 1.6,
        textAlign: 'center',
        opacity: 0.6,
        fontFamily: 'var(--font-sans)',
      }}>
        Caliro v1.0 · Herramienta de tracking nutricional personal
        <br />
        No es un dispositivo médico ni sustituye asesoramiento clínico.
        <br />
        <Link to="/privacy" style={{ color: 'var(--text-tertiary)' }}>Política de privacidad</Link>
      </p>

      {user?.access_level === 99 && (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-admin'))}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-tertiary)', fontSize: 11,
            opacity: 0.3, cursor: 'pointer',
            padding: 8, display: 'block', margin: '0 auto',
          }}>
          admin
        </button>
      )}

      {/* Cerrar sesión — visible en móvil donde no hay botón en la navbar */}
      <button
        className="profile-logout-mobile"
        onClick={() => { logout(); navigate('/login'); }}
        style={{
          display: 'none',
          width: '100%', marginTop: 8,
          padding: '12px', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          fontSize: 14, fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
        }}>
        Cerrar sesión
      </button>
    </section>
  );
}
