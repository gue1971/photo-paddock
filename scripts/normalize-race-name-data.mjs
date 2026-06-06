import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./lib/store.mjs";
import { loadRaceAliases, normalizeRaceName, raceKey } from "./lib/races.mjs";

const aliases = await loadRaceAliases();
const overridesPath = path.join(dataDir, "race-date-overrides.json");
const resultsPath = path.join(dataDir, "race-results.json");

const overrideStats = await normalizeRaceDateOverrides();
const resultStats = await normalizeRaceResults();

console.log(`race-date overrides renamed: ${overrideStats.renamed}, conflicts: ${overrideStats.conflicts}`);
console.log(`race-results renamed: ${resultStats.renamed}, merged: ${resultStats.merged}`);

async function normalizeRaceDateOverrides() {
  const overrides = JSON.parse(await readFile(overridesPath, "utf8"));
  const normalized = {};
  let renamed = 0;
  let conflicts = 0;

  for (const [key, date] of Object.entries(overrides)) {
    const nextKey = normalizeRaceKey(key);
    if (nextKey !== key) renamed += 1;
    if (normalized[nextKey] && normalized[nextKey] !== date) conflicts += 1;
    normalized[nextKey] ||= date;
  }

  await writeFile(overridesPath, `${JSON.stringify(sortObject(normalized), null, 2)}\n`);
  return { renamed, conflicts };
}

async function normalizeRaceResults() {
  const results = JSON.parse(await readFile(resultsPath, "utf8"));
  const races = {};
  let renamed = 0;
  let merged = 0;

  for (const [key, race] of Object.entries(results.races || {})) {
    const nextKey = normalizeRaceKey(key);
    const [, nextName = race.name] = nextKey.split(":");
    if (nextKey !== key || nextName !== race.name) renamed += 1;
    if (races[nextKey]) merged += 1;
    races[nextKey] = mergeRaceResult(races[nextKey], { ...race, name: nextName });
  }

  await writeFile(resultsPath, `${JSON.stringify({ ...results, races: sortObject(races) }, null, 2)}\n`);
  return { renamed, merged };
}

function normalizeRaceKey(key) {
  const [year, ...raceNameParts] = String(key).split(":");
  const raceName = normalizeRaceName(raceNameParts.join(":"), aliases);
  return raceKey(year, raceName) || key;
}

function mergeRaceResult(current, next) {
  if (!current) return {
    ...next,
    sourceRaceNames: unique(next.sourceRaceNames || []),
    entries: next.entries || {},
    entriesByHorseId: next.entriesByHorseId || undefined
  };
  return {
    ...current,
    date: current.date || next.date,
    name: current.name || next.name,
    source: current.source || next.source,
    grade: current.grade || next.grade,
    sourceRaceNames: unique([...(current.sourceRaceNames || []), ...(next.sourceRaceNames || [])]),
    entries: { ...(current.entries || {}), ...(next.entries || {}) },
    entriesByHorseId: current.entriesByHorseId || next.entriesByHorseId
      ? { ...(current.entriesByHorseId || {}), ...(next.entriesByHorseId || {}) }
      : undefined
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sortObject(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => b.localeCompare(a, "ja")));
}
