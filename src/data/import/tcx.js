import { SaxesParser } from "saxes";
import { normalizeWorkout, toNumber } from "../schema.js";

export const TCX_SPORT_MAP = { Running: "running", Biking: "bike", Swimming: "swimming", Other: "other" };

/** Локальное имя тега без префикса пространства имён. */
const local = (name) => name.replace(/^.*:/, "");

/**
 * `onWarning` необязателен и работает так же, как в парсере Apple-экспорта: молча
 * принятое чужое значение хуже громкого сигнала. Особенно важно для вида спорта —
 * стандарт TCX разрешает очень узкий набор значений Sport, и плавание в него не
 * входит, поэтому бассейн приезжает как "Other" и без предупреждения навсегда
 * оседает в «Другое».
 */
export function parseTcx(xmlString, onWarning) {
  const parser = new SaxesParser({ position: false });
  const warn = onWarning || (() => {});
  const workouts = [];
  let activity = null;
  let lap = null;
  let path = [];
  let text = "";

  parser.on("opentag", (node) => {
    const tag = local(node.name);
    path.push(tag);
    text = "";
    if (tag === "Activity") {
      const sport = node.attributes.Sport?.value ?? node.attributes.Sport;
      if (!Object.hasOwn(TCX_SPORT_MAP, sport)) warn({ kind: "unknown-tcx-sport", sport: sport ?? "" });
      activity = { sport: TCX_SPORT_MAP[sport] || "other", id: null, laps: [] };
    } else if (tag === "Lap" && activity) {
      const start = node.attributes.StartTime?.value ?? node.attributes.StartTime;
      lap = { start, seconds: null, meters: null, kcal: null, hrAvg: null, hrMax: null, cadence: null, watts: null };
    }
  });

  parser.on("text", (chunk) => {
    text += chunk;
  });

  parser.on("closetag", (node) => {
    const tag = local(node.name);
    const value = text.trim();
    text = "";

    if (activity && tag === "Id" && !activity.id) activity.id = value;
    if (lap) {
      if (tag === "TotalTimeSeconds") lap.seconds = toNumber(value);
      else if (tag === "DistanceMeters") lap.meters = toNumber(value);
      else if (tag === "Calories") lap.kcal = toNumber(value);
      else if (tag === "AvgRunCadence" || tag === "AvgBikeCadence") lap.cadence = toNumber(value);
      else if (tag === "AvgWatts") lap.watts = toNumber(value);
      else if (tag === "Value") {
        const parent = path[path.length - 2];
        if (parent === "AverageHeartRateBpm") lap.hrAvg = toNumber(value);
        else if (parent === "MaximumHeartRateBpm") lap.hrMax = toNumber(value);
      }
    }

    if (tag === "Lap" && activity && lap) {
      activity.laps.push(lap);
      lap = null;
    }
    if (tag === "Activity" && activity) {
      workouts.push(buildWorkout(activity, warn));
      activity = null;
    }
    path.pop();
  });

  parser.on("error", (error) => {
    throw new Error(`Не удалось разобрать TCX: ${error.message}`);
  });

  parser.write(xmlString);
  parser.close();

  if (!workouts.length) throw new Error("В файле TCX не нашёл тренировок");
  return workouts;
}

const sum = (laps, field) => laps.reduce((acc, l) => acc + (l[field] || 0), 0);

function weightedHr(laps) {
  const total = laps.reduce((acc, l) => acc + (l.hrAvg ? l.seconds || 0 : 0), 0);
  if (!total) return null;
  const weighted = laps.reduce((acc, l) => acc + (l.hrAvg ? l.hrAvg * (l.seconds || 0) : 0), 0);
  return Math.round(weighted / total);
}

const firstOf = (laps, field) => laps.find((l) => l[field] !== null && l[field] !== undefined)?.[field] ?? null;

function buildWorkout(activity, warn) {
  const { laps } = activity;
  const lapStart = laps[0]?.start;
  const start = activity.id || lapStart;
  // Расхождение Id и начала первого круга сдвинуло бы ключ дедупликации, и та же
  // тренировка задублировалась бы. Разбираемый, но неверный Id иначе прошёл бы молча.
  if (activity.id && lapStart) {
    const diffMs = Math.abs(Date.parse(activity.id) - Date.parse(lapStart));
    if (Number.isFinite(diffMs) && diffMs > 60000) {
      warn({ kind: "id-lap-start-mismatch", id: activity.id, lapStart, diffSec: Math.round(diffMs / 1000) });
    }
  }
  const seconds = Math.round(sum(laps, "seconds"));
  const meters = sum(laps, "meters");
  const hrMaxValues = laps.map((l) => l.hrMax).filter((v) => v !== null && v !== undefined);

  return normalizeWorkout({
    type: activity.sport,
    start,
    durationSec: seconds,
    distanceKm: meters ? meters / 1000 : null,
    kcalActive: sum(laps, "kcal") || null,
    hrAvg: weightedHr(laps),
    hrMax: hrMaxValues.length ? Math.max(...hrMaxValues) : null,
    cadenceSpm: firstOf(laps, "cadence"),
    powerW: firstOf(laps, "watts"),
    source: "tcx",
  });
}
