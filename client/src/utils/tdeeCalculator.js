// ── TDEE Calculation — Mifflin-St Jeor ──────────────────────
// Shared between Onboarding and Profile TDEE wizard

export function calculateTDEE({ gender, age, weight, height, activity }) {
  const bmr = gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const factors = {
    sedentary:   1.2,
    light:       1.375,
    moderate:    1.55,
    active:      1.725,
    very_active: 1.9,
  };

  return Math.round(bmr * (factors[activity] || 1.55));
}

export function calculateTargetCalories(tdee, goal) {
  switch (goal) {
    case 'lose':     return Math.round(tdee - 400);
    case 'gain':     return Math.round(tdee + 300);
    case 'maintain': return tdee;
    default:         return tdee;
  }
}

export function calculateMonthsToGoal(currentWeight, goalWeight, dailyDeficit) {
  if (!goalWeight || dailyDeficit <= 0) return null;
  const kgToLose = currentWeight - goalWeight;
  if (kgToLose <= 0) return null;
  return Math.ceil((kgToLose * 7700) / dailyDeficit / 30);
}
