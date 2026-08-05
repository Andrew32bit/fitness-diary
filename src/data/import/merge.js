import { normalizeWorkout, SOURCE_PRIORITY, toNumber } from "../schema.js";
import { setMeta } from "../db.js";

export const MATCH_WINDOW_SEC = 120;

const emptyReport = () => ({ added: 0, updated: 0, unchanged: 0, conflicts: [] });
const isBlank = (v) => v === null || v === undefined || v === "";
const prio = (source) => SOURCE_PRIORITY[source] ?? 0;

export function findMatch(workout, existingList) {
  const exact = existingList.find((e) => e.id === workout.id);
  if (exact) return exact;
  const t = Date.parse(workout.start);
  return existingList.find(
    (e) => e.type === workout.type && Math.abs(Date.parse(e.start) - t) <= MATCH_WINDOW_SEC * 1000,
  ) || null;
}

export function mergeOne(existing, incoming) {
  const merged = { ...existing };
  const conflicts = [];
  let changed = false;
  const stronger = prio(incoming.source) > prio(existing.source);

  for (const [key, value] of Object.entries(incoming)) {
    if (key === "id" || key === "source" || key === "updatedAt") continue;
    if (isBlank(value)) continue;
    const current = merged[key];
    if (isBlank(current)) {
      merged[key] = value;
      changed = true;
      continue;
    }
    if (current === value) continue;
    if (existing.source === "manual") {
      conflicts.push({ field: key, mine: current, incoming: value });
      continue;
    }
    if (stronger) {
      merged[key] = value;
      changed = true;
      continue;
    }
    // Равный приоритет и разные значения: молча оставить старое нельзя. Это ровно
    // случай «пользователь исправил число в дневнике и переимпортировал файл» —
    // без этой ветки его собственная поправка выбрасывалась бы без следа.
    // Более слабый источник по-прежнему просто игнорируется.
    if (prio(incoming.source) === prio(existing.source)) {
      conflicts.push({ field: key, mine: current, incoming: value });
    }
  }

  if (changed) {
    // Метка "manual" не снимается никогда: она означает «человек трогал эту запись»
    // и служит защитой от перезаписи. Без этого условия одно дозаполнение пустого
    // поля любым автоисточником переводило source на него, запись теряла защиту,
    // и следующий импорт молча затирал введённое руками значение без конфликта.
    if (stronger && existing.source !== "manual") merged.source = incoming.source;
    merged.updatedAt = new Date().toISOString();
  }
  return { merged, changed, conflicts };
}

export async function mergeWorkouts(db, rawList) {
  // Нормализация до открытия транзакции: битая запись должна упасть, ничего не записав.
  const incoming = (rawList || []).map(normalizeWorkout);
  const existing = await db.getAll("workouts");
  const report = emptyReport();
  const tx = db.transaction("workouts", "readwrite");

  for (const workout of incoming) {
    const match = findMatch(workout, existing);
    if (!match) {
      await tx.store.put(workout);
      existing.push(workout);
      report.added += 1;
      continue;
    }
    const { merged, changed, conflicts } = mergeOne(match, workout);
    if (conflicts.length) report.conflicts.push({ id: match.id, fields: conflicts });
    if (changed) {
      await tx.store.put(merged);
      Object.assign(match, merged);
      report.updated += 1;
    } else {
      report.unchanged += 1;
    }
  }

  await tx.done;
  return report;
}

const mealKey = (m) => `${(m.name || "").trim().toLowerCase()}|${toNumber(m.kcal) ?? ""}|${m.time || ""}`;

/**
 * Каждому приёму пищи нужен устойчивый идентификатор: React берёт его как `key`,
 * а интерфейс удаляет запись по нему. В исходном дневнике id у приёмов пищи нет,
 * и подстановка названия вместо него давала одинаковые ключи — названий всего пять,
 * поэтому любой день с шестью записями ломал список, а при перелистывании дней
 * карточки размножались и подмешивались из других дат. Выдаём id при записи.
 */
const withMealIds = (meals) => (meals || []).map((m) => (m.id ? m : { ...m, id: crypto.randomUUID() }));

export async function mergeDays(db, list) {
  const report = emptyReport();
  const tx = db.transaction("days", "readwrite");
  for (const incoming of list || []) {
    if (!incoming?.date) throw new Error("У записи дня нет даты");
    const existing = await tx.store.get(incoming.date);
    if (!existing) {
      await tx.store.put({
        date: incoming.date,
        meals: withMealIds(incoming.meals),
        symptoms: incoming.symptoms || [],
        water: toNumber(incoming.water) ?? 0,
        note: incoming.note || "",
      });
      report.added += 1;
      continue;
    }
    const seen = new Set((existing.meals || []).map(mealKey));
    const extra = withMealIds((incoming.meals || []).filter((m) => !seen.has(mealKey(m))));
    const symptoms = [...new Set([...(existing.symptoms || []), ...(incoming.symptoms || [])])];
    const water = Math.max(toNumber(existing.water) ?? 0, toNumber(incoming.water) ?? 0);
    const note = existing.note || incoming.note || "";
    const changed =
      extra.length > 0 ||
      symptoms.length !== (existing.symptoms || []).length ||
      water !== (toNumber(existing.water) ?? 0) ||
      note !== (existing.note || "");

    if (changed) {
      await tx.store.put({ ...existing, meals: [...(existing.meals || []), ...extra], symptoms, water, note });
      report.updated += 1;
    } else {
      report.unchanged += 1;
    }
  }
  await tx.done;
  return report;
}

export async function mergeWeights(db, list) {
  const report = emptyReport();
  const tx = db.transaction("weights", "readwrite");
  for (const incoming of list || []) {
    const kg = toNumber(incoming?.kg);
    if (!incoming?.date || kg === null) throw new Error("У замера веса нет даты или значения");
    const existing = await tx.store.get(incoming.date);
    const record = { date: incoming.date, kg, source: incoming.source || "manual" };
    if (!existing) {
      await tx.store.put(record);
      report.added += 1;
    } else if (existing.kg === kg) {
      report.unchanged += 1;
    } else if (existing.source === "manual") {
      // Ручной замер не перезаписываем, но и не проглатываем расхождение молча:
      // форма конфликта та же, что у тренировок, чтобы UI рисовал их одним кодом.
      report.conflicts.push({ id: incoming.date, fields: [{ field: "kg", mine: existing.kg, incoming: kg }] });
      report.unchanged += 1;
    } else if (prio(record.source) >= prio(existing.source)) {
      await tx.store.put(record);
      report.updated += 1;
    } else {
      report.unchanged += 1;
    }
  }
  await tx.done;
  return report;
}

export async function mergeFoods(db, list) {
  const report = emptyReport();
  const tx = db.transaction("foods", "readwrite");
  for (const incoming of list || []) {
    if (!incoming?.id) throw new Error("У продукта нет идентификатора");
    const existing = await tx.store.get(incoming.id);
    if (!existing) {
      await tx.store.put({ usedCount: 0, ...incoming });
      report.added += 1;
    } else {
      report.unchanged += 1;
    }
  }
  await tx.done;
  return report;
}

export async function mergeAll(db, patch) {
  const report = {
    workouts: await mergeWorkouts(db, patch.workouts || []),
    days: await mergeDays(db, patch.days || []),
    weights: await mergeWeights(db, patch.weights || []),
    foods: await mergeFoods(db, patch.foods || []),
  };
  // Настройки — единственное место, где живут личные цели пользователя, поэтому
  // восстановление из бэкапа обязано их вернуть. Форма отчёта у секций не меняется:
  // UI перебирает известные разделы, и лишний раздел иной формы его бы сломал.
  if (patch.settings) {
    await setMeta(db, "settings", patch.settings);
    report.settingsApplied = Object.keys(patch.settings).length;
  }
  return report;
}
