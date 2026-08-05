import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import { deleteDB } from "idb";
import { useStore } from "@/ui/store.js";
import { DEFAULT_SETTINGS } from "@/data/schema.js";

beforeEach(async () => {
  await deleteDB("fitness");
});

// Размонтирование хука закрывает соединение через cleanup-эффект useStore.
// Без этого `deleteDB` в следующем тесте зависает на открытом хендле.
afterEach(() => {
  cleanup();
});

describe("useStore", () => {
  it("поднимает пустое состояние с настройками по умолчанию", async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.workouts).toEqual([]);
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("сохраняет тренировку и отдаёт её сортированной по убыванию даты", async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.actions.saveWorkout({ type: "running", start: "2026-08-01T12:52:00+03:00", durationSec: 3758, distanceKm: 8.52 });
      await result.current.actions.saveWorkout({ type: "running", start: "2026-08-05T14:46:00+03:00", durationSec: 2666, distanceKm: 6.01 });
    });

    expect(result.current.workouts.map((w) => w.date)).toEqual(["2026-08-05", "2026-08-01"]);
  });

  it("сохраняет вес и настройки", async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.actions.saveWeight("2025-03-10", 90.5);
      await result.current.actions.saveSettings({ kcalLimit: 1600 });
    });

    expect(result.current.weights).toEqual([{ date: "2025-03-10", kg: 90.5, source: "manual" }]);
    expect(result.current.settings.kcalLimit).toBe(1600);
  });

  it("импорт текста наполняет состояние и возвращает отчёт", async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.ready).toBe(true));

    let report;
    await act(async () => {
      report = await result.current.actions.importText(JSON.stringify({ weights: { "2026-07-01": 113.0 } }));
    });

    expect(report.weights.added).toBe(1);
    expect(result.current.weights).toHaveLength(1);
    expect(result.current.sync.lastImportAt).toBeTruthy();
  });
});
