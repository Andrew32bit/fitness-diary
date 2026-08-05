import { describe, it, expect, beforeEach } from "vitest";
import { deleteDB } from "idb";
import { openFitnessDb, STORES, getMeta, setMeta, getSettings, exportAll } from "@/data/db.js";
import { SCHEMA_VERSION, DEFAULT_SETTINGS } from "@/data/schema.js";

beforeEach(async () => {
  await deleteDB("fitness");
});

describe("openFitnessDb", () => {
  it("создаёт все хранилища и индекс по дате", async () => {
    const db = await openFitnessDb();
    expect(db.version).toBe(SCHEMA_VERSION);
    for (const s of STORES) expect(db.objectStoreNames.contains(s)).toBe(true);
    const tx = db.transaction("workouts");
    expect([...tx.store.indexNames]).toContain("byDate");
    db.close();
  });

  it("открывается повторно без пересоздания и не теряет данные", async () => {
    let db = await openFitnessDb();
    await db.put("weights", { date: "2025-03-10", kg: 90.5, source: "manual" });
    db.close();
    db = await openFitnessDb();
    expect(await db.get("weights", "2025-03-10")).toMatchObject({ kg: 90.5 });
    db.close();
  });
});

describe("лечение приёмов пищи без id", () => {
  it("проставляет id записям, импортированным до появления withMealIds", async () => {
    // Готовим базу так, как её оставил бы импорт до правки: приёмы пищи без id.
    let db = await openFitnessDb();
    await db.put("days", {
      date: "2025-04-01",
      meals: [{ name: "Завтрак", kcal: 300 }, { name: "Обед", kcal: 500 }],
      symptoms: [], water: 0, note: "",
    });
    await db.delete("meta", "mealIdsBackfilled");
    db.close();

    db = await openFitnessDb();
    const day = await db.get("days", "2025-04-01");
    const ids = day.meals.map((meal) => meal.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(2);
    db.close();
  });

  it("не трогает уже проставленные id и не запускается повторно", async () => {
    let db = await openFitnessDb();
    await db.put("days", {
      date: "2025-04-02",
      meals: [{ id: "мой-ключ", name: "Ужин", kcal: 400 }],
      symptoms: [], water: 0, note: "",
    });
    await db.delete("meta", "mealIdsBackfilled");
    db.close();

    db = await openFitnessDb();
    expect((await db.get("days", "2025-04-02")).meals[0].id).toBe("мой-ключ");
    expect((await db.get("meta", "mealIdsBackfilled")).done).toBe(true);
    db.close();
  });
});

describe("meta и настройки", () => {
  it("сливает сохранённые настройки со значениями по умолчанию", async () => {
    const db = await openFitnessDb();
    expect(await getSettings(db)).toEqual(DEFAULT_SETTINGS);
    await setMeta(db, "settings", { kcalLimit: 1600 });
    expect(await getSettings(db)).toEqual({ ...DEFAULT_SETTINGS, kcalLimit: 1600 });
    db.close();
  });

  it("setMeta дописывает поля, а не затирает запись", async () => {
    const db = await openFitnessDb();
    await setMeta(db, "sync", { lastImportAt: "2026-08-05T10:00:00Z" });
    await setMeta(db, "sync", { lastBackupAt: "2026-08-05T11:00:00Z" });
    const sync = await getMeta(db, "sync");
    expect(sync.lastImportAt).toBe("2026-08-05T10:00:00Z");
    expect(sync.lastBackupAt).toBe("2026-08-05T11:00:00Z");
    db.close();
  });
});

describe("exportAll", () => {
  it("выгружает все хранилища с версией схемы", async () => {
    const db = await openFitnessDb();
    await db.put("weights", { date: "2025-03-10", kg: 90.5, source: "manual" });
    const dump = await exportAll(db);
    expect(dump.schemaVersion).toBe(SCHEMA_VERSION);
    expect(dump.weights).toHaveLength(1);
    expect(dump.workouts).toEqual([]);
    expect(typeof dump.exportedAt).toBe("string");
    db.close();
  });
});
