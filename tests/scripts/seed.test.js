import { describe, it, expect } from "vitest";
import { extractSeed } from "../../scripts/seed-from-tsx.mjs";
import { parsePatch } from "@/data/import/patch.js";

const SOURCE = `
import { useState } from "react";
var SEED_ENTRIES = {
  "2026-07-24": { meals: [], symptoms: [], workouts: [
    { type: "Бег", minutes: 60, kcal: 903, note: "8.38 км за 1:00:13" },
  ], water: 0 },
  "2026-08-05": { meals: [{ name: "Йогурт", kcal: 184, protein: 20, fat: 4, carbs: 14 }], symptoms: ["Всё ок"], workouts: [], water: 500 }
};
var SEED_WEIGHTS = { "2025-01-15": 99.0, "2025-03-10": 90.5 };
var C = { bg: "#ffffff" };
`;

describe("extractSeed", () => {
  it("вытаскивает дни и веса из исходника артефакта", () => {
    const seed = extractSeed(SOURCE);
    expect(Object.keys(seed.days)).toEqual(["2026-07-24", "2026-08-05"]);
    expect(seed.weights["2025-03-10"]).toBe(90.5);
    expect(seed.days["2026-08-05"].water).toBe(500);
  });

  it("результат проходит через parsePatch без потерь", () => {
    const patch = parsePatch(extractSeed(SOURCE));
    expect(patch.days).toHaveLength(2);
    expect(patch.weights).toHaveLength(2);
    expect(patch.workouts).toHaveLength(1);
    expect(patch.workouts[0]).toMatchObject({ type: "running", date: "2026-07-24", kcalActive: 903 });
  });

  it("падает, если структуры не найдены", () => {
    expect(() => extractSeed("var X = 1;")).toThrow(/SEED_ENTRIES/);
  });

  it("извлекает данные, даже если в тексте заметки есть сбалансированные скобки", () => {
    const withBraces = `
var SEED_ENTRIES = {
  "2026-05-01": { meals: [], symptoms: [], workouts: [
    { type: "Бег", minutes: 30, kcal: 300, note: "план на неделю {объём 40 км}" },
  ], water: 0 }
};
var SEED_WEIGHTS = { "2026-05-01": 112.4 };
`;
    const seed = extractSeed(withBraces);
    expect(seed.days["2026-05-01"].workouts[0].note).toBe("план на неделю {объём 40 км}");
    expect(seed.weights["2026-05-01"]).toBe(112.4);
  });

  it("на несбалансированной скобке в заметке падает с понятным русским сообщением", () => {
    const broken = `
var SEED_ENTRIES = {
  "2026-05-01": { meals: [], symptoms: [], workouts: [
    { type: "Бег", minutes: 30, note: "закрывающая } внутри текста" },
  ], water: 0 }
};
var SEED_WEIGHTS = { "2026-05-01": 112.4 };
`;
    expect(() => extractSeed(broken)).toThrow(/несбалансированная фигурная скобка/);
  });
});
