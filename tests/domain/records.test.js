import { describe, it, expect } from "vitest";
import { records } from "@/domain/records.js";

const run = (date, km, sec, kcal) => ({ date, type: "running", durationSec: sec, distanceKm: km, kcalActive: kcal });

describe("records", () => {
  const workouts = [
    run("2026-06-25", 18.01, 7590, 2100),
    run("2026-07-07", 18.07, 7728, 2261),
    run("2026-06-14", 8.0, 3072, 900),   // темп 6'24"
    run("2026-08-05", 6.01, 2666, 627),  // темп 7'23"
  ];

  it("находит максимальную дистанцию и расход", () => {
    const r = records(workouts);
    expect(r.maxDistanceKm).toBe(18.07);
    expect(r.maxKcal).toBe(2261);
  });

  it("находит лучший темп на дистанциях не меньше порога", () => {
    const r = records(workouts);
    expect(r.bestPace[5]).toBeCloseTo(384, 0);
    expect(r.bestPace[8]).toBeCloseTo(384, 0);
    expect(r.bestPace[10]).toBeCloseTo(421.4, 1);
  });

  it("даёт null там, где подходящих пробежек нет", () => {
    const r = records([run("2026-08-05", 3.0, 1200, 300)]);
    expect(r.bestPace[5]).toBeNull();
    expect(r.maxDistanceKm).toBe(3.0);
  });

  it("считает порог включительно: пробежка ровно на 5.00 км является рекордом порога 5 км", () => {
    const r = records([run("2026-05-01", 5.0, 1500, 500)]);
    expect(r.bestPace[5]).toBe(300);
    expect(r.bestPace[8]).toBeNull();
  });

  it("не учитывает не беговые тренировки", () => {
    const r = records([{ date: "2026-08-03", type: "strength", durationSec: 3000, kcalActive: 400 }]);
    expect(r.maxDistanceKm).toBeNull();
    expect(r.maxKcal).toBe(400);
  });
});
