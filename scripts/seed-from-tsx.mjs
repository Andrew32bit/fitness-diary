#!/usr/bin/env node
// Вытаскивает SEED_ENTRIES и SEED_WEIGHTS из исходника артефакта.
// Блоки — обычные JS-объекты без JSX, поэтому вычисляются в изолированной функции.
import { readFileSync, writeFileSync } from "node:fs";

function extractBlock(source, name) {
  const start = source.indexOf(`var ${name} = `);
  if (start === -1) throw new Error(`Не нашёл ${name} в исходнике`);
  const from = source.indexOf("{", start);
  let depth = 0;
  for (let i = from; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(from, i + 1);
    }
  }
  throw new Error(`Не нашёл закрывающую скобку для ${name}`);
}

/**
 * Разбор по скобкам не различает скобки внутри строковых литералов. Сбалансированные
 * `{}` в тексте заметки извлекаются корректно, несбалансированная скобка даёт невалидный
 * JS и падение здесь — то есть отказ громкий, а не молча испорченные данные. Поэтому
 * полноценный разбор строк не нужен, нужно понятное сообщение об этой причине.
 */
function evalBlock(source, name) {
  const block = extractBlock(source, name);
  try {
    return new Function(`return (${block});`)();
  } catch (error) {
    throw new Error(
      `Не смог разобрать ${name}: ${error.message}. Вероятная причина — несбалансированная фигурная скобка внутри текста заметки в артефакте.`,
    );
  }
}

export function extractSeed(source) {
  return { days: evalBlock(source, "SEED_ENTRIES"), weights: evalBlock(source, "SEED_WEIGHTS") };
}

/** Читает список продуктов, если он передан. Все отказы — по-русски и с указанием пути. */
function readFoods() {
  const index = process.argv.indexOf("--foods");
  if (index === -1) return [];
  const path = process.argv[index + 1];
  if (!path || path.startsWith("--")) throw new Error("После --foods не указан путь к файлу");
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`Не смог прочитать файл продуктов: ${path}`);
  }
  try {
    const foods = JSON.parse(raw);
    if (!Array.isArray(foods)) throw new Error("ожидался массив");
    return foods;
  } catch (error) {
    throw new Error(`Не смог разобрать файл продуктов ${path}: ${error.message}`);
  }
}

function main() {
  const [tsxPath, , outPath] = process.argv.slice(2);
  if (!tsxPath || !outPath) {
    console.error('Использование: node scripts/seed-from-tsx.mjs "<путь к health diary.tsx>" -o <выходной json> [--foods <foods.json>]');
    process.exit(1);
  }
  const seed = extractSeed(readFileSync(tsxPath, "utf8"));
  const foods = readFoods();
  writeFileSync(outPath, JSON.stringify({ ...seed, foods }, null, 2), "utf8");
  console.log(
    `Дней: ${Object.keys(seed.days).length}, замеров веса: ${Object.keys(seed.weights).length}, продуктов: ${foods.length} → ${outPath}`,
  );
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) main();
