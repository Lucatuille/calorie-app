export interface MealType {
  id: string;
  label: string;
  icon: string;
}

export const MEAL_TYPES: MealType[] = [
  { id: 'breakfast', label: 'Desayuno', icon: '🌅' },
  { id: 'lunch',     label: 'Comida',   icon: '☀️'  },
  { id: 'dinner',    label: 'Cena',     icon: '🌙'  },
  { id: 'snack',     label: 'Snack',    icon: '🍎'  },
  { id: 'other',     label: 'Otro',     icon: '🍴'  },
];

export function getMeal(id: string | null | undefined): MealType {
  return MEAL_TYPES.find(m => m.id === id) || MEAL_TYPES[4];
}
