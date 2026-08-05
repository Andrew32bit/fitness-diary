/** Создание хранилищ по версиям. Вызывается только из upgrade-колбэка idb. */
export function runMigrations(db, oldVersion) {
  if (oldVersion < 1) {
    const workouts = db.createObjectStore("workouts", { keyPath: "id" });
    workouts.createIndex("byDate", "date");
    db.createObjectStore("days", { keyPath: "date" });
    db.createObjectStore("weights", { keyPath: "date" });
    db.createObjectStore("foods", { keyPath: "id" });
    db.createObjectStore("meta", { keyPath: "name" });
  }
}
