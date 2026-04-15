// ============================================================
//  ChefMealEditor — modal de edición manual de un meal de un plan.
//
//  Usado por ChefPlanDay y ChefPlanWeek. Campos editables:
//  nombre, kcal, proteína, carbs, grasa, ingredientes. El resto
//  (type, time) NO se edita aquí para no enredar el form.
//
//  Validaciones ligeras pero claras. El botón "Guardar" está
//  deshabilitado hasta que el form sea válido.
// ============================================================

import { useState, useEffect, useId } from 'react';

const CHEF_INK = 'var(--chef-ink)';

export type EditableMeal = {
  type?: string;
  time?: string;
  name: string;
  kcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  ingredients?: string;
};

type Props = {
  /** Meal a editar, o null para cerrar */
  meal: EditableMeal | null;
  /** Subtítulo opcional: ej. "Desayuno · Lunes 15" */
  subtitle?: string;
  /** Callback al guardar cambios (no se llama si validación falla) */
  onSave: (updated: EditableMeal) => void;
  /** Callback al cerrar sin guardar */
  onClose: () => void;
};

// Parse numérico tolerante: "" → 0, "abc" → 0, "40.5" → 40.5
function parseNum(v: string): number {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function ChefMealEditor({ meal, subtitle, onSave, onClose }: Props) {
  const nameId = useId();

  const [name, setName]               = useState('');
  const [kcal, setKcal]               = useState('');
  const [protein, setProtein]         = useState('');
  const [carbs, setCarbs]             = useState('');
  const [fat, setFat]                 = useState('');
  const [ingredients, setIngredients] = useState('');

  // Cargar valores del meal cada vez que cambie
  useEffect(() => {
    if (!meal) return;
    setName(meal.name || '');
    setKcal(meal.kcal != null ? String(meal.kcal) : '');
    setProtein(meal.protein != null ? String(meal.protein) : '');
    setCarbs(meal.carbs != null ? String(meal.carbs) : '');
    setFat(meal.fat != null ? String(meal.fat) : '');
    setIngredients(meal.ingredients || '');
  }, [meal]);

  if (!meal) return null;

  // Validación en vivo
  const trimmedName = name.trim();
  const kcalNum    = parseNum(kcal);
  const proteinNum = parseNum(protein);
  const carbsNum   = parseNum(carbs);
  const fatNum     = parseNum(fat);
  const nameOk    = trimmedName.length > 0 && trimmedName.length <= 200;
  const kcalOk    = kcalNum > 0 && kcalNum <= 5000;
  const macroOk   = proteinNum <= 500 && carbsNum <= 500 && fatNum <= 500;
  const ingredOk  = ingredients.length <= 500;
  const canSave   = nameOk && kcalOk && macroOk && ingredOk;

  function handleSave() {
    if (!canSave) return;
    onSave({
      ...meal,  // preservar type, time, etc
      name:    trimmedName,
      kcal:    Math.round(kcalNum),
      protein: Math.round(proteinNum),
      carbs:   Math.round(carbsNum),
      fat:     Math.round(fatNum),
      ingredients: ingredients.trim(),
    });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 1100, display: 'flex',
        alignItems: 'flex-end', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          padding: '22px 22px 20px', width: '100%', maxWidth: 440,
          maxHeight: '85vh', overflowY: 'auto',
          boxShadow: 'var(--shadow-md)',
          animation: 'chefFadeInUp 0.25s ease forwards',
        }}
      >
        <style>{`
          @keyframes chefFadeInUp {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* Header */}
        {subtitle && (
          <div style={{
            fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 4,
          }}>
            {subtitle}
          </div>
        )}
        <h3 style={{
          fontFamily: 'var(--font-serif)', fontStyle: 'italic',
          fontSize: 20, color: CHEF_INK, lineHeight: 1.2,
          margin: '0 0 18px', fontWeight: 400,
        }}>
          Editar plato
        </h3>

        {/* Nombre */}
        <label htmlFor={nameId} style={{
          fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--text-tertiary)', fontWeight: 600,
          display: 'block', marginBottom: 6,
        }}>
          Nombre
        </label>
        <input
          id={nameId}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={200}
          placeholder="Pechuga con arroz"
          style={{
            width: '100%', padding: '10px 14px',
            background: 'var(--bg)', border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-md)', fontSize: 14,
            color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
            outline: 'none', boxSizing: 'border-box', marginBottom: 14,
          }}
        />

        {/* Kcal + Macros grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 10, marginBottom: 14,
        }}>
          <NumberField label="Kcal" value={kcal} onChange={setKcal} required />
          <NumberField label="Proteína (g)" value={protein} onChange={setProtein} />
          <NumberField label="Carbos (g)"    value={carbs}   onChange={setCarbs} />
          <NumberField label="Grasa (g)"     value={fat}     onChange={setFat} />
        </div>

        {/* Ingredientes */}
        <label style={{
          fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--text-tertiary)', fontWeight: 600,
          display: 'block', marginBottom: 6,
        }}>
          Ingredientes
          <span style={{
            fontWeight: 400, textTransform: 'none', letterSpacing: 0,
            marginLeft: 4, color: 'var(--text-tertiary)',
          }}>
            opcional ({ingredients.length}/500)
          </span>
        </label>
        <textarea
          value={ingredients}
          onChange={e => setIngredients(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="180g pollo · 90g arroz · 200g brócoli"
          style={{
            width: '100%', padding: '10px 14px',
            background: 'var(--bg)', border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-md)', fontSize: 13,
            color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
            resize: 'none', outline: 'none',
            lineHeight: 1.5, boxSizing: 'border-box', marginBottom: 18,
          }}
        />

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1, background: 'transparent',
              color: 'var(--text-secondary)',
              border: '0.5px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              padding: '11px 18px', fontSize: 13, fontWeight: 500,
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            style={{
              flex: 1,
              background: canSave ? 'var(--accent)' : 'var(--text-tertiary)',
              color: '#fff', border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '11px 18px', fontSize: 13, fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: canSave ? 'pointer' : 'not-allowed',
              boxShadow: canSave ? '0 2px 6px rgba(45,106,79,0.2)' : 'none',
              opacity: canSave ? 1 : 0.6,
            }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Subcomponente: input numérico con label ─────────────────

function NumberField({
  label, value, onChange, required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={{
        fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--text-tertiary)', fontWeight: 600,
        display: 'block', marginBottom: 6,
      }}>
        {label}{required && <span style={{ color: 'var(--accent-2)' }}> *</span>}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step="1"
        min="0"
        max="5000"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px',
          background: 'var(--bg)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-md)', fontSize: 14,
          color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
          outline: 'none', boxSizing: 'border-box',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
    </div>
  );
}
