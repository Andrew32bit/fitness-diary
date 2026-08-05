import { toNumber, WORKOUT_TYPES, workoutKey } from "../schema.js";

/** Русские названия из исходного дневника → ключи схемы. */
const RU_TO_TYPE = Object.fromEntries(
  Object.entries(WORKOUT_TYPES).map(([key, { ru }]) => [ru.toLowerCase(), key]),
);

/**
 * Один нормализатор дня на оба входных формата. Форма собирается в одном месте
 * намеренно: приложение принимает и словарь, и массив, и если поле добавить
 * только в одну ветку, поведение начнёт зависеть от формата файла.
 */
function normalizeDay(date, d) {
  return {
    date,
    meals: d.meals || [],
    symptoms: d.symptoms || [],
    water: toNumber(d.water) ?? 0,
    note: d.note || "",
    workouts: d.workouts || [],
  };
}

function asDayList(days) {
  if (!days) return [];
  if (Array.isArray(days)) return days.map((d) => normalizeDay(d.date, d));
  return Object.entries(days).map(([date, d]) => normalizeDay(date, d));
}

function asWeightList(weights) {
  if (!weights) return [];
  if (Array.isArray(weights)) {
    return weights.map((w) => ({ date: w.date, kg: toNumber(w.kg), source: w.source }));
  }
  return Object.entries(weights).map(([date, kg]) => ({ date, kg: toNumber(kg) }));
}

/**
 * Запись с нулевой длительностью — не тренировка, а заметка дня: в дневнике так
 * записаны медицинские процедуры: они попадают в массив тренировок дня с `minutes: 0`.
 * Такие записи обязаны сохраняться как заметка, а не ронять импорт всей истории.
 */
const isDayNote = (raw) => !toNumber(raw.minutes);

/**
 * Извлекает метрики из текста заметки дневника. В дневнике, который велся руками,
 * дистанция и пульс записаны прозой: «8.38 км за 1:00:13, темп 7:11/км, пульс ср 151,
 * каденс 156, мощность 295Вт, набор высоты 72м. Усилие 7/10».
 *
 * Без этого разбора вся статистика за перенесённые месяцы пустая: объёмы, рекорды,
 * темп и доля зоны 2 считаются по числовым полям, а не по тексту. Данные при этом
 * физически есть — они просто лежат в заметке.
 *
 * Извлекается только то, что записано однозначно. Две ловушки закрыты явно:
 * дистанция берётся исключительно в километрах, иначе «набор высоты 72м» притворился
 * бы дистанцией в метрах; и «км» не считается дистанцией, если за ним идёт «/ч» —
 * «скорость 9 км/ч» это скорость, а не девять километров. Вторая ловушка реальна:
 * в дневнике есть заметки вида «10.1 км со скоростью 9 км/ч», и без этой проверки
 * запись, где скорость указана без дистанции, дала бы заведомо неверный километраж.
 */
function metricsFromNote(note) {
  const text = String(note || "");
  const num = (re) => {
    const found = re.exec(text);
    return found ? toNumber(found[1]) : null;
  };
  return {
    distanceKm: num(/(\d+(?:[.,]\d+)?)\s*км(?!\s*\/\s*ч)/i),
    hrAvg: num(/пульс(?:\s+ср\.?)?\s+(\d{2,3})/i),
    cadenceSpm: num(/каденс\s+(\d{2,3})/i),
    powerW: num(/мощность\s+(\d{2,4})/i),
    elevationM: num(/набор высоты\s+(\d{1,4})/i),
    effort: num(/усилие\s+(\d{1,2})\s*\/\s*10/i),
  };
}

/**
 * Точная длительность из заметки: «6.01 км за 44:26» или «8.38 км за 1:00:13».
 * В дневнике длительность хранилась целыми минутами, поэтому темп считался из
 * округления и занижался на несколько секунд на километр — при 44 минутах вместо
 * 44:26 темп выходил 7'19" вместо 7'23". Точное время есть в тексте, надо его взять.
 * Требуется предшествующее «за», иначе «темп 7:23/км» сошло бы за длительность.
 */
const DURATION_TOLERANCE_SEC = 90;

function durationFromNote(note, minutes) {
  const rounded = Math.round(minutes * 60);
  const candidates = [...String(note || "").matchAll(/за\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/gi)].map(
    ([, a, b, c]) =>
      c === undefined ? Number(a) * 60 + Number(b) : Number(a) * 3600 + Number(b) * 60 + Number(c),
  );
  if (!candidates.length) return null;

  // В заметке может оказаться несколько оборотов «за»: «разминка за 5:00, бег за 44:26».
  // Брать первый нельзя — длительность занизилась бы в разы, а темп взлетел. Выбираем
  // ближайшее к тому, что дневник записал минутами, и принимаем только если расхождение
  // в пределах полутора минут. Это не догадка: точное значение обязано быть рядом с
  // округлённым, а всё остальное — не длительность этой тренировки, и тогда честнее
  // остаться с минутами, чем подставить чужое число.
  const best = candidates.reduce((a, b) => (Math.abs(b - rounded) < Math.abs(a - rounded) ? b : a));
  return Math.abs(best - rounded) <= DURATION_TOLERANCE_SEC ? best : null;
}

/**
 * Настоящее время начала из заметки: «Улица, 14:46-15:30».
 * Без него все перенесённые тренировки показывали одинаковый условный полдень, что
 * выглядит как ошибка и мешает читать список. Дополнительная польза: у записи с
 * настоящим временем ключ совпадёт с ключом той же тренировки из Apple-экспорта,
 * и два источника склеятся в одну запись, а не в две.
 * Ключ остаётся устойчивым к повторному импорту: время берётся из того же текста.
 */
function startFromNote(date, note) {
  const found = /(\d{1,2}):(\d{2})\s*[-–—]\s*\d{1,2}:\d{2}/.exec(String(note || ""));
  if (!found) return null;
  const hh = Number(found[1]);
  const mm = Number(found[2]);
  if (hh > 23 || mm > 59) return null;
  return `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

const MIN_GAP_MIN = 10;
const minutesOfDay = (iso) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
const atMinutes = (date, total) =>
  `${date}T${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;

/**
 * Раскладывает тренировки одного дня по временам старта. Где в заметке есть настоящее
 * время — берём его; остальным выдаём условные слоты с шагом десять минут, ПРОПУСКАЯ
 * слоты ближе десяти минут к уже занятому времени.
 *
 * Без этого пропуска условный слот мог совпасть с настоящим временем другой тренировки
 * того же дня: ключи строятся из времени и типа, две записи схлопнулись бы в одну, и
 * одна тренировка исчезла бы молча. Десять минут, а не одна, потому что слияние считает
 * одной тренировкой всё, что начинается в пределах 120 секунд.
 *
 * Порядок записей в дне определяет результат целиком, поэтому повторный импорт того же
 * файла даёт те же ключи.
 */
function assignStarts(date, works) {
  const noteStarts = works.map((raw) => startFromNote(date, raw.note));
  const taken = noteStarts.filter(Boolean).map(minutesOfDay);
  const isFree = (m) => taken.every((t) => Math.abs(t - m) >= MIN_GAP_MIN);
  let slot = 0;
  return works.map((raw, i) => {
    if (noteStarts[i]) return noteStarts[i];
    let total = 12 * 60 + slot * MIN_GAP_MIN;
    while (!isFree(total)) {
      slot += 1;
      total = 12 * 60 + slot * MIN_GAP_MIN;
    }
    taken.push(total);
    slot += 1;
    return atMinutes(date, total);
  });
}

/** Тренировка из формата дневника: тип по-русски, минуты, ккал, заметка. */
function fromDiaryWorkout(raw, date, start) {
  const minutes = toNumber(raw.minutes);
  if (!minutes) throw new Error(`Тренировка ${date} без длительности`);
  // trim обязателен: JSON часто вставляется руками, и «Бег » с лишним пробелом
  // иначе молча уходит в «Другое» вместо бега.
  const type = RU_TO_TYPE[String(raw.type || "").trim().toLowerCase()] || "other";
  const durationSec = durationFromNote(raw.note, minutes) ?? Math.round(minutes * 60);
  const fromNote = metricsFromNote(raw.note);
  return {
    id: workoutKey(start, type),
    type,
    date,
    start,
    durationSec,
    kcalActive: toNumber(raw.kcal),
    // Явные поля приоритетнее разобранных из текста: текст — резервный источник.
    distanceKm: toNumber(raw.distanceKm) ?? fromNote.distanceKm,
    hrAvg: toNumber(raw.hrAvg) ?? fromNote.hrAvg,
    cadenceSpm: toNumber(raw.cadenceSpm) ?? fromNote.cadenceSpm,
    powerW: toNumber(raw.powerW) ?? fromNote.powerW,
    elevationM: toNumber(raw.elevationM) ?? fromNote.elevationM,
    effort: toNumber(raw.effort) ?? fromNote.effort,
    note: raw.note || "",
    source: "chat",
  };
}

/**
 * Настройки из входного файла. Свой экспорт кладёт их записью `settings` в `meta`,
 * а ручной патч может передать объект `settings` напрямую.
 *
 * Читать их обязательно: личные цели пользователя (целевой вес, лимит калорий, цели
 * по макросам, порог зоны 2) живут ТОЛЬКО в настройках на устройстве — в коде их нет
 * намеренно, репозиторий публичный. Без этого разбора восстановление из бэкапа
 * возвращало бы тренировки и еду, но молча сбрасывало все цели на значения
 * по умолчанию — ровно в тот момент, когда пользователь и так потерял данные.
 *
 * Восстанавливаются только настройки. `sync` и служебные флаги описывают состояние
 * конкретного устройства, переносить их на новое неверно: на нём бэкапа ещё не было.
 */
function asSettings(data) {
  if (data.settings && typeof data.settings === "object" && !Array.isArray(data.settings)) {
    return data.settings;
  }
  const record = (Array.isArray(data.meta) ? data.meta : []).find((entry) => entry?.name === "settings");
  if (!record) return null;
  const { name, ...values } = record;
  return Object.keys(values).length ? values : null;
}

export function parsePatch(input) {
  let data = input;
  if (typeof input === "string") {
    try {
      data = JSON.parse(input);
    } catch {
      throw new Error("Не удалось разобрать JSON");
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Ожидался объект с полями workouts, days, weights или foods");
  }

  const days = asDayList(data.days || data.entries);
  const workouts = [...(Array.isArray(data.workouts) ? data.workouts : [])];
  for (const day of days) {
    const real = [];
    for (const raw of day.workouts) {
      if (isDayNote(raw)) {
        const text = raw.note || raw.type || "";
        if (text) day.note = day.note ? `${day.note}. ${text}` : text;
        continue;
      }
      real.push(raw);
    }
    const starts = assignStarts(day.date, real);
    real.forEach((raw, i) => workouts.push(fromDiaryWorkout(raw, day.date, starts[i])));
    delete day.workouts;
  }

  const patch = {
    workouts,
    days,
    weights: asWeightList(data.weights),
    foods: Array.isArray(data.foods) ? data.foods : [],
    settings: asSettings(data),
  };

  const total =
    patch.workouts.length + patch.days.length + patch.weights.length + patch.foods.length +
    (patch.settings ? 1 : 0);
  if (total === 0) throw new Error("Файл пустой: не нашёл ни тренировок, ни дней, ни веса, ни продуктов");
  return patch;
}
