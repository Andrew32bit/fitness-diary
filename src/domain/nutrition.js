import { toNumber } from "../data/schema.js";

const round2 = (n) => Math.round(n * 100) / 100;

export function dayTotals(day) {
  const meals = day?.meals || [];
  const totals = meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + (toNumber(m.kcal) || 0),
      protein: acc.protein + (toNumber(m.protein) || 0),
      fat: acc.fat + (toNumber(m.fat) || 0),
      carbs: acc.carbs + (toNumber(m.carbs) || 0),
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );
  return {
    kcal: round2(totals.kcal),
    protein: round2(totals.protein),
    fat: round2(totals.fat),
    carbs: round2(totals.carbs),
  };
}

export function scaleFood(food, grams) {
  const base = toNumber(food.portionG) || 100;
  const factor = (toNumber(grams) || 0) / base;
  const scale = (v) => {
    const n = toNumber(v);
    return n === null ? null : round2(n * factor);
  };
  return { kcal: scale(food.kcal), protein: scale(food.protein), fat: scale(food.fat), carbs: scale(food.carbs) };
}

export function burned(workouts) {
  return (workouts || []).reduce((sum, w) => sum + (toNumber(w.kcalActive) || 0), 0);
}
