import { unzipSync, strFromU8 } from "fflate";
import { parseAppleWorkouts } from "./appleXml.js";
import { parseTcx } from "./tcx.js";
import { parsePatch } from "./patch.js";
import { mergeAll } from "./merge.js";
import { setMeta } from "../db.js";

export function detectFormat(name, head) {
  const lower = String(name || "").toLowerCase();
  const start = String(head || "").slice(0, 400);

  if (lower.endsWith(".zip") || start.startsWith("PK")) return "zip";
  if (start.includes("TrainingCenterDatabase") || lower.endsWith(".tcx")) return "tcx";
  if (start.includes("<HealthData") || lower.endsWith(".xml")) return "apple-xml";
  if (lower.endsWith(".json") || /^\s*[{[]/.test(start)) return "json";
  throw new Error(`Не понял формат файла «${name}». Ожидаю export.xml, export.zip, TCX или JSON.`);
}

function xmlFromZip(bytes) {
  // filter: рядом с export.xml в архиве Apple лежат сотни файлов маршрутов и
  // второй огромный export_cda.xml — без фильтра всё это разжалось бы в память.
  const files = unzipSync(bytes, { filter: (file) => file.name.toLowerCase().endsWith("export.xml") });
  const key = Object.keys(files).find((k) => k.toLowerCase().endsWith("export.xml"));
  if (!key) throw new Error("В архиве нет export.xml — распакуйте архив и выберите файл напрямую");
  return strFromU8(files[key]);
}

export async function parseFile({ name, bytes }) {
  // latin1: у zip первые байты бинарные, UTF-8-декодирование дало бы мусор вместо "PK".
  const head = strFromU8(bytes.subarray(0, 400), true);
  let format = detectFormat(name, head);
  let text;

  if (format === "zip") {
    text = xmlFromZip(bytes);
    format = "apple-xml";
  } else {
    text = strFromU8(bytes);
  }

  if (format === "apple-xml") return { workouts: parseAppleWorkouts(text), days: [], weights: [], foods: [] };
  if (format === "tcx") return { workouts: parseTcx(text), days: [], weights: [], foods: [] };
  return parsePatch(text);
}

export async function importFile(db, file) {
  const patch = await parseFile(file);
  const report = await mergeAll(db, patch);
  await setMeta(db, "sync", { lastImportAt: new Date().toISOString() });
  return report;
}

export async function importText(db, text) {
  const report = await mergeAll(db, parsePatch(text));
  await setMeta(db, "sync", { lastImportAt: new Date().toISOString() });
  return report;
}
