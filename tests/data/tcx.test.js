import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTcx } from "@/data/import/tcx.js";

const fixture = (name) => readFileSync(resolve(import.meta.dirname, "../fixtures", name), "utf8");

describe("parseTcx", () => {
  it("собирает тренировку с одним кругом", () => {
    const [w] = parseTcx(fixture("healthfit-run.tcx"));
    expect(w).toMatchObject({
      type: "running",
      durationSec: 2666,
      distanceKm: 6.01,
      kcalActive: 627,
      hrAvg: 152,
      hrMax: 171,
      cadenceSpm: 159,
      powerW: 290,
      source: "tcx",
    });
  });

  it("даёт тот же ключ, что и Apple-экспорт того же забега", () => {
    const [w] = parseTcx(fixture("healthfit-run.tcx"));
    expect(w.id).toBe("2026-08-05T11:46Z|running");
  });

  it("суммирует круги и взвешивает пульс по времени", () => {
    const [w] = parseTcx(fixture("healthfit-two-laps.tcx"));
    expect(w.durationSec).toBe(2601);
    expect(w.distanceKm).toBeCloseTo(6.05, 2);
    expect(w.kcalActive).toBe(641);
    // (140*2000 + 179*601) / 2601 = 149.0
    expect(w.hrAvg).toBe(149);
    expect("cadenceSpm" in w).toBe(false);
  });

  it("бросает понятную ошибку, если тренировок в файле нет", () => {
    expect(() => parseTcx("<TrainingCenterDatabase></TrainingCenterDatabase>")).toThrow(/не нашёл тренировок/i);
  });

  it("сообщает о незнакомом виде спорта и сводит его к other", () => {
    const warnings = [];
    const xml = fixture("healthfit-run.tcx").replace('Sport="Running"', 'Sport="Kitesurfing"');
    const [w] = parseTcx(xml, (x) => warnings.push(x));
    expect(warnings).toEqual([{ kind: "unknown-tcx-sport", sport: "Kitesurfing" }]);
    expect(w.type).toBe("other");
  });

  it("сообщает о расхождении Id и начала первого круга", () => {
    const warnings = [];
    // Id сдвинут на пять минут относительно StartTime круга — ключ дедупликации уехал бы.
    const xml = fixture("healthfit-run.tcx").replace("<Id>2026-08-05T11:46:00Z</Id>", "<Id>2026-08-05T11:51:00Z</Id>");
    parseTcx(xml, (x) => warnings.push(x));
    expect(warnings).toEqual([
      { kind: "id-lap-start-mismatch", id: "2026-08-05T11:51:00Z", lapStart: "2026-08-05T11:46:00Z", diffSec: 300 },
    ]);
  });

  it("на обеих фикстурах не выдаёт ни одного предупреждения", () => {
    const warnings = [];
    parseTcx(fixture("healthfit-run.tcx"), (x) => warnings.push(x));
    parseTcx(fixture("healthfit-two-laps.tcx"), (x) => warnings.push(x));
    expect(warnings).toEqual([]);
  });
});
