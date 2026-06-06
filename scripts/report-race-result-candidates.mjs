import { readFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, loadStore } from "./lib/store.mjs";

const resultsPath = path.join(dataDir, "race-results.json");
const today = process.argv.find((arg) => arg.startsWith("--today="))?.split("=")[1] || new Date().toISOString().slice(0, 10);
const limit = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || 30);

const db = await loadStore();
const results = await loadResults();
const races = raceSummaries(db);
const withResults = races.filter((race) => raceResultForSummary(race));
const withoutResults = races.filter((race) => !raceResultForSummary(race));
const past = withoutResults.filter((race) => race.date && race.date <= today);
const upcoming = withoutResults.filter((race) => race.date && race.date > today);
const undated = withoutResults.filter((race) => !race.date);

console.log(`races: ${races.length}`);
console.log(`results registered: ${withResults.length}`);
console.log(`missing past-or-today: ${past.length}`);
console.log(`upcoming/no-result-needed-yet: ${upcoming.length}`);
console.log(`undated: ${undated.length}`);
console.log("");
console.log(`next missing candidates (today=${today}, limit=${limit}):`);
for (const race of past.slice(0, limit)) {
  console.log(`- ${race.date} ${race.name} (${race.key}) ${race.horseCount}頭`);
}

function raceResultForSummary(race) {
  return results.races?.[race.key] || results.races?.[normalizedResultRaceKey(race)];
}

function normalizedResultRaceKey(race) {
  const year = String(race.key || "").split(":")[0] || String(race.date || "").slice(0, 4);
  return year && race.name ? `${year}:${normalizeResultRaceName(race.name)}` : "";
}

function normalizeResultRaceName(name = "") {
  const normalized = String(name).normalize("NFKC").replace(/\s+/g, "");
  const aliases = {
    "東京優駿": "日本ダービー",
    "優駿牝馬": "オークス",
    "天皇賞春": "天皇賞・春",
    "天皇賞秋": "天皇賞・秋",
    "マイルチャンピオンS": "マイルCS",
    "マイラーズカップ": "マイラーズC",
    "産経大阪杯": "大阪杯"
  };
  return aliases[normalized] || normalized;
}
if (upcoming.length) {
  console.log("");
  console.log("upcoming examples:");
  for (const race of upcoming.slice(0, Math.min(10, limit))) {
    console.log(`- ${race.date} ${race.name} (${race.key}) ${race.horseCount}頭`);
  }
}

async function loadResults() {
  try {
    return JSON.parse(await readFile(resultsPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { version: 1, races: {} };
  }
}

function raceSummaries(db) {
  const grouped = new Map();
  for (const photo of db.photos) {
    const key = photo.raceKey || [photo.raceDate || photo.photoDate || "", photo.raceName || ""].join(":");
    if (!key.trim()) continue;
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        name: photo.raceName || "レース名未設定",
        date: photo.raceDate || photo.photoDate || "",
        horseIds: new Set()
      });
    }
    grouped.get(key).horseIds.add(photo.horseId);
  }
  return [...grouped.values()]
    .map((race) => ({ ...race, horseCount: race.horseIds.size }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.name.localeCompare(b.name, "ja"));
}
