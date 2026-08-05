import { describe, it, expect } from "vitest";
import {
  WORKOUT_TYPES, SOURCE_PRIORITY, DEFAULT_SETTINGS,
  toNumber, localDate, workoutKey, normalizeWorkout,
} from "@/data/schema.js";

describe("toNumber", () => {
  it("разбирает числа, строки и запятую как разделитель", () => {
    expect(toNumber(6.01)).toBe(6.01);
    expect(toNumber("6,01")).toBe(6.01);
    expect(toNumber("627")).toBe(627);
  });
  it("возвращает null на пустом и мусорном значении", () => {
    expect(toNumber("")).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber("нет")).toBeNull();
  });
});

describe("localDate", () => {
  it("берёт дату как есть из строки со смещением", () => {
    expect(localDate("2026-08-05T14:46:00+03:00")).toBe("2026-08-05");
  });
  it("не уводит на сутки назад для ночной тренировки со смещением", () => {
    expect(localDate("2026-08-06T00:30:00+03:00")).toBe("2026-08-06");
  });
  it("переводит UTC-строку в часовой пояс устройства", () => {
    const iso = "2026-08-05T21:30:00Z";
    const expected = new Date(iso).toLocaleDateString("sv-SE");
    expect(localDate(iso)).toBe(expected);
  });
});

describe("workoutKey", () => {
  it("округляет до минуты и приводит к UTC", () => {
    expect(workoutKey("2026-08-05T14:46:37+03:00", "running")).toBe("2026-08-05T11:46Z|running");
  });
  it("даёт один ключ для UTC-строки и строки со смещением", () => {
    expect(workoutKey("2026-08-05T11:46:00Z", "running"))
      .toBe(workoutKey("2026-08-05T14:46:00+03:00", "running"));
  });
});

describe("normalizeWorkout", () => {
  const base = { type: "running", start: "2026-08-05T14:46:00+03:00", durationSec: 2666 };

  it("заполняет id, дату, конец и источник по умолчанию", () => {
    const w = normalizeWorkout(base);
    expect(w.id).toBe("2026-08-05T11:46Z|running");
    expect(w.date).toBe("2026-08-05");
    expect(w.end).toBe("2026-08-05T12:30:26.000Z");
    expect(w.source).toBe("manual");
  });

  it("переносит только заполненные метрики", () => {
    const w = normalizeWorkout({ ...base, distanceKm: 6.01, hrAvg: 152, powerW: "", cadenceSpm: null });
    expect(w.distanceKm).toBe(6.01);
    expect(w.hrAvg).toBe(152);
    expect("powerW" in w).toBe(false);
    expect("cadenceSpm" in w).toBe(false);
  });

  it("неизвестный тип сводит к other, сохраняя исходный", () => {
    const w = normalizeWorkout({ ...base, type: "kitesurfing", appleType: "HKWorkoutActivityTypeKitesurfing" });
    expect(w.type).toBe("other");
    expect(w.appleType).toBe("HKWorkoutActivityTypeKitesurfing");
  });

  it("бросает понятную ошибку без старта и без длительности", () => {
    expect(() => normalizeWorkout({ type: "running", durationSec: 100 })).toThrow(/времени старта/);
    expect(() => normalizeWorkout({ type: "running", start: base.start })).toThrow(/длительности/);
    expect(() => normalizeWorkout({ type: "running", start: "не дата", durationSec: 10 })).toThrow(/время старта/);
  });
});

describe("константы", () => {
  it("содержат все типы из исходного дневника", () => {
    const ru = Object.values(WORKOUT_TYPES).map((t) => t.ru);
    for (const name of ["Бассейн", "Эллипс", "Силовая", "Кор", "Ходьба", "AirDyne", "Jacob's Ladder", "Бег", "Велотренажёр", "Сауна", "Другое"]) {
      expect(ru).toContain(name);
    }
  });
  it("ставят apple-export выше manual", () => {
    expect(SOURCE_PRIORITY["apple-export"]).toBeGreaterThan(SOURCE_PRIORITY.manual);
  });
  it("несут значения по умолчанию из спеки", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      goalKg: 80, startKg: 100, kcalLimit: 2000, zone2MaxHr: 140,
      proteinGoal: 150, fatGoal: 70, carbsGoal: 200,
    });
  });
});
