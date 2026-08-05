// Палитра дословно из health diary.tsx:813 — вид не должен измениться.
export const C = {
  bg: "#ffffff",
  card: "#f7f7f5",
  border: "#e5e4e0",
  text: "#1a1a1a",
  text2: "#666663",
  text3: "#999996",
  sub: "#eeede9",
};

export const MACRO_COLORS = { protein: "#818CF8", fat: "#FBBF24", carbs: "#22D3EE" };

// Целей по макронутриентам здесь намеренно нет: это личные числа пользователя,
// им место в настройках на устройстве, а не в публичном репозитории.
// Дневник берёт их из `store.settings` — `proteinGoal`, `fatGoal`, `carbsGoal`.
