import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { stripTags } from "./lib/html.mjs";
import { dataDir, loadStore } from "./lib/store.mjs";
import { loadRaceAliases, normalizeRaceName, raceKey } from "./lib/races.mjs";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/import-netkeiba-result-html.mjs <netkeiba-race-result.html>");
  process.exit(1);
}

const resultsPath = path.join(dataDir, "race-results.json");
const db = await loadStore();
const aliases = await loadRaceAliases();
const existingResults = await loadResults();
const html = await readFile(inputPath, "utf8");
const raceInfo = parseRaceInfo(html);
const entries = parseResultRows(html, raceInfo.sourceRaceName);

if (!raceInfo.date || !raceInfo.name || !Object.keys(entries).length) {
  throw new Error(`netkeiba result parse failed: date=${raceInfo.date}, race=${raceInfo.name}, entries=${Object.keys(entries).length}`);
}

const key = raceKey(raceInfo.date.slice(0, 4), raceInfo.name);
const photoRaceKeys = new Set(db.photos.map((photo) => photo.raceKey).filter(Boolean));
existingResults.races ||= {};
existingResults.races[key] = {
  date: raceInfo.date,
  name: raceInfo.name,
  source: "netkeiba-html",
  grade: raceInfo.grade,
  sourceRaceNames: [raceInfo.sourceRaceName],
  entries
};
existingResults.races = Object.fromEntries(Object.entries(existingResults.races).sort(([a], [b]) => b.localeCompare(a, "ja")));

await writeFile(resultsPath, `${JSON.stringify(existingResults, null, 2)}\n`);
console.log(`race: ${key}`);
console.log(`entries imported: ${Object.keys(entries).length}`);
console.log(`matched photo race: ${photoRaceKeys.has(key) ? "yes" : "no"}`);

async function loadResults() {
  try {
    return JSON.parse(await readFile(resultsPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { version: 1, races: {} };
  }
}

function parseRaceInfo(html) {
  const title = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const metaDescription = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1] ?? "";
  const source = `${title} ${metaDescription}`.normalize("NFKC");
  const dateMatch = source.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const raceMatch = source.match(/([^\s|_]+?)\((G[123])\)\s*結果/) ?? source.match(/(\S+?)(G[123])\s*結果/);
  const rawName = raceMatch?.[1] ?? "";
  const grade = raceMatch?.[2] ?? "";
  const name = normalizeRaceName(rawName, aliases);
  return {
    date: dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}` : "",
    name,
    grade,
    sourceRaceName: `${name}${grade}`
  };
}

function parseResultRows(html, sourceRaceName) {
  const tbody = html.match(/<table[^>]+id=["']All_Result_Table["'][\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? "";
  const entries = {};
  for (const rowMatch of tbody.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
    const row = rowMatch[0];
    const horseName = stripTags(row.match(/<span class=["']HorseNameSpan["']>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    if (!horseName) continue;
    const finishText = stripTags(row.match(/<div class=["']Rank["']>([\s\S]*?)<\/div>/i)?.[1] ?? "");
    const sexAge = stripTags(row.match(/<span class=["']Lgt_Txt Txt_C["']>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const weightText = stripTags(row.match(/<td class=["']Weight["']>([\s\S]*?)<\/td>/i)?.[1] ?? "");
    const finish = normalizeFinish(finishText);
    entries[horseName] = {
      finish: finish.finish,
      status: finish.status,
      bodyWeight: normalizeNumber(weightText.match(/\d+/)?.[0] ?? ""),
      sex: sexAge.slice(0, 1),
      age: normalizeNumber(sexAge.slice(1)),
      birthDate: "",
      sire: "",
      dam: "",
      damsire: "",
      sourceRaceName
    };
  }
  return entries;
}

function normalizeFinish(value) {
  const normalized = String(value || "").normalize("NFKC").trim();
  if (!normalized) return { finish: "", status: "pending" };
  if (/取消|除外|中止|回避/.test(normalized)) {
    const status = normalized.includes("取消") ? "scratched" : normalized.includes("除外") ? "excluded" : normalized.includes("中止") ? "stopped" : "withdrawn";
    return { finish: normalized, status };
  }
  return { finish: normalizeNumber(normalized), status: "started" };
}

function normalizeNumber(value) {
  const match = String(value || "").normalize("NFKC").match(/\d+/);
  return match ? Number(match[0]) : "";
}
