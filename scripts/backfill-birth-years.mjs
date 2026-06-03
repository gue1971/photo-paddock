import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, horseKey, loadStore, normalizeHorseIdentityPart, saveStore } from "./lib/store.mjs";

const db = await loadStore();
const byIdentity = new Map();
const photoCounts = new Map();
const firstPhoto = new Map();

for (const photo of db.photos) {
  photoCounts.set(photo.horseId, (photoCounts.get(photo.horseId) ?? 0) + 1);
  const date = photo.raceDate || photo.photoDate || photo.issueDate || "";
  const current = firstPhoto.get(photo.horseId);
  if (!current || date > current.date) {
    firstPhoto.set(photo.horseId, {
      date,
      raceName: photo.raceName || "",
      caption: photo.caption || ""
    });
  }
}

for (const horse of db.horses) {
  const identity = identityKey(horse);
  if (!identity) continue;
  const group = byIdentity.get(identity) ?? [];
  group.push(horse);
  byIdentity.set(identity, group);
}

let backfilled = 0;
let merged = 0;

for (const group of byIdentity.values()) {
  const knownYears = [...new Set(group.map((horse) => horse.birthYear).filter((year) => Number.isFinite(year)))];
  if (knownYears.length !== 1) continue;
  const birthYear = knownYears[0];
  for (const horse of group) {
    if (horse.birthYear !== undefined && horse.birthYear !== null) continue;
    horse.birthYear = birthYear;
    horse.key = horseKey(horse);
    backfilled += 1;
  }
  merged += mergeExactIdentityGroup(group, birthYear);
}

for (const horse of db.horses) {
  horse.key = horseKey(horse);
}

const unknowns = db.horses
  .filter((horse) => horse.birthYear === undefined || horse.birthYear === null)
  .map((horse) => ({
    id: horse.id,
    name: horse.name,
    sire: horse.sire || "",
    dam: horse.dam || "",
    damsire: horse.damsire || "",
    photos: photoCounts.get(horse.id) ?? 0,
    latestPhoto: firstPhoto.get(horse.id) ?? null
  }))
  .sort((a, b) => {
    const dateDiff = (b.latestPhoto?.date || "").localeCompare(a.latestPhoto?.date || "");
    if (dateDiff !== 0) return dateDiff;
    return a.name.localeCompare(b.name, "ja");
  });

await saveStore(db);
await mkdir(dataDir, { recursive: true });
await writeFile(path.join(dataDir, "birth-year-unknowns.json"), `${JSON.stringify(unknowns, null, 2)}\n`);

console.log(`backfilled birth years: ${backfilled}`);
console.log(`merged horses: ${merged}`);
console.log(`remaining unknown horses: ${unknowns.length}`);

function mergeExactIdentityGroup(group, birthYear) {
  const sameYear = group.filter((horse) => horse.birthYear === birthYear);
  if (sameYear.length < 2) return 0;
  const canonical = chooseCanonical(sameYear);
  const duplicates = sameYear.filter((horse) => horse.id !== canonical.id);
  for (const duplicate of duplicates) {
    for (const photo of db.photos) {
      if (photo.horseId === duplicate.id) photo.horseId = canonical.id;
    }
    fillMissing(canonical, duplicate);
    mergeBodyTags(canonical, duplicate);
  }
  db.horses = db.horses.filter((horse) => !duplicates.some((duplicate) => duplicate.id === horse.id));
  canonical.key = horseKey(canonical);
  return duplicates.length;
}

function chooseCanonical(group) {
  return [...group].sort((a, b) => {
    const photoDiff = (photoCounts.get(b.id) ?? 0) - (photoCounts.get(a.id) ?? 0);
    if (photoDiff !== 0) return photoDiff;
    const completeDiff = completenessScore(b) - completenessScore(a);
    if (completeDiff !== 0) return completeDiff;
    return String(a.id).localeCompare(String(b.id), "en", { numeric: true });
  })[0];
}

function fillMissing(target, source) {
  for (const field of ["birthYear", "sex", "sire", "dam", "damsire", "notes"]) {
    if (target[field] === undefined || target[field] === null || target[field] === "") {
      target[field] = source[field] ?? target[field];
    }
  }
}

function mergeBodyTags(target, source) {
  if (!Array.isArray(source.bodyTags) || source.bodyTags.length === 0) return;
  if (!Array.isArray(target.bodyTags)) target.bodyTags = [];
  const byTag = new Map(target.bodyTags.map((item) => [item.tag, item]));
  for (const incoming of source.bodyTags) {
    const current = byTag.get(incoming.tag);
    if (!current) {
      target.bodyTags.push(incoming);
      byTag.set(incoming.tag, incoming);
      continue;
    }
    current.confidence = current.confidence === "confirmed" || incoming.confidence === "confirmed" ? "confirmed" : current.confidence;
    current.evidence = [...(current.evidence || []), ...(incoming.evidence || [])];
    current.evidenceCount = current.evidence.length || Math.max(current.evidenceCount || 0, incoming.evidenceCount || 0);
  }
}

function completenessScore(horse) {
  return ["birthYear", "sex", "sire", "dam", "damsire"].reduce((score, field) => {
    return score + (horse[field] === undefined || horse[field] === null || horse[field] === "" ? 0 : 1);
  }, 0);
}

function identityKey(horse) {
  const parts = [horse.name, horse.sire, horse.dam].map(normalizeHorseIdentityPart);
  if (parts.some((part) => part === "")) return "";
  return parts.join("|").toLowerCase();
}
