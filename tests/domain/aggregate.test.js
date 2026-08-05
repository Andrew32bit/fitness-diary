import { describe, it, expect } from "vitest";
import {
  paceSecPerKm, fmtPace, fmtDuration, isoWeek, monthlyVolume,
  weeklyVolume, movingAverage, zone2ShareByMonth, efficiency, efficiencyByMonth,
} from "@/domain/aggregate.js";

const run = (date, km, sec, hr) => ({
  id: `${date}|running`, date, type: "running", start: `${date}T12:00:00+03:00`,
  durationSec: sec, distanceKm: km, hrAvg: hr,
});

describe("темп и длительность", () => {
  it("считает темп в секундах на километр", () => {
    expect(paceSecPerKm(run("2026-08-05", 6.01, 2666, 152))).toBeCloseTo(443.6, 1);
  });
  it("не считает темп без дистанции", () => {
    expect(paceSecPerKm({ durationSec: 3000 })).toBeNull();
    expect(paceSecPerKm({ durationSec: 3000, distanceKm: 0 })).toBeNull();
  });
  it("форматирует темп и прочерк", () => {
    expect(fmtPace(443)).toBe("7'23\"");
    expect(fmtPace(null)).toBe("—");
  });
  it("форматирует длительность с часами и без", () => {
    expect(fmtDuration(2666)).toBe("44:26");
    expect(fmtDuration(3758)).toBe("1:02:38");
  });
});

describe("isoWeek", () => {
  it("нумерует недели по ISO с понедельника", () => {
    expect(isoWeek("2026-08-05")).toBe("2026-W32");
    expect(isoWeek("2026-08-03")).toBe("2026-W32");
    expect(isoWeek("2026-08-02")).toBe("2026-W31");
  });
  it("относит 1 января 2027 к последней неделе 2026 года", () => {
    expect(isoWeek("2027-01-01")).toBe("2026-W53");
  });
});

describe("monthlyVolume", () => {
  const workouts = [
    run("2026-07-24", 8.38, 3613, 151),
    run("2026-07-30", 6.05, 2601, 149),
    run("2026-08-01", 8.52, 3758, 157),
    run("2026-08-05", 6.01, 2666, 152),
    { id: "s", date: "2026-08-03", type: "strength", start: "2026-08-03T20:00:00+03:00", durationSec: 3000 },
  ];

  it("суммирует километры по месяцам только для нужного типа", () => {
    expect(monthlyVolume(workouts, "running")).toEqual([
      { month: "2026-07", km: 14.43, count: 2 },
      { month: "2026-08", km: 14.53, count: 2 },
    ]);
  });
  it("возвращает пустой список, если тренировок нет", () => {
    expect(monthlyVolume([], "running")).toEqual([]);
  });
});

describe("weeklyVolume и movingAverage", () => {
  it("группирует по ISO-неделям", () => {
    const weeks = weeklyVolume([run("2026-08-01", 8.52, 3758, 157), run("2026-08-05", 6.01, 2666, 152)], "running");
    expect(weeks).toEqual([
      { week: "2026-W31", km: 8.52, count: 1 },
      { week: "2026-W32", km: 6.01, count: 1 },
    ]);
  });
  it("даёт null, пока окно не заполнено", () => {
    expect(movingAverage([10, 20, 30, 40], 3)).toEqual([null, null, 20, 30]);
  });
});

describe("zone2ShareByMonth", () => {
  it("считает долю пробежек ниже порога пульса", () => {
    const workouts = [run("2026-08-01", 8, 3600, 132), run("2026-08-05", 6, 2666, 152)];
    expect(zone2ShareByMonth(workouts, 140)).toEqual([{ month: "2026-08", share: 0.5, total: 2 }]);
  });
  it("игнорирует записи без пульса", () => {
    const workouts = [run("2026-08-01", 8, 3600, 132), { ...run("2026-08-05", 6, 2666, null), hrAvg: undefined }];
    expect(zone2ShareByMonth(workouts, 140)).toEqual([{ month: "2026-08", share: 1, total: 1 }]);
  });
});

describe("efficiency", () => {
  it("считает метры на удар пульса", () => {
    // 6010 м за 44.43 мин = 135.3 м/мин, при пульсе 152 → 0.89 м/удар
    expect(efficiency(run("2026-08-05", 6.01, 2666, 152))).toBeCloseTo(0.89, 2);
  });
  it("не считает без пульса или без дистанции", () => {
    expect(efficiency(run("2026-08-05", 6.01, 2666, null))).toBeNull();
    expect(efficiency({ durationSec: 2666, hrAvg: 152 })).toBeNull();
  });
  it("усредняет по месяцам", () => {
    const months = efficiencyByMonth([run("2026-08-01", 8.52, 3758, 157), run("2026-08-05", 6.01, 2666, 152)]);
    expect(months).toHaveLength(1);
    expect(months[0].month).toBe("2026-08");
    expect(months[0].value).toBeGreaterThan(0.8);
  });
});
