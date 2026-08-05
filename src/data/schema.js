export const SCHEMA_VERSION = 1;

export const WORKOUT_TYPES = {
  running:    { ru: "Бег",            distance: true  },
  swimming:   { ru: "Бассейн",        distance: true  },
  walking:    { ru: "Ходьба",         distance: true  },
  bike:       { ru: "Велотренажёр",   distance: true  },
  strength:   { ru: "Силовая",        distance: false },
  core:       { ru: "Кор",            distance: false },
  elliptical: { ru: "Эллипс",         distance: false },
  airdyne:    { ru: "AirDyne",        distance: false },
  ladder:     { ru: "Jacob's Ladder", distance: false },
  sauna:      { ru: "Сауна",          distance: false },
  other:      { ru: "Другое",         distance: false },
};

export const SOURCE_PRIORITY = { "apple-export": 4, tcx: 3, shortcut: 2, chat: 1, manual: 0 };

// Нейтральные значения по умолчанию: настоящие цель и стартовый вес пользователь
// вводит один раз в настройках. В публичном репозитории им не место.
// То же касается целей по макронутриентам — proteinGoal/fatGoal/carbsGoal.
export const DEFAULT_SETTINGS = {
  goalKg: 80, startKg: 100, kcalLimit: 2000, zone2MaxHr: 140,
  proteinGoal: 150, fatGoal: 70, carbsGoal: 200,
};

const OPTIONAL_NUMBERS = [
  "distanceKm", "kcalActive", "kcalTotal", "hrAvg", "hrMax",
  "cadenceSpm", "powerW", "elevationM", "effort",
];

const HAS_OFFSET = /[+-]\d\d:?\d\d$/;

export function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Дата дня по локальному времени старта, а не по UTC. */
export function localDate(iso) {
  const s = String(iso);
  if (HAS_OFFSET.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Некорректная дата: ${iso}`);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Ключ в UTC с точностью до минуты: TCX и Apple-экспорт дают одинаковый. */
export function workoutKey(startIso, type) {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) throw new Error(`Некорректное время старта: ${startIso}`);
  d.setUTCSeconds(0, 0);
  return `${d.toISOString().slice(0, 16)}Z|${type}`;
}

export function normalizeWorkout(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Тренировка должна быть объектом");
  if (!raw.start) throw new Error("У тренировки нет времени старта");
  const start = new Date(raw.start);
  if (Number.isNaN(start.getTime())) throw new Error(`Некорректное время старта: ${raw.start}`);

  const durationSec = toNumber(raw.durationSec);
  if (!durationSec || durationSec <= 0) throw new Error("У тренировки нет длительности");

  const type = Object.hasOwn(WORKOUT_TYPES, raw.type) ? raw.type : "other";

  const w = {
    id: workoutKey(raw.start, type),
    date: raw.date || localDate(raw.start),
    type,
    start: String(raw.start),
    end: raw.end ? String(raw.end) : new Date(start.getTime() + durationSec * 1000).toISOString(),
    durationSec,
    source: raw.source || "manual",
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };

  for (const field of OPTIONAL_NUMBERS) {
    const n = toNumber(raw[field]);
    if (n !== null) w[field] = n;
  }
  for (const field of ["location", "note", "appleType"]) {
    if (raw[field]) w[field] = String(raw[field]);
  }
  return w;
}
