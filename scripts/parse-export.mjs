#!/usr/bin/env node
// Потоковый разбор export.xml: файл может весить сотни мегабайт.
import { createReadStream, writeFileSync } from "node:fs";
import { createAppleWorkoutParser } from "../src/data/import/appleXml.js";

const [inputPath, flag, outPath] = process.argv.slice(2);
if (!inputPath || flag !== "-o" || !outPath) {
  console.error("Использование: node scripts/parse-export.mjs <export.xml> -o <workouts.json>");
  process.exit(1);
}

const workouts = [];
// Предупреждения группируются: одна незнакомая единица на 300 записей должна
// прочитаться как одна строка с количеством, а не как 300 строк шума.
const warnings = new Map();
const parser = createAppleWorkoutParser({
  onWorkout: (w) => workouts.push(w),
  onWarning: (w) => {
    const key = JSON.stringify(w);
    warnings.set(key, (warnings.get(key) || 0) + 1);
  },
});
const stream = createReadStream(inputPath, { encoding: "utf8", highWaterMark: 1 << 20 });

stream.on("data", (chunk) => parser.write(chunk));
stream.on("error", (error) => {
  console.error(`Не смог прочитать ${inputPath}: ${error.message}`);
  process.exit(1);
});
stream.on("end", () => {
  parser.close();
  writeFileSync(outPath, JSON.stringify({ workouts }, null, 2), "utf8");

  const byType = {};
  const byMonth = {};
  // Пробежки без записанной дистанции считаются отдельно: помесячный объём —
  // это то число, по которому сверяют разбор с известными значениями, и молча
  // выпавшие записи сделали бы сумму заниженной без всякого признака.
  let runsWithoutDistance = 0;
  for (const w of workouts) {
    byType[w.type] = (byType[w.type] || 0) + 1;
    if (w.type !== "running") continue;
    if (!w.distanceKm) {
      runsWithoutDistance += 1;
      continue;
    }
    const month = w.date.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + w.distanceKm;
  }
  console.log(`Тренировок: ${workouts.length} → ${outPath}`);
  console.log("По типам:", byType);
  console.log("Беговой объём по месяцам:");
  for (const month of Object.keys(byMonth).sort()) console.log(`  ${month}  ${byMonth[month].toFixed(2)} км`);
  if (runsWithoutDistance > 0) {
    console.log(`Пробежек без записанной дистанции: ${runsWithoutDistance} — в объём выше они не вошли. Учитывай это при сверке сумм с известными числами.`);
  }

  if (warnings.size === 0) {
    console.log("Предупреждений нет: все типы тренировок и единицы измерения распознаны.");
  } else {
    console.log("ПРЕДУПРЕЖДЕНИЯ — проверь, не искажены ли данные:");
    for (const [key, count] of warnings) console.log(`  ${key} × ${count}`);
    console.log("Незнакомый тип уходит в «Другое», незнакомая единица берётся как есть. Реши по каждому пункту, надо ли расширять APPLE_TYPE_MAP или конверсию единиц.");
  }
});
