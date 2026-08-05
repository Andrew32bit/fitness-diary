import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deleteDB } from "idb";
import { zipSync, strToU8 } from "fflate";
import { openFitnessDb, getMeta, setMeta, getSettings, exportAll } from "@/data/db.js";
import { detectFormat, parseFile, importFile, importText } from "@/data/import/index.js";

const bytesOf = (name) => new Uint8Array(readFileSync(resolve(import.meta.dirname, "../fixtures", name)));
const enc = new TextEncoder();

let db;
beforeEach(async () => {
  await deleteDB("fitness");
  db = await openFitnessDb();
});

// Как и в тестах слияния: без закрытия хендла `deleteDB` в следующем тесте зависает.
afterEach(() => {
  db.close();
});

describe("detectFormat", () => {
  it("узнаёт форматы по имени и началу содержимого", () => {
    expect(detectFormat("export.xml", "<?xml version=\"1.0\"?><HealthData>")).toBe("apple-xml");
    expect(detectFormat("run.tcx", "<?xml version=\"1.0\"?><TrainingCenterDatabase>")).toBe("tcx");
    expect(detectFormat("diary-seed.json", "{\"days\":{}}")).toBe("json");
    expect(detectFormat("export.zip", "PK")).toBe("zip");
  });
  it("узнаёт TCX по содержимому даже с чужим расширением", () => {
    expect(detectFormat("workout.dat", "<TrainingCenterDatabase>")).toBe("tcx");
  });
  it("бросает понятную ошибку на неизвестном формате", () => {
    expect(() => detectFormat("photo.png", "PNG")).toThrow(/не понял формат/i);
  });
});

describe("parseFile", () => {
  it("разбирает Apple-экспорт", async () => {
    const patch = await parseFile({ name: "export.xml", bytes: bytesOf("apple-export-small.xml") });
    expect(patch.workouts).toHaveLength(4);
  });
  it("разбирает TCX", async () => {
    const patch = await parseFile({ name: "run.tcx", bytes: bytesOf("healthfit-run.tcx") });
    expect(patch.workouts).toHaveLength(1);
  });
  it("извлекает export.xml из zip", async () => {
    const xml = readFileSync(resolve(import.meta.dirname, "../fixtures/apple-export-small.xml"), "utf8");
    const zipped = zipSync({ "apple_health_export/export.xml": strToU8(xml) });
    const patch = await parseFile({ name: "export.zip", bytes: zipped });
    expect(patch.workouts).toHaveLength(4);
  });
  it("сообщает, если в zip нет export.xml", async () => {
    const zipped = zipSync({ "readme.txt": strToU8("привет") });
    await expect(parseFile({ name: "export.zip", bytes: zipped })).rejects.toThrow(/export\.xml/);
  });
});

describe("importFile и importText", () => {
  it("импортирует файл, считает отчёт и запоминает время импорта", async () => {
    const report = await importFile(db, { name: "export.xml", bytes: bytesOf("apple-export-small.xml") });
    expect(report.workouts.added).toBe(4);
    expect(await db.count("workouts")).toBe(4);
    expect((await getMeta(db, "sync")).lastImportAt).toMatch(/^\d{4}-/);
  });

  it("повторный импорт того же файла ничего не добавляет", async () => {
    await importFile(db, { name: "export.xml", bytes: bytesOf("apple-export-small.xml") });
    const again = await importFile(db, { name: "export.xml", bytes: bytesOf("apple-export-small.xml") });
    expect(again.workouts).toMatchObject({ added: 0, unchanged: 4 });
    expect(await db.count("workouts")).toBe(4);
  });

  it("Apple-экспорт после TCX дополняет ту же тренировку, а не создаёт вторую", async () => {
    await importFile(db, { name: "run.tcx", bytes: bytesOf("healthfit-run.tcx") });
    const report = await importFile(db, { name: "export.xml", bytes: bytesOf("apple-export-small.xml") });
    expect(report.workouts.added).toBe(3);
    expect(report.workouts.updated).toBe(1);
    expect(await db.count("workouts")).toBe(4);
    const saved = await db.get("workouts", "2026-08-05T11:46Z|running");
    expect(saved.effort).toBe(6);
    expect(saved.elevationM).toBe(14);
  });

  it("восстанавливает личные настройки из собственного экспорта", async () => {
    // Главная проверка бэкапа: цели пользователя живут только в настройках,
    // и восстановление обязано их вернуть, а не сбросить на значения по умолчанию.
    await setMeta(db, "settings", { goalKg: 77, kcalLimit: 1700, proteinGoal: 165 });
    const dump = await exportAll(db);
    db.close();
    await deleteDB("fitness");

    const fresh = await openFitnessDb();
    const report = await importText(fresh, JSON.stringify(dump));
    expect(report.settingsApplied).toBeGreaterThan(0);
    expect(await getSettings(fresh)).toMatchObject({ goalKg: 77, kcalLimit: 1700, proteinGoal: 165 });
    fresh.close();
  });

  it("importText принимает вставку из буфера и отмечает время импорта так же, как importFile", async () => {
    const report = await importText(db, JSON.stringify({ weights: { "2025-03-10": 90.5 } }));
    expect(report.weights.added).toBe(1);
    expect((await getMeta(db, "sync")).lastImportAt).toMatch(/^\d{4}-/);
  });
});
