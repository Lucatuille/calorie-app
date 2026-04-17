// ============================================================
//  chefWarningMessages — traduce `warnings` del backend a banners UX.
//
//  El backend (planner.js) emite objetos warnings con semántica nutricional
//  real. Aquí los convertimos a {tone, title, detail} que ChefWarningBanner
//  sabe renderizar. Un solo warning → 1 banner; varios → varios stacks.
// ============================================================

import type { WarningTone } from './ChefWarningBanner';

export type KcalMismatchIssue = {
  name: string;
  declared: number;
  estimate: number;
  diff_pct: number; // negativo si Sonnet subestimó
  date?: string;    // presente en week, ausente en day
};

export type DayWarnings = {
  over_budget?:   { exceeded_by_kcal: number } | null;
  off_budget?:    { actual_kcal: number; target_kcal: number; diff: number } | null;
  low_protein?:   { actual_g: number; target_g: number } | null;
  kcal_mismatch?: KcalMismatchIssue[] | null;
};

export type WeekWarnings = {
  off_budget_days?:   Array<{ date: string; actual_kcal: number; target_kcal: number; diff: number }> | null;
  low_protein_days?:  Array<{ date: string; actual_g: number; target_g: number }> | null;
  over_budget_today?: { exceeded_by_kcal: number } | null;
  repeats?:           Array<{ name: string; count: number }> | null;
  kcal_mismatch?:     KcalMismatchIssue[] | null;
};

export type BannerData = { tone: WarningTone; title: string; detail: string };

/** "2026-04-18" → "vie 18" */
function formatShortDate(iso: string): string {
  try {
    // Parse como local a mediodía para evitar UTC shifts.
    const d = new Date(iso + 'T12:00:00');
    if (isNaN(d.getTime())) return iso;
    const names = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    return `${names[d.getDay()]} ${d.getDate()}`;
  } catch {
    return iso;
  }
}

/**
 * Convierte los warnings del plan del día en banners.
 * Orden de prioridad: over_budget (más urgente) → low_protein → off_budget.
 */
export function daySummaryWarnings(w: DayWarnings | null | undefined): BannerData[] {
  if (!w) return [];
  const out: BannerData[] = [];

  if (w.over_budget) {
    out.push({
      tone: 'warn',
      title: `Ya te has pasado hoy por ${w.over_budget.exceeded_by_kcal} kcal`,
      detail: 'El plan se limita a una opción ligera (o queda vacío) para no empeorar el balance del día.',
    });
  }

  if (w.low_protein) {
    out.push({
      tone: 'warn',
      title: `Proteína baja: ${w.low_protein.actual_g}g de ${w.low_protein.target_g}g pendientes`,
      detail: 'El plan no cubre el piso nutricional (mínimo 85%). Considera añadir pechuga, atún, huevo o yogur griego si quieres reforzarlo.',
    });
  }

  if (w.off_budget) {
    const diff = w.off_budget.diff;
    const direction = diff > 0 ? 'por encima' : 'por debajo';
    out.push({
      tone: 'info',
      title: `Plan ${Math.abs(diff)} kcal ${direction} de tu objetivo`,
      detail: 'La IA no consiguió ajustar porciones dentro del margen automático. Puedes regenerar o editar cada plato a mano.',
    });
  }

  if (w.kcal_mismatch?.length) {
    const n = w.kcal_mismatch.length;
    const shown = w.kcal_mismatch.slice(0, 2).map(i =>
      `${i.name} (declara ${i.declared} · ingredientes ~${i.estimate})`
    ).join(', ');
    const more = n > 2 ? ` y ${n - 2} más` : '';
    out.push({
      tone: 'error',
      title: n === 1 ? 'Kcal no cuadra con los ingredientes' : `${n} platos con kcal inconsistente`,
      detail: `${shown}${more}. La IA ha calculado mal. Regenera o edita el valor manualmente antes de registrar.`,
    });
  }

  return out;
}

/**
 * Convierte los warnings del plan semanal en banners.
 * Prioridad similar: over_budget_today → low_protein_days → off_budget_days → repeats.
 */
export function weekSummaryWarnings(w: WeekWarnings | null | undefined): BannerData[] {
  if (!w) return [];
  const out: BannerData[] = [];

  if (w.over_budget_today) {
    out.push({
      tone: 'warn',
      title: `Hoy ya te has pasado por ${w.over_budget_today.exceeded_by_kcal} kcal`,
      detail: 'El plan semanal solo genera los días restantes; hoy queda sin sugerencia nueva.',
    });
  }

  if (w.low_protein_days?.length) {
    const n = w.low_protein_days.length;
    const days = w.low_protein_days.map(d => formatShortDate(d.date)).join(', ');
    out.push({
      tone: 'warn',
      title: `Proteína insuficiente en ${n} día${n > 1 ? 's' : ''}`,
      detail: `Por debajo del piso nutricional en: ${days}. Edita esos días si quieres asegurar los gramos.`,
    });
  }

  if (w.off_budget_days?.length) {
    const n = w.off_budget_days.length;
    const days = w.off_budget_days.map(d => formatShortDate(d.date)).join(', ');
    out.push({
      tone: 'info',
      title: n === 1 ? 'Un día fuera del margen calórico' : `${n} días fuera del margen calórico`,
      detail: `Desviación notable en: ${days}. Puedes regenerar o ajustar los platos de esos días.`,
    });
  }

  if (w.repeats?.length) {
    const shown = w.repeats.slice(0, 3).map(r => `${r.name} (${r.count}×)`).join(', ');
    const more = w.repeats.length > 3 ? ` y ${w.repeats.length - 3} más` : '';
    out.push({
      tone: 'info',
      title: 'Platos repetidos en la semana',
      detail: `Aparecen más de 2 veces: ${shown}${more}.`,
    });
  }

  if (w.kcal_mismatch?.length) {
    const n = w.kcal_mismatch.length;
    // Agrupar por fecha para no listar cada meal individualmente
    const byDate = new Map<string, number>();
    for (const i of w.kcal_mismatch) {
      const k = i.date || '?';
      byDate.set(k, (byDate.get(k) || 0) + 1);
    }
    const dates = Array.from(byDate.entries()).map(([d, c]) =>
      `${formatShortDate(d)} (${c})`
    ).join(', ');
    out.push({
      tone: 'error',
      title: n === 1 ? 'Un plato con kcal inconsistente' : `${n} platos con kcal inconsistente`,
      detail: `Las calorías no cuadran con los ingredientes en: ${dates}. Revisa esos días antes de registrar.`,
    });
  }

  return out;
}
