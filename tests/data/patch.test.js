import { describe, it, expect } from "vitest";
import { parsePatch } from "@/data/import/patch.js";

describe("parsePatch", () => {
  it("разбирает словарь дней и весов из исходного артефакта", () => {
    const out = parsePatch({
      days: { "2026-08-05": { meals: [{ name: "Йогурт", kcal: 184 }], symptoms: [], workouts: [], water: 0 } },
      weights: { "2025-03-10": 90.5 },
    });
    expect(out.days).toEqual([
      { date: "2026-08-05", meals: [{ name: "Йогурт", kcal: 184 }], symptoms: [], water: 0, note: "" },
    ]);
    expect(out.weights).toEqual([{ date: "2025-03-10", kg: 90.5 }]);
  });

  it("разбирает массивы и собственный экспорт приложения", () => {
    const out = parsePatch({
      schemaVersion: 1,
      workouts: [{ type: "running", start: "2026-08-05T14:46:00+03:00", durationSec: 2666 }],
      days: [{ date: "2026-08-05", meals: [] }],
      weights: [{ date: "2025-03-10", kg: 90.5 }],
      foods: [{ id: "yogurt-250", name: "Йогурт 2%", kcal: 184 }],
    });
    expect(out.workouts).toHaveLength(1);
    expect(out.foods).toHaveLength(1);
  });

  it("принимает строку JSON", () => {
    const out = parsePatch('{"weights":{"2025-03-10":90.5}}');
    expect(out.weights).toEqual([{ date: "2025-03-10", kg: 90.5 }]);
  });

  it("переносит тренировки, вложенные в день, в общий список", () => {
    const out = parsePatch({
      days: {
        "2026-08-05": {
          meals: [], symptoms: [], water: 0,
          workouts: [{ type: "Бег", minutes: 44, kcal: 627, note: "6.01 км за 44:26" }],
        },
      },
    });
    expect(out.days[0].meals).toEqual([]);
    expect(out.workouts).toHaveLength(1);
    expect(out.workouts[0]).toMatchObject({
      type: "running", date: "2026-08-05", durationSec: 2666, kcalActive: 627, source: "chat",
    });
  });

  it("вытаскивает метрики из текста заметки дневника", () => {
    const out = parsePatch({
      days: {
        "2025-06-14": {
          workouts: [{
            type: "Бег",
            minutes: 60,
            kcal: 700,
            note: "8.38 км за 1:00:13, темп 7:11/км, пульс ср 151, каденс 156, мощность 295Вт, набор высоты 72м. Усилие 7/10",
          }],
        },
      },
    });
    expect(out.workouts[0]).toMatchObject({
      type: "running",
      distanceKm: 8.38,
      hrAvg: 151,
      cadenceSpm: 156,
      powerW: 295,
      elevationM: 72,
      effort: 7,
      kcalActive: 700,
    });
  });

  it("не принимает набор высоты за дистанцию и не спотыкается о темп", () => {
    const out = parsePatch({
      days: { "2025-06-15": { workouts: [{ type: "Бег", minutes: 40, note: "темп 7:24/км, набор высоты 120м" }] } },
    });
    expect("distanceKm" in out.workouts[0] === false || out.workouts[0].distanceKm === null).toBe(true);
    expect(out.workouts[0].elevationM).toBe(120);
  });

  it("оставляет метрики пустыми, если в заметке их нет", () => {
    const out = parsePatch({
      days: { "2025-06-16": { workouts: [{ type: "Силовая", minutes: 50, note: "жим лёжа, тяга" }] } },
    });
    const w = out.workouts[0];
    expect(w.distanceKm ?? null).toBeNull();
    expect(w.hrAvg ?? null).toBeNull();
  });

  it("берёт точную длительность из заметки вместо округлённых минут", () => {
    const out = parsePatch({
      days: { "2025-07-01": { workouts: [{ type: "Бег", minutes: 44, note: "6.01 км за 44:26, темп 7:23/км" }] } },
    });
    // 44:26 = 2666 с, а не 44 минуты = 2640: иначе темп занижается на секунды.
    expect(out.workouts[0].durationSec).toBe(2666);
  });

  it("понимает длительность с часами", () => {
    const out = parsePatch({
      days: { "2025-07-02": { workouts: [{ type: "Бег", minutes: 60, note: "8.38 км за 1:00:13" }] } },
    });
    expect(out.workouts[0].durationSec).toBe(3613);
  });

  it("не принимает темп за длительность", () => {
    const out = parsePatch({
      days: { "2025-07-03": { workouts: [{ type: "Бег", minutes: 40, note: "6 км, темп 7:24/км" }] } },
    });
    expect(out.workouts[0].durationSec).toBe(2400);
  });

  it("берёт настоящее время начала из заметки, если оно там есть", () => {
    const out = parsePatch({
      days: { "2025-07-04": { workouts: [{ type: "Бег", minutes: 44, note: "Улица, 14:46-15:30" }] } },
    });
    expect(out.workouts[0].start).toBe("2025-07-04T14:46:00");
  });

  it("без времени в заметке подставляет условное и не ломает идемпотентность", () => {
    const patch = { days: { "2025-07-05": { workouts: [{ type: "Бег", minutes: 30, note: "5 км" }] } } };
    const first = parsePatch(patch).workouts[0];
    expect(first.start).toBe("2025-07-05T12:00:00");
    expect(parsePatch(patch).workouts[0].id).toBe(first.id);
  });

  it("не принимает скорость за дистанцию", () => {
    const out = parsePatch({
      days: { "2025-06-17": { workouts: [{ type: "Эллипс", minutes: 30, note: "скорость 12 км/ч, пульс ср 140" }] } },
    });
    expect("distanceKm" in out.workouts[0] === false || out.workouts[0].distanceKm === null).toBe(true);
    expect(out.workouts[0].hrAvg).toBe(140);
  });

  it("вытаскивает настоящую дистанцию рядом со скоростью", () => {
    const out = parsePatch({
      days: { "2025-06-18": { workouts: [{ type: "Бег", minutes: 60, note: "10.1 км со скоростью 9 км/ч, темп ~6:40/км" }] } },
    });
    expect(out.workouts[0].distanceKm).toBe(10.1);
  });

  it("запись с нулевой длительностью считает заметкой дня, а не тренировкой", () => {
    // Медицинская процедура из дневника записана в workouts с minutes: 0.
    const out = parsePatch({
      days: {
        "2026-04-05": {
          meals: [], symptoms: [], water: 6,
          workouts: [{ type: "Другое", minutes: 0, kcal: 0, note: "Процедура в клинике" }],
        },
      },
    });
    expect(out.workouts).toEqual([]);
    expect(out.days[0].note).toBe("Процедура в клинике");
  });

  it("дописывает заметку с нулевой длительностью к уже существующей заметке дня", () => {
    const out = parsePatch({
      days: {
        "2026-04-05": {
          note: "День без нагрузки",
          workouts: [{ type: "Другое", minutes: 0, note: "Процедура в клинике" }],
        },
      },
    });
    expect(out.days[0].note).toBe("День без нагрузки. Процедура в клинике");
  });

  it("разносит две пробежки одного дня по разным стартам с шагом 10 минут", () => {
    const out = parsePatch({
      days: {
        "2026-05-14": {
          workouts: [
            { type: "Бег", minutes: 44, note: "8.5 км" },
            { type: "Бег", minutes: 20, note: "1.61 км" },
          ],
        },
      },
    });
    expect(out.workouts).toHaveLength(2);
    expect(out.workouts[0].distanceKm).toBe(8.5);
    expect(out.workouts[1].distanceKm).toBe(1.61);
    // Ключи уникальны: одна тренировка в 12:00, вторая в 12:10
    const keys = out.workouts.map(w => w.id);
    expect(new Set(keys).size).toBe(2);
    // Повторный разбор даёт те же ключи
    const out2 = parsePatch({
      days: {
        "2026-05-14": {
          workouts: [
            { type: "Бег", minutes: 44, note: "8.5 км" },
            { type: "Бег", minutes: 20, note: "1.61 км" },
          ],
        },
      },
    });
    expect(out2.workouts.map(w => w.id)).toEqual(keys);
  });

  it("распознаёт русский тип с лишними пробелами и в другом регистре", () => {
    const out = parsePatch({
      days: { "2026-08-05": { workouts: [{ type: " бег ", minutes: 44, kcal: 627 }] } },
    });
    expect(out.workouts[0].type).toBe("running");
  });

  it("даёт понятную ошибку на мусоре", () => {
    expect(() => parsePatch("не json")).toThrow(/не удалось разобрать/i);
    expect(() => parsePatch(42)).toThrow(/объект/i);
    expect(() => parsePatch({})).toThrow(/пустой/i);
  });
});
