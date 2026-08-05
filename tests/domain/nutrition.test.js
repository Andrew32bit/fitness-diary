import { describe, it, expect } from "vitest";
import { dayTotals, scaleFood, burned } from "@/domain/nutrition.js";

describe("dayTotals", () => {
  it("суммирует КБЖУ приёмов пищи", () => {
    const day = { meals: [
      { kcal: 230, protein: 4.4, fat: 1.6, carbs: 39 },
      { kcal: 184, protein: 20, fat: 4, carbs: 14 },
    ] };
    expect(dayTotals(day)).toEqual({ kcal: 414, protein: 24.4, fat: 5.6, carbs: 53 });
  });
  it("считает отсутствующие макросы нулями и не падает на пустом дне", () => {
    expect(dayTotals({ meals: [{ kcal: 150 }] })).toEqual({ kcal: 150, protein: 0, fat: 0, carbs: 0 });
    expect(dayTotals(undefined)).toEqual({ kcal: 0, protein: 0, fat: 0, carbs: 0 });
  });
});

describe("scaleFood", () => {
  it("пересчитывает продукт на другую граммовку", () => {
    const food = { portionG: 250, kcal: 184, protein: 20, fat: 4, carbs: 14 };
    expect(scaleFood(food, 125)).toEqual({ kcal: 92, protein: 10, fat: 2, carbs: 7 });
  });
  it("оставляет неизвестные макросы неизвестными", () => {
    const food = { portionG: 100, kcal: 148, protein: 7.9, fat: null, carbs: null };
    expect(scaleFood(food, 50)).toEqual({ kcal: 74, protein: 3.95, fat: null, carbs: null });
  });
  it("без порции считает значения как на 100 г", () => {
    expect(scaleFood({ kcal: 100 }, 200)).toEqual({ kcal: 200, protein: null, fat: null, carbs: null });
  });
});

describe("burned", () => {
  it("суммирует активные калории тренировок дня", () => {
    expect(burned([{ kcalActive: 627 }, { kcalActive: 400 }, {}])).toBe(1027);
  });
});
