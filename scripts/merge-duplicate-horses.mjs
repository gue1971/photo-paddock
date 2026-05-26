import { horseKey, loadStore, normalizeHorseIdentityPart, saveStore } from "./lib/store.mjs";

const db = await loadStore();
const photoCounts = new Map();
for (const photo of db.photos) {
  photoCounts.set(photo.horseId, (photoCounts.get(photo.horseId) ?? 0) + 1);
}

const byName = new Map();
for (const horse of db.horses) {
  const nameKey = normalizeHorseIdentityPart(horse.name);
  const group = byName.get(nameKey) ?? [];
  group.push(horse);
  byName.set(nameKey, group);
}

let mergedGroups = 0;
let removedHorses = 0;
const skipped = [];

for (const group of byName.values()) {
  if (group.length < 2) continue;
  if (!canMerge(group)) {
    skipped.push(group);
    continue;
  }

  const canonical = chooseCanonical(group);
  const duplicates = group.filter((horse) => horse.id !== canonical.id);
  for (const duplicate of duplicates) {
    for (const photo of db.photos) {
      if (photo.horseId === duplicate.id) photo.horseId = canonical.id;
    }
    fillMissing(canonical, duplicate);
  }
  canonical.key = horseKey(canonical);
  db.horses = db.horses.filter((horse) => !duplicates.some((duplicate) => duplicate.id === horse.id));
  mergedGroups += 1;
  removedHorses += duplicates.length;
}

for (const horse of db.horses) {
  horse.key = horseKey(horse);
}

await saveStore(db);

console.log(`merged groups: ${mergedGroups}`);
console.log(`removed horses: ${removedHorses}`);
console.log(`skipped duplicate-name groups: ${skipped.length}`);
for (const group of skipped.slice(0, 20)) {
  console.log(`skip: ${group[0].name}`);
  for (const horse of group) {
    console.log(`  ${horse.id} ${horse.birthYear ?? ""} ${horse.sire ?? ""} / ${horse.dam ?? ""} / ${horse.damsire ?? ""}`);
  }
}

function canMerge(group) {
  const birthYears = group.map((horse) => horse.birthYear).filter((year) => Number.isFinite(year));
  const birthSpan = birthYears.length > 0 ? Math.max(...birthYears) - Math.min(...birthYears) : 0;
  const pedigreeSignatures = new Set(group.map((horse) => pedigreeSignature(horse)).filter(Boolean));
  if (pedigreeSignatures.size <= 1) return true;
  return birthSpan <= 2;
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

function completenessScore(horse) {
  return ["birthYear", "sex", "sire", "dam", "damsire"].reduce((score, field) => {
    return score + (horse[field] === undefined || horse[field] === null || horse[field] === "" ? 0 : 1);
  }, 0);
}

function pedigreeSignature(horse) {
  const parts = [horse.sire, horse.dam, horse.damsire].map(normalizeHorseIdentityPart);
  if (parts.every((part) => part === "")) return "";
  return parts.join("|").toLowerCase();
}
