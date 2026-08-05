const round2 = (n) => Math.round(n * 100) / 100;

export function paceSecPerKm(workout) {
  const km = workout?.distanceKm;
  const sec = workout?.durationSec;
  if (!km || !sec) return null;
  return sec / km;
}

export function fmtPace(secPerKm) {
  if (!secPerKm || !Number.isFinite(secPerKm)) return "—";
  const total = Math.round(secPerKm);
  const min = Math.floor(total / 60);
  const sec = String(total % 60).padStart(2, "0");
  return `${min}'${sec}"`;
}

export function fmtDuration(seconds) {
  const total = Math.round(seconds || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Номер ISO-недели: неделя начинается в понедельник, первая неделя содержит 4 января. */
export function isoWeek(date) {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // понедельник = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // четверг той же недели
  const thursday = d.getTime();
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((thursday - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function groupVolume(workouts, type, keyOf) {
  const buckets = new Map();
  for (const w of workouts) {
    if (type && w.type !== type) continue;
    if (!w.distanceKm) continue;
    const key = keyOf(w);
    const bucket = buckets.get(key) || { km: 0, count: 0 };
    bucket.km += w.distanceKm;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, v]) => ({ key, km: round2(v.km), count: v.count }));
}

/**
 * Объём по календарным месяцам, по возрастанию месяца.
 * @returns {{ month: string, km: number, count: number }[]} `month` — `"ГГГГ-ММ"`,
 *   `km` округлён до двух знаков, `count` — число тренировок с ненулевой дистанцией.
 *   Месяцы без подходящих тренировок в списке отсутствуют, а не приходят с нулём.
 */
export function monthlyVolume(workouts, type = "running") {
  return groupVolume(workouts, type, (w) => w.date.slice(0, 7)).map(({ key, km, count }) => ({ month: key, km, count }));
}

/**
 * То же по ISO-неделям.
 * @returns {{ week: string, km: number, count: number }[]} `week` — `"ГГГГ-Wнн"`.
 */
export function weeklyVolume(workouts, type = "running") {
  return groupVolume(workouts, type, (w) => isoWeek(w.date)).map(({ key, km, count }) => ({ week: key, km, count }));
}

export function movingAverage(values, window) {
  return values.map((_, i) => {
    if (i + 1 < window) return null;
    const slice = values.slice(i + 1 - window, i + 1);
    return round2(slice.reduce((a, b) => a + b, 0) / window);
  });
}

/**
 * Доля пробежек с пульсом ниже порога, по месяцам.
 * @returns {{ month: string, share: number, total: number }[]} `share` — доля от 0 до 1,
 *   НЕ проценты, и намеренно не округляется: округляет UI при показе. `total` — число
 *   пробежек с записанным пульсом; пробежки без пульса не входят ни в числитель, ни в
 *   знаменатель, поэтому доля считается только по тем, о которых вообще можно судить.
 */
export function zone2ShareByMonth(workouts, maxHr) {
  const buckets = new Map();
  for (const w of workouts) {
    if (w.type !== "running" || !w.hrAvg) continue;
    const month = w.date.slice(0, 7);
    const bucket = buckets.get(month) || { low: 0, total: 0 };
    bucket.total += 1;
    if (w.hrAvg < maxHr) bucket.low += 1;
    buckets.set(month, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, v]) => ({ month, share: v.low / v.total, total: v.total }));
}

/** Метры дистанции на один удар пульса — прокси формы, не требующий максимального пульса. */
export function efficiency(workout) {
  const km = workout?.distanceKm;
  const sec = workout?.durationSec;
  const hr = workout?.hrAvg;
  if (!km || !sec || !hr) return null;
  const metersPerMinute = (km * 1000) / (sec / 60);
  return metersPerMinute / hr;
}

export function efficiencyByMonth(workouts) {
  const buckets = new Map();
  for (const w of workouts) {
    const value = efficiency(w);
    if (value === null || w.type !== "running") continue;
    const month = w.date.slice(0, 7);
    const bucket = buckets.get(month) || { sum: 0, n: 0 };
    bucket.sum += value;
    bucket.n += 1;
    buckets.set(month, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, v]) => ({ month, value: round2(v.sum / v.n) }));
}
