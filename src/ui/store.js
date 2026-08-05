import { useCallback, useEffect, useRef, useState } from "react";
import { openFitnessDb, getSettings, getMeta, setMeta, exportAll } from "../data/db.js";
import { normalizeWorkout, toNumber } from "../data/schema.js";
import {
  importFile as importFileToDb,
  importText as importTextToDb,
  importUrl as importUrlToDb,
} from "../data/import/index.js";

const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
const byDateAsc = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

export function useStore() {
  const dbRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState({
    workouts: [], days: [], weights: [], foods: [], settings: {}, sync: {},
  });

  const refresh = useCallback(async () => {
    const db = dbRef.current;
    const [workouts, days, weights, foods, settings, sync] = await Promise.all([
      db.getAll("workouts"), db.getAll("days"), db.getAll("weights"), db.getAll("foods"),
      getSettings(db), getMeta(db, "sync"),
    ]);
    setState({
      workouts: workouts.sort(byDateDesc),
      days: days.sort(byDateDesc),
      weights: weights.sort(byDateAsc),
      foods,
      settings,
      sync: sync || {},
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let opened = null;
    (async () => {
      const db = await openFitnessDb();
      opened = db;
      // Размонтирование могло произойти, пока база открывалась. Тогда хендл уже
      // никому не нужен, но закрыть его обязан кто-то: cleanup к этому моменту
      // отработал и ничего не видел. Иначе соединение утекает, а в тестах
      // блокирует удаление базы и подвешивает следующий тест.
      if (cancelled) {
        db.close();
        return;
      }
      dbRef.current = db;
      await refresh();
      setReady(true);

      // Автоподгрузка при открытии: если в настройках задан источник, тянем оттуда
      // записи и сливаем. Отказ сети намеренно проглатывается — приложение обязано
      // открываться офлайн, просто без новых данных; результат виден в настройках.
      const url = (await getSettings(db)).syncUrl;
      if (!url || cancelled) return;
      try {
        const report = await importUrlToDb(db, url);
        if (cancelled) return;
        const added = ["workouts", "days", "weights", "foods"].reduce((n, k) => n + report[k].added, 0);
        await setMeta(db, "sync", { lastAutoSyncAt: new Date().toISOString(), lastAutoSyncAdded: added });
      } catch (error) {
        if (cancelled) return;
        await setMeta(db, "sync", { lastAutoSyncError: error.message });
      }
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
      // Закрываем то, что успело открыться, в любом из двух порядков.
      (dbRef.current ?? opened)?.close();
      dbRef.current = null;
    };
  }, [refresh]);

  const actions = {
    async importFile(file) {
      const report = await importFileToDb(dbRef.current, file);
      await refresh();
      return report;
    },
    async importText(text) {
      const report = await importTextToDb(dbRef.current, text);
      await refresh();
      return report;
    },
    /** Подтянуть записи из источника вручную, не дожидаясь следующего открытия. */
    async syncNow() {
      const url = (await getSettings(dbRef.current)).syncUrl;
      if (!url) throw new Error("Источник данных не задан — впишите ссылку в настройках");
      const report = await importUrlToDb(dbRef.current, url);
      const added = ["workouts", "days", "weights", "foods"].reduce((n, k) => n + report[k].added, 0);
      await setMeta(dbRef.current, "sync", { lastAutoSyncAt: new Date().toISOString(), lastAutoSyncAdded: added });
      await refresh();
      return report;
    },
    async saveDay(day) {
      await dbRef.current.put("days", {
        date: day.date,
        // Подстраховка: ни один приём пищи не должен попасть в базу без id, иначе
        // удаление одной записи снесёт все записи дня (условие «id не равен» станет
        // ложным сразу для всех). Лечение при открытии закрывает старые данные,
        // это условие закрывает все будущие записи.
        meals: (day.meals || []).map((meal) => (meal.id ? meal : { ...meal, id: crypto.randomUUID() })),
        symptoms: day.symptoms || [],
        water: toNumber(day.water) ?? 0,
        note: day.note || "",
      });
      await refresh();
    },
    async saveWeight(date, kg) {
      const value = toNumber(kg);
      if (value === null) throw new Error("Вес должен быть числом");
      await dbRef.current.put("weights", { date, kg: value, source: "manual" });
      await refresh();
    },
    async saveWorkout(raw) {
      await dbRef.current.put("workouts", normalizeWorkout({ source: "manual", ...raw }));
      await refresh();
    },
    async deleteWorkout(id) {
      await dbRef.current.delete("workouts", id);
      await refresh();
    },
    async saveSettings(patch) {
      await setMeta(dbRef.current, "settings", patch);
      await refresh();
    },
    /**
     * Выгружает всё в файл и отмечает время бэкапа. Это единственный путь бэкапа
     * в приложении, поэтому он написан под iOS, а не под десктопный браузер.
     *
     * На iPhone атрибут `download` у ссылки работает ненадёжно: файл часто
     * открывается во вкладке вместо сохранения. Штатный путь на iOS — системное
     * окно «Поделиться», через него файл уходит в «Файлы». Поэтому сначала
     * пробуем Web Share API с файлом, и только если он недоступен — ссылку.
     *
     * `revokeObjectURL` вызывается с задержкой: синхронный отзыв сразу после
     * click() в Safari успевает отменить скачивание.
     */
    async download() {
      const dump = await exportAll(dbRef.current);
      const stamp = new Date().toISOString().slice(0, 10);
      const name = `dnevnik-${stamp}.json`;
      const json = JSON.stringify(dump, null, 2);
      const blob = new Blob([json], { type: "application/json" });

      let shared = false;
      if (navigator.canShare && navigator.share) {
        const file = new File([blob], name, { type: "application/json" });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: name });
            shared = true;
          } catch (error) {
            // Пользователь мог закрыть окно «Поделиться» — это не ошибка выгрузки,
            // но и бэкапом не считается: отмечаем только состоявшуюся выгрузку.
            if (error?.name === "AbortError") return;
          }
        }
      }

      if (!shared) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }

      await setMeta(dbRef.current, "sync", { lastBackupAt: new Date().toISOString() });
      await refresh();
    },
  };

  return { ready, ...state, actions };
}
