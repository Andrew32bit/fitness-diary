import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { deleteDB } from "idb";
import { openFitnessDb } from "@/data/db.js";
import { findMatch, mergeOne, mergeWorkouts, mergeAll, MATCH_WINDOW_SEC } from "@/data/import/merge.js";
import { normalizeWorkout } from "@/data/schema.js";

const run = (over = {}) => normalizeWorkout({
  type: "running", start: "2026-08-05T14:46:00+03:00", durationSec: 2666, ...over,
});

let db;
beforeEach(async () => {
  await deleteDB("fitness");
  db = await openFitnessDb();
});

// Соединение обязано закрываться после каждого теста: IndexedDB ждёт закрытия
// всех хендлов, и `deleteDB` в следующем beforeEach иначе зависает навечно.
afterEach(() => {
  db.close();
});

describe("findMatch", () => {
  it("находит по точному ключу", () => {
    const a = run();
    expect(findMatch(run(), [a])).toBe(a);
  });
  it("находит тот же забег со сдвигом старта в пределах окна", () => {
    const a = run();
    const b = run({ start: "2026-08-05T14:47:30+03:00" });
    expect(findMatch(b, [a])).toBe(a);
  });
  it("не склеивает записи за пределами окна", () => {
    const a = run();
    const b = run({ start: "2026-08-05T14:50:00+03:00" });
    expect(MATCH_WINDOW_SEC).toBe(120);
    expect(findMatch(b, [a])).toBeNull();
  });
  it("не склеивает разные типы в одно время", () => {
    const a = run();
    const b = run({ type: "strength" });
    expect(findMatch(b, [a])).toBeNull();
  });
});

describe("mergeOne", () => {
  it("заполняет пустые поля независимо от приоритета", () => {
    const existing = run({ source: "apple-export" });
    const incoming = run({ source: "manual", effort: 6 });
    const { merged, changed, conflicts } = mergeOne(existing, incoming);
    expect(merged.effort).toBe(6);
    expect(changed).toBe(true);
    expect(conflicts).toEqual([]);
  });

  it("более приоритетный источник обновляет заполненное поле", () => {
    const existing = run({ source: "shortcut", hrAvg: 150 });
    const incoming = run({ source: "apple-export", hrAvg: 152 });
    const { merged, changed } = mergeOne(existing, incoming);
    expect(merged.hrAvg).toBe(152);
    expect(merged.source).toBe("apple-export");
    expect(changed).toBe(true);
  });

  it("менее приоритетный источник не трогает заполненное поле", () => {
    const existing = run({ source: "apple-export", hrAvg: 152 });
    const incoming = run({ source: "chat", hrAvg: 149 });
    const { merged, changed } = mergeOne(existing, incoming);
    expect(merged.hrAvg).toBe(152);
    expect(changed).toBe(false);
  });

  it("ручную запись не перезаписывает даже приоритетный источник, а сообщает о конфликте", () => {
    const existing = run({ source: "manual", distanceKm: 6.0 });
    const incoming = run({ source: "apple-export", distanceKm: 6.01 });
    const { merged, changed, conflicts } = mergeOne(existing, incoming);
    expect(merged.distanceKm).toBe(6.0);
    expect(changed).toBe(false);
    expect(conflicts).toEqual([{ field: "distanceKm", mine: 6.0, incoming: 6.01 }]);
  });

  it("при равном приоритете расхождение возвращается конфликтом, а не проглатывается", () => {
    // Ровно случай «исправил число в дневнике и переимпортировал файл».
    const existing = run({ source: "chat", distanceKm: 8.5 });
    const incoming = run({ source: "chat", distanceKm: 8.38 });
    const { merged, changed, conflicts } = mergeOne(existing, incoming);
    expect(merged.distanceKm).toBe(8.5);
    expect(changed).toBe(false);
    expect(conflicts).toEqual([{ field: "distanceKm", mine: 8.5, incoming: 8.38 }]);
  });

  it("более слабый источник по-прежнему игнорируется без конфликта", () => {
    const existing = run({ source: "apple-export", distanceKm: 8.38 });
    const incoming = run({ source: "chat", distanceKm: 8.5 });
    const { merged, changed, conflicts } = mergeOne(existing, incoming);
    expect(merged.distanceKm).toBe(8.38);
    expect(changed).toBe(false);
    expect(conflicts).toEqual([]);
  });

  it("не снимает метку manual, дозаполнив пустое поле: защита держится и на следующем слиянии", () => {
    const manual = run({ source: "manual", distanceKm: 6.0 });
    // Пустой пульс заполняется безусловно, даже из слабого источника.
    const filled = mergeOne(manual, run({ source: "chat", hrAvg: 152 }));
    expect(filled.merged.hrAvg).toBe(152);
    expect(filled.merged.source).toBe("manual");
    // И следующий, более приоритетный источник по-прежнему не может затереть руками введённое.
    const later = mergeOne(filled.merged, run({ source: "shortcut", distanceKm: 6.01 }));
    expect(later.merged.distanceKm).toBe(6.0);
    expect(later.changed).toBe(false);
    expect(later.conflicts).toEqual([{ field: "distanceKm", mine: 6.0, incoming: 6.01 }]);
  });

  it("за один проход дозаполняет пустое поле и сообщает конфликт по расходящемуся", () => {
    const existing = run({ source: "manual", distanceKm: 6.0 });
    const { merged, changed, conflicts } = mergeOne(existing, run({ source: "apple-export", distanceKm: 6.01, effort: 6 }));
    expect(merged.effort).toBe(6);
    expect(merged.distanceKm).toBe(6.0);
    expect(merged.source).toBe("manual");
    expect(changed).toBe(true);
    expect(conflicts).toEqual([{ field: "distanceKm", mine: 6.0, incoming: 6.01 }]);
  });
});

describe("mergeWorkouts", () => {
  it("первый импорт добавляет, второй ничего не меняет", async () => {
    const first = await mergeWorkouts(db, [run({ source: "apple-export", distanceKm: 6.01 })]);
    expect(first).toMatchObject({ added: 1, updated: 0, unchanged: 0 });

    const second = await mergeWorkouts(db, [run({ source: "apple-export", distanceKm: 6.01 })]);
    expect(second).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
    expect(await db.count("workouts")).toBe(1);
  });

  it("дополняет запись метриками из второго источника", async () => {
    await mergeWorkouts(db, [run({ source: "tcx", distanceKm: 6.01, hrAvg: 152 })]);
    const report = await mergeWorkouts(db, [run({ source: "apple-export", distanceKm: 6.01, hrAvg: 152, effort: 6 })]);
    expect(report).toMatchObject({ added: 0, updated: 1 });
    const [saved] = await db.getAll("workouts");
    expect(saved.effort).toBe(6);
    expect(await db.count("workouts")).toBe(1);
  });

  it("возвращает конфликты с идентификатором записи", async () => {
    await mergeWorkouts(db, [run({ source: "manual", distanceKm: 6.0 })]);
    const report = await mergeWorkouts(db, [run({ source: "apple-export", distanceKm: 6.01 })]);
    expect(report.conflicts).toEqual([
      { id: "2026-08-05T11:46Z|running", fields: [{ field: "distanceKm", mine: 6.0, incoming: 6.01 }] },
    ]);
  });

  it("на битой записи не пишет ничего", async () => {
    await expect(mergeWorkouts(db, [run(), { type: "running" }])).rejects.toThrow(/времени старта/);
    expect(await db.count("workouts")).toBe(0);
  });
});

describe("mergeAll", () => {
  it("сливает дни, вес, продукты и тренировки и повторно ничего не дублирует", async () => {
    const patch = {
      workouts: [run({ source: "apple-export" })],
      days: [{ date: "2026-08-05", meals: [{ name: "Йогурт 2%", kcal: 184, protein: 20, fat: 4, carbs: 14 }], symptoms: ["Всё ок"], water: 0 }],
      weights: [{ date: "2025-03-10", kg: 90.5 }],
      foods: [{ id: "yogurt-250", name: "Йогурт греческий 2%, 250 г", kcal: 184, protein: 20, fat: 4, carbs: 14 }],
    };
    const first = await mergeAll(db, patch);
    expect(first.workouts.added).toBe(1);
    expect(first.days.added).toBe(1);
    expect(first.weights.added).toBe(1);
    expect(first.foods.added).toBe(1);

    const second = await mergeAll(db, patch);
    expect(second.workouts).toMatchObject({ added: 0, unchanged: 1 });
    expect(second.days).toMatchObject({ added: 0, unchanged: 1 });
    expect(await db.count("days")).toBe(1);
    const [day] = await db.getAll("days");
    expect(day.meals).toHaveLength(1);
  });

  it("не перезаписывает ручной вес, но возвращает расхождение как конфликт", async () => {
    await mergeAll(db, { weights: [{ date: "2025-03-10", kg: 90.5, source: "manual" }] });
    const report = await mergeAll(db, { weights: [{ date: "2025-03-10", kg: 90.7, source: "shortcut" }] });
    expect(report.weights).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
    expect(report.weights.conflicts).toEqual([
      { id: "2025-03-10", fields: [{ field: "kg", mine: 90.5, incoming: 90.7 }] },
    ]);
    const [saved] = await db.getAll("weights");
    expect(saved.kg).toBe(90.5);
  });

  it("добавляет новый приём пищи в существующий день, не теряя старый", async () => {
    await mergeAll(db, { days: [{ date: "2026-08-05", meals: [{ name: "Йогурт 2%", kcal: 184 }] }] });
    await mergeAll(db, { days: [{ date: "2026-08-05", meals: [{ name: "Батончик протеиновый", kcal: 190 }] }] });
    const [day] = await db.getAll("days");
    expect(day.meals.map((m) => m.name)).toEqual(["Йогурт 2%", "Батончик протеиновый"]);
  });
});
