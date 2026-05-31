import { loadStore, saveStore } from "./lib/store.mjs";
import { inferRaceDate, loadRaceAliases, loadRaceDateOverrides, normalizeRaceName, raceKey, raceYearFromDate } from "./lib/races.mjs";

const db = await loadStore();
const aliases = await loadRaceAliases();
const overrides = await loadRaceDateOverrides();
const pages = new Map(db.pages.map((page) => [`${page.source}:${page.sourceId}`, page]));
const missingRaceNames = [];
const inferredKeys = new Set();
let changed = 0;

for (const photo of db.photos) {
  const publishedDate = photo.publishedDate || photo.photoDate || photo.issueDate || "";
  const page = pages.get(`${photo.source}:${photo.sourceId}`);
  const rawRaceName = photo.raceName || inferRaceNameFromText(page?.title || "", aliases);
  const normalizedRaceName = normalizeRaceName(resolveAmbiguousRaceName(rawRaceName, photo.issueDate || publishedDate), aliases);
  const year = photo.source === "keibabook" && photo.issueDate
    ? raceYearFromDate(photo.issueDate)
    : raceYearFromDate(publishedDate);
  const { key, override } = resolveRaceDateOverride(year, publishedDate, normalizedRaceName, overrides, photo.source);
  const raceDate = override || inferRaceDate(publishedDate);
  const next = {
    ...photo,
    publishedDate,
    raceName: normalizedRaceName || photo.raceName || "",
    raceKey: key,
    raceDate,
    raceDateSource: override ? "override" : "inferred-next-sunday",
    photoDate: raceDate || photo.photoDate || "",
    caption: [raceDate || publishedDate, normalizedRaceName || photo.raceName].filter(Boolean).join(" ") || photo.caption
  };

  if (!normalizedRaceName) missingRaceNames.push(photo.id);
  if (key && !override) inferredKeys.add(key);

  if (JSON.stringify(next) !== JSON.stringify(photo)) {
    Object.assign(photo, next);
    changed += 1;
  }
}

await saveStore(db);

console.log(`annotated photos: ${changed}`);
console.log(`missing race name: ${missingRaceNames.length}`);
console.log(`inferred race dates: ${inferredKeys.size} race keys`);
if (missingRaceNames.length) {
  console.log(`missing sample: ${missingRaceNames.slice(0, 20).join(", ")}`);
}

function inferRaceNameFromText(text, aliases) {
  const candidates = [...new Set([...Object.keys(aliases), ...Object.values(aliases)])]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  return candidates.find((candidate) => text.includes(candidate)) || "";
}

function resolveAmbiguousRaceName(name, contextDate) {
  const cleaned = String(name || "").normalize("NFKC").replace(/\s+/g, "");
  if (!["天皇賞", "天皇賞・春", "天皇賞(春)"].includes(cleaned)) return name;
  const month = Number(String(contextDate || "").slice(5, 7));
  return month >= 8 ? "天皇賞・秋" : "天皇賞・春";
}

function resolveRaceDateOverride(year, publishedDate, raceName, overrides, source = "") {
  const currentYearKey = raceKey(year, raceName);
  if (source === "keibabook") return { key: currentYearKey || "", override: overrides[currentYearKey] || "" };
  const nextYearKey = raceKey(year + 1, raceName);
  const candidates = [currentYearKey, nextYearKey]
    .filter((item) => item && overrides[item])
    .sort((a, b) => {
      const aDate = overrides[a];
      const bDate = overrides[b];
      const aFuture = !publishedDate || aDate >= publishedDate;
      const bFuture = !publishedDate || bDate >= publishedDate;
      if (aFuture !== bFuture) return aFuture ? -1 : 1;
      if (aFuture && bFuture) return aDate.localeCompare(bDate);
      return bDate.localeCompare(aDate);
    });
  const key = candidates[0] || currentYearKey || "";
  return { key, override: overrides[key] || "" };
}
