import { SaxesParser } from "saxes";
import { normalizeWorkout, toNumber } from "../schema.js";

export const APPLE_TYPE_MAP = {
  HKWorkoutActivityTypeRunning: "running",
  HKWorkoutActivityTypeSwimming: "swimming",
  HKWorkoutActivityTypeSwimBikeRun: "running",
  HKWorkoutActivityTypeWalking: "walking",
  HKWorkoutActivityTypeHiking: "walking",
  HKWorkoutActivityTypeCycling: "bike",
  HKWorkoutActivityTypeIndoorCycling: "bike",
  HKWorkoutActivityTypeTraditionalStrengthTraining: "strength",
  HKWorkoutActivityTypeFunctionalStrengthTraining: "strength",
  HKWorkoutActivityTypeCoreTraining: "core",
  HKWorkoutActivityTypeElliptical: "elliptical",
  HKWorkoutActivityTypeStairClimbing: "ladder",
  HKWorkoutActivityTypeStepTraining: "ladder",
};

const APPLE_DATE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-])(\d{2})(\d{2})$/;

export function appleDateToIso(value) {
  const m = APPLE_DATE.exec(String(value).trim());
  if (!m) throw new Error(`Не разобрал дату Apple: ${value}`);
  return `${m[1]}T${m[2]}${m[3]}${m[4]}:${m[5]}`;
}

/**
 * Величина в километрах: Apple пишет km, m, mi. Нераспознанная единица не молчит:
 * значение возвращается как есть, но наверх уходит предупреждение. Молча принять
 * чужую единицу за километры — значит тихо испортить историю, а это худший исход:
 * заметить потом нечем. Ронять разбор всего файла из-за одной записи тоже нельзя.
 */
function toKm(value, unit, warn) {
  const n = toNumber(value);
  if (n === null) return null;
  if (unit === "km" || unit === undefined || unit === "") return n;
  if (unit === "m") return n / 1000;
  if (unit === "mi") return n * 1.609344;
  warn({ kind: "unknown-distance-unit", unit });
  return n;
}

/** Величина в метрах: метаданные высоты приходят в cm или m. Чужая единица — предупреждение. */
function toMeters(value, warn) {
  const raw = String(value).trim();
  const n = toNumber(raw);
  if (n === null) return null;
  if (/cm/i.test(raw)) return n / 100;
  const unit = raw.replace(/[\d.,\s-]/g, "");
  if (unit && !/^m$/i.test(unit)) warn({ kind: "unknown-elevation-unit", unit });
  return n;
}

const DISTANCE_TYPES = new Set([
  "HKQuantityTypeIdentifierDistanceWalkingRunning",
  "HKQuantityTypeIdentifierDistanceSwimming",
  "HKQuantityTypeIdentifierDistanceCycling",
  "HKQuantityTypeIdentifierDistanceDownhillSnowSports",
]);

function startWorkout(attrs, warn) {
  const appleType = attrs.workoutActivityType || "";
  const durationMin = toNumber(attrs.duration);
  if (!Object.hasOwn(APPLE_TYPE_MAP, appleType)) warn({ kind: "unknown-activity-type", type: appleType });
  return {
    raw: {
      type: APPLE_TYPE_MAP[appleType] || "other",
      appleType,
      start: appleDateToIso(attrs.startDate),
      end: attrs.endDate ? appleDateToIso(attrs.endDate) : undefined,
      durationSec: durationMin === null ? null : Math.round(durationMin * 60),
      source: "apple-export",
    },
    activeKcal: toNumber(attrs.totalEnergyBurned),
    basalKcal: null,
    stepCount: null,
    legacyDistance: toKm(attrs.totalDistance, attrs.totalDistanceUnit || "km", warn),
  };
}

function applyStatistics(state, attrs, warn) {
  const type = attrs.type || "";
  if (type === "HKQuantityTypeIdentifierActiveEnergyBurned") state.activeKcal = toNumber(attrs.sum);
  else if (type === "HKQuantityTypeIdentifierBasalEnergyBurned") state.basalKcal = toNumber(attrs.sum);
  else if (DISTANCE_TYPES.has(type)) state.raw.distanceKm = toKm(attrs.sum, attrs.unit, warn);
  else if (type === "HKQuantityTypeIdentifierHeartRate") {
    state.raw.hrAvg = toNumber(attrs.average);
    state.raw.hrMax = toNumber(attrs.maximum);
  } else if (type === "HKQuantityTypeIdentifierRunningPower" || type === "HKQuantityTypeIdentifierCyclingPower") {
    state.raw.powerW = toNumber(attrs.average);
  } else if (type === "HKQuantityTypeIdentifierStepCount") state.stepCount = toNumber(attrs.sum);
  else if (/EffortScore$/.test(type)) state.raw.effort = toNumber(attrs.average ?? attrs.sum);
}

function applyMetadata(state, attrs, warn) {
  if (attrs.key === "HKElevationAscended") state.raw.elevationM = toMeters(attrs.value, warn);
  else if (/EffortScore$/i.test(attrs.key || "")) state.raw.effort = toNumber(attrs.value);
  else if (attrs.key === "HKWeatherTemperature" || attrs.key === "HKIndoorWorkout") {
    // Намеренно игнорируем: в схеме этих полей нет.
  }
}

function finishWorkout(state) {
  const { raw } = state;
  if (state.activeKcal !== null) raw.kcalActive = state.activeKcal;
  if (state.activeKcal !== null && state.basalKcal !== null) raw.kcalTotal = state.activeKcal + state.basalKcal;
  if (raw.distanceKm === undefined && state.legacyDistance !== null) raw.distanceKm = state.legacyDistance;
  if (state.stepCount !== null && raw.durationSec) {
    raw.cadenceSpm = Math.round(state.stepCount / (raw.durationSec / 60));
  }
  return normalizeWorkout(raw);
}

export function createAppleWorkoutParser({ onWorkout, onWarning }) {
  const parser = new SaxesParser({ position: false });
  const warn = onWarning || (() => {});
  let state = null;

  parser.on("opentag", (node) => {
    if (node.name === "Workout") {
      state = startWorkout(mapAttrs(node.attributes), warn);
      return;
    }
    if (!state) return;
    if (node.name === "WorkoutStatistics") applyStatistics(state, mapAttrs(node.attributes), warn);
    else if (node.name === "MetadataEntry") applyMetadata(state, mapAttrs(node.attributes), warn);
  });

  parser.on("closetag", (node) => {
    if (node.name !== "Workout" || !state) return;
    onWorkout(finishWorkout(state));
    state = null;
  });

  parser.on("error", (error) => {
    throw new Error(`Не удалось разобрать XML: ${error.message}`);
  });

  return {
    write(chunk) {
      parser.write(chunk);
    },
    close() {
      parser.close();
    },
  };
}

/** saxes отдаёт атрибуты объектом со значениями-строками; DTD-режим не используется. */
function mapAttrs(attributes) {
  const out = {};
  for (const [key, value] of Object.entries(attributes)) {
    out[key] = typeof value === "string" ? value : value?.value;
  }
  return out;
}

/** Обёртка для тестов и небольших файлов. `onWarning` необязателен и просто прокидывается. */
export function parseAppleWorkouts(xmlString, onWarning) {
  const workouts = [];
  const parser = createAppleWorkoutParser({ onWorkout: (w) => workouts.push(w), onWarning });
  parser.write(xmlString);
  parser.close();
  return workouts;
}
