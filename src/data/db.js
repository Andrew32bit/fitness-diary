import { openDB } from "idb";
import { SCHEMA_VERSION, DEFAULT_SETTINGS } from "./schema.js";
import { runMigrations } from "./migrations.js";

export const DB_NAME = "fitness";
export const STORES = ["workouts", "days", "weights", "foods", "meta"];

export async function openFitnessDb() {
  const db = await openDB(DB_NAME, SCHEMA_VERSION, {
    upgrade(db, oldVersion) {
      runMigrations(db, oldVersion);
    },
  });
  await backfillMealIds(db);
  return db;
}

/**
 * Одноразовое лечение данных: приёмы пищи, импортированные до появления `withMealIds`,
 * не имеют `id`. Интерфейс использует `id` и как React-ключ, и как признак при удалении,
 * поэтому у таких записей ключ у всех одинаково пустой: карточки путаются, а удаление
 * ОДНОГО приёма стирает все приёмы за день, потому что условие «id не равен» ложно сразу
 * для всех. Это потеря данных по одному клику, и лечить её надо в данных.
 *
 * Сделано лечением при открытии, а не миграцией версии схемы, сознательно: операция
 * идемпотентна, помечена флагом в `meta`, не может примениться наполовину и не требует
 * возни с асинхронными запросами внутри version-change транзакции.
 */
async function backfillMealIds(db) {
  const flag = await db.get("meta", "mealIdsBackfilled");
  if (flag?.done) return;

  const tx = db.transaction("days", "readwrite");
  let cursor = await tx.store.openCursor();
  let healed = 0;
  while (cursor) {
    const day = cursor.value;
    const meals = day.meals || [];
    if (meals.some((meal) => !meal.id)) {
      await cursor.update({
        ...day,
        meals: meals.map((meal) => (meal.id ? meal : { ...meal, id: crypto.randomUUID() })),
      });
      healed += 1;
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  await db.put("meta", { name: "mealIdsBackfilled", done: true, healedDays: healed });
}

export function getMeta(db, name) {
  return db.get("meta", name);
}

export async function setMeta(db, name, patch) {
  const current = (await db.get("meta", name)) || { name };
  await db.put("meta", { ...current, ...patch, name });
}

export async function getSettings(db) {
  const saved = await getMeta(db, "settings");
  const { name, ...values } = saved || {};
  return { ...DEFAULT_SETTINGS, ...values };
}

export async function exportAll(db) {
  const dump = { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() };
  for (const store of STORES) dump[store] = await db.getAll(store);
  return dump;
}
