import { loadStore } from "./lib/store.mjs";
import { loadRaceAliases, normalizeRaceName } from "./lib/races.mjs";

const db = await loadStore();
const raceAliases = await loadRaceAliases();
const horseIds = new Set(db.horses.map((horse) => horse.id));
const horseIdCounts = new Map();
const horseNameCounts = new Map();
const photoKeys = new Map();
const photoIds = new Map();
const problems = [];
const allowedDuplicateHorseNames = new Set([
  "ブラックタイド",
  "マイケルバローズ",
  "シンデレラボーイ"
]);

for (const horse of db.horses) {
  horseIdCounts.set(horse.id, (horseIdCounts.get(horse.id) || 0) + 1);
  horseNameCounts.set(horse.name, (horseNameCounts.get(horse.name) || 0) + 1);
}

for (const [id, count] of horseIdCounts) {
  if (count > 1) problems.push(`duplicate horse id x${count}: ${id}`);
}

for (const [name, count] of horseNameCounts) {
  if (allowedDuplicateHorseNames.has(name)) continue;
  if (count > 1) problems.push(`duplicate horse name x${count}: ${name}`);
}

for (const photo of db.photos) {
  if (!horseIds.has(photo.horseId)) {
    problems.push(`missing horse for photo ${photo.id}: ${photo.horseId}`);
  }
  if (!photo.imageUrl && !photo.localImagePath) {
    problems.push(`missing image for photo ${photo.id}`);
  }
  photoIds.set(photo.id, (photoIds.get(photo.id) || 0) + 1);
  photoKeys.set(photo.key, (photoKeys.get(photo.key) || 0) + 1);
  if (photo.source === "keibalab" && Number(photo.sourceOrder || 1) > 1) {
    problems.push(`keibalab comparison photo remains: ${photo.id}`);
  }
}

for (const [key, count] of photoKeys) {
  if (count > 1) problems.push(`duplicate photo key x${count}: ${key}`);
}

for (const [id, count] of photoIds) {
  if (count > 1) problems.push(`duplicate photo id x${count}: ${id}`);
}

for (const page of db.pages.filter((item) => item.source === "keibalab" && item.status === "ok")) {
  const titleRace = page.title?.match(/[【\[]([^】\]]+)/)?.[1] ?? "";
  const pagePhotos = db.photos.filter((photo) => photo.source === "keibalab" && photo.sourceId === page.sourceId);
  const races = [...new Set(pagePhotos.map((photo) => photo.raceName).filter(Boolean))];
  const normalizedTitleRace = normalizeRaceName(titleRace, raceAliases);
  if (normalizedTitleRace && !isMultiRaceName(normalizedTitleRace) && races.length === 1 && normalizeRaceName(races[0], raceAliases) !== normalizedTitleRace) {
    problems.push(`single-race mismatch keibalab/${page.sourceId}: title=${titleRace}, photos=${races.join("/")}`);
  }
  if (page.photos !== pagePhotos.length) {
    problems.push(`page photo count mismatch keibalab/${page.sourceId}: page=${page.photos}, actual=${pagePhotos.length}`);
  }
}

const bySource = countBy(db.photos, (photo) => photo.source);
const newYearOnlyHorses = newYearShiftOnlyHorses();
const okPages = db.pages.filter((page) => page.status === "ok");
const errorPages = db.pages.filter((page) => page.status === "error");
const knownMissingPages = errorPages.filter((page) => page.source === "keibalab" && /^404\b/.test(page.error || ""));
const keibalabOkIds = okPages
  .filter((page) => page.source === "keibalab")
  .map((page) => Number(page.sourceId))
  .sort((a, b) => a - b);
const knownMissingKeibalabIds = new Set(knownMissingPages.map((page) => Number(page.sourceId)));

console.log(`horses: ${db.horses.length}`);
console.log(`photos: ${db.photos.length} (${Object.entries(bySource).map(([source, count]) => `${source}=${count}`).join(", ")})`);
console.log(`new-year shifted-only horses: ${newYearOnlyHorses.length ? newYearOnlyHorses.join(", ") : "none"}`);
console.log(`pages ok: ${okPages.length}, errors: ${errorPages.length}`);
if (keibalabOkIds.length) {
  console.log(`keibalab ok range: ${keibalabOkIds[0]}-${keibalabOkIds.at(-1)} (${keibalabOkIds.length} pages)`);
  const gaps = [];
  for (let id = keibalabOkIds[0]; id <= keibalabOkIds.at(-1); id += 1) {
    if (!keibalabOkIds.includes(id) && !knownMissingKeibalabIds.has(id)) gaps.push(id);
  }
  console.log(`keibalab gaps inside range: ${gaps.length ? gaps.join(", ") : "none"}`);
  const missingInsideRange = [...knownMissingKeibalabIds].filter((id) => id >= keibalabOkIds[0] && id <= keibalabOkIds.at(-1)).sort((a, b) => a - b);
  console.log(`keibalab known 404 inside range: ${missingInsideRange.length ? missingInsideRange.join(", ") : "none"}`);
}
if (errorPages.length) {
  console.log("error pages:");
  for (const page of errorPages.slice(-20)) {
    console.log(`- ${page.source}/${page.sourceId}: ${page.error}`);
  }
}

if (problems.length) {
  console.log("\nproblems:");
  for (const problem of problems) console.log(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log("\nproblems: none");
}

function countBy(items, keyFn) {
  return items.reduce((result, item) => {
    const key = keyFn(item) || "unknown";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function isMultiRaceName(raceName = "") {
  if (/^天皇賞・[春秋]$/.test(raceName.trim())) return false;
  return /[・／/、,]/.test(raceName);
}

function newYearShiftOnlyHorses() {
  const byHorse = new Map();
  for (const photo of db.photos) {
    const issueYear = Number((photo.issueDate || photo.publishedDate || "").slice(0, 4));
    const raceYear = Number((photo.raceDate || "").slice(0, 4));
    if (!issueYear || !raceYear) continue;
    const items = byHorse.get(photo.horseId) || [];
    items.push({
      photo,
      shifted: raceYear === issueYear + 1 && /^01-0[1-6]$/.test((photo.raceDate || "").slice(5)) && /金杯/.test(photo.raceName || photo.caption || "")
    });
    byHorse.set(photo.horseId, items);
  }

  const horses = new Map(db.horses.map((horse) => [horse.id, horse]));
  return [...byHorse]
    .filter(([, items]) => items.length > 0 && items.every((item) => item.shifted))
    .map(([horseId, items]) => {
      const horse = horses.get(horseId);
      const races = items.map(({ photo }) => `${photo.raceDate} ${photo.raceName}`).join("/");
      return `${horse?.name || horseId}(${horse?.birthYear || "生年不明"}: ${races})`;
    })
    .sort((a, b) => a.localeCompare(b, "ja"));
}
