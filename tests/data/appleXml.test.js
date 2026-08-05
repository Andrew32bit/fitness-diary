import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appleDateToIso, parseAppleWorkouts, createAppleWorkoutParser } from "@/data/import/appleXml.js";

const xml = readFileSync(resolve(import.meta.dirname, "../fixtures/apple-export-small.xml"), "utf8");

describe("appleDateToIso", () => {
  it("переводит формат Apple в ISO со смещением", () => {
    expect(appleDateToIso("2026-08-05 14:46:00 +0300")).toBe("2026-08-05T14:46:00+03:00");
    expect(appleDateToIso("2026-01-02 09:05:00 -0500")).toBe("2026-01-02T09:05:00-05:00");
  });
  it("бросает ошибку на непонятной дате", () => {
    expect(() => appleDateToIso("05.08.2026")).toThrow(/дату Apple/);
  });
});

describe("parseAppleWorkouts", () => {
  const workouts = parseAppleWorkouts(xml);

  it("берёт только тренировки, игнорируя Record", () => {
    expect(workouts).toHaveLength(4);
  });

  it("собирает современный бег со всеми метриками", () => {
    const run = workouts.find((w) => w.date === "2026-08-05");
    expect(run).toMatchObject({
      type: "running",
      date: "2026-08-05",
      start: "2026-08-05T14:46:00+03:00",
      distanceKm: 6.01,
      kcalActive: 627,
      kcalTotal: 745,
      hrAvg: 152,
      hrMax: 171,
      powerW: 290,
      elevationM: 14,
      effort: 6,
      source: "apple-export",
      appleType: "HKWorkoutActivityTypeRunning",
    });
    expect(run.durationSec).toBe(2666);
    expect(run.cadenceSpm).toBe(159);
  });

  it("переводит метры плавания в километры", () => {
    const swim = workouts.find((w) => w.type === "swimming");
    expect(swim.distanceKm).toBe(1.2);
    expect(swim.kcalActive).toBe(410);
    expect("hrAvg" in swim).toBe(false);
  });

  it("не падает на силовой без метрик", () => {
    const strength = workouts.find((w) => w.type === "strength");
    expect(strength.durationSec).toBe(3000);
    expect("distanceKm" in strength).toBe(false);
    expect("cadenceSpm" in strength).toBe(false);
  });

  it("понимает старый формат с атрибутами totalDistance", () => {
    const old = workouts.find((w) => w.date === "2026-07-24");
    expect(old.distanceKm).toBe(8.38);
    expect(old.kcalActive).toBe(903);
  });

  it("даёт ключи, устойчивые к повторному разбору", () => {
    const again = parseAppleWorkouts(xml);
    expect(again.map((w) => w.id)).toEqual(workouts.map((w) => w.id));
  });
});

describe("предупреждения о незнакомых данных", () => {
  const wrap = (inner, type = "HKWorkoutActivityTypeRunning") => `<?xml version="1.0"?>
<HealthData>
 <Workout workoutActivityType="${type}" duration="30" durationUnit="min"
          startDate="2026-08-05 10:00:00 +0300" endDate="2026-08-05 10:30:00 +0300">
  ${inner}
 </Workout>
</HealthData>`;

  it("сообщает о нераспознанной единице дистанции, но не теряет запись", () => {
    const warnings = [];
    const workouts = parseAppleWorkouts(
      wrap('<WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" sum="5" unit="yd"/>'),
      (w) => warnings.push(w),
    );
    expect(warnings).toEqual([{ kind: "unknown-distance-unit", unit: "yd" }]);
    expect(workouts).toHaveLength(1);
    expect(workouts[0].distanceKm).toBe(5);
  });

  it("сообщает о нераспознанной единице высоты", () => {
    const warnings = [];
    parseAppleWorkouts(wrap('<MetadataEntry key="HKElevationAscended" value="45 ft"/>'), (w) => warnings.push(w));
    expect(warnings).toEqual([{ kind: "unknown-elevation-unit", unit: "ft" }]);
  });

  it("сообщает о незнакомом типе тренировки и сводит его к other", () => {
    const warnings = [];
    const workouts = parseAppleWorkouts(wrap("", "HKWorkoutActivityTypeKitesurfing"), (w) => warnings.push(w));
    expect(warnings).toEqual([{ kind: "unknown-activity-type", type: "HKWorkoutActivityTypeKitesurfing" }]);
    expect(workouts[0].type).toBe("other");
  });

  it("на фикстуре не выдаёт ни одного предупреждения: карта покрывает все её данные", () => {
    const warnings = [];
    parseAppleWorkouts(xml, (w) => warnings.push(w));
    expect(warnings).toEqual([]);
  });
});

describe("createAppleWorkoutParser", () => {
  it("собирает тот же результат при подаче по кускам", () => {
    const collected = [];
    const parser = createAppleWorkoutParser({ onWorkout: (w) => collected.push(w) });
    for (let i = 0; i < xml.length; i += 64) parser.write(xml.slice(i, i + 64));
    parser.close();
    expect(collected).toHaveLength(4);
    expect(collected.map((w) => w.id)).toEqual(parseAppleWorkouts(xml).map((w) => w.id));
  });
});
