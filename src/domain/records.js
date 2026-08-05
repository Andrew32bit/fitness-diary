import { paceSecPerKm } from "./aggregate.js";

const PACE_THRESHOLDS = [5, 8, 10];

/**
 * Рекорды по всей истории.
 * @returns {{ maxDistanceKm: number|null, maxKcal: number|null, bestPace: Object }}
 *   `bestPace` — объект, ключи которого это ПОРОГИ ДИСТАНЦИИ в километрах (5, 8, 10),
 *   а не индексы: `bestPace[5]` — лучший темп среди пробежек на 5 км и больше, в секундах
 *   на километр. Поэтому быстрая восьмёрка становится рекордом и для порога 5 км.
 *   `null` там, где ни одна пробежка порог не набрала. `maxKcal` считается по всем типам
 *   тренировок, `maxDistanceKm` — только по бегу.
 */
export function records(workouts) {
  const runs = workouts.filter((w) => w.type === "running");
  const distances = runs.map((w) => w.distanceKm).filter((v) => v > 0);
  const kcals = workouts.map((w) => w.kcalActive).filter((v) => v > 0);

  const bestPace = {};
  for (const threshold of PACE_THRESHOLDS) {
    const paces = runs
      .filter((w) => (w.distanceKm || 0) >= threshold)
      .map(paceSecPerKm)
      .filter((v) => v !== null);
    bestPace[threshold] = paces.length ? Math.min(...paces) : null;
  }

  return {
    maxDistanceKm: distances.length ? Math.max(...distances) : null,
    maxKcal: kcals.length ? Math.max(...kcals) : null,
    bestPace,
  };
}
