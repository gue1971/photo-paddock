import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const dataDir = path.join(rootDir, "data");
export const dbPath = path.join(dataDir, "photo-paddock.json");

export async function loadStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    const raw = await readFile(dbPath, "utf8");
    const db = JSON.parse(raw);
    return {
      version: 1,
      horses: [],
      photos: [],
      pages: [],
      errors: [],
      ...db
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { version: 1, horses: [], photos: [], pages: [], errors: [] };
  }
}

export async function saveStore(db) {
  await mkdir(dataDir, { recursive: true });
  const sorted = {
    version: 1,
    horses: [...db.horses].sort((a, b) => (b.birthYear ?? 0) - (a.birthYear ?? 0) || a.name.localeCompare(b.name, "ja")),
    photos: [...db.photos].sort((a, b) => (b.photoDate || b.issueDate || "").localeCompare(a.photoDate || a.issueDate || "") || a.horseId.localeCompare(b.horseId)),
    pages: [...db.pages].sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt)),
    errors: [...db.errors].slice(-1000)
  };
  await writeFile(dbPath, `${JSON.stringify(sorted, null, 2)}\n`);
}

export function upsertHorse(db, horse) {
  const key = horseKey(horse);
  let existing = db.horses.find((item) => item.key === key);
  if (!existing) {
    existing = {
      id: `horse_${db.horses.length + 1}`,
      key,
      name: horse.name,
      birthYear: horse.birthYear ?? null,
      sex: horse.sex ?? "",
      sire: horse.sire ?? "",
      dam: horse.dam ?? "",
      damsire: horse.damsire ?? "",
      notes: ""
    };
    db.horses.push(existing);
  } else {
    Object.assign(existing, compact({
      birthYear: horse.birthYear,
      sex: horse.sex,
      sire: horse.sire,
      dam: horse.dam,
      damsire: horse.damsire
    }));
  }
  return existing;
}

export function upsertPhoto(db, photo) {
  const key = photoKey(photo);
  const existing = db.photos.find((item) => item.key === key);
  if (existing) {
    Object.assign(existing, compact(photo), { key });
    return existing;
  }
  const created = {
    id: `photo_${db.photos.length + 1}`,
    key,
    ...photo
  };
  db.photos.push(created);
  return created;
}

export function markPage(db, page) {
  const key = `${page.source}:${page.sourceId}`;
  const existing = db.pages.find((item) => item.key === key);
  const payload = { key, ...page };
  if (existing) Object.assign(existing, payload);
  else db.pages.push(payload);
}

export function addError(db, error) {
  db.errors.push({
    at: new Date().toISOString(),
    ...error
  });
}

export function isPageImported(db, source, sourceId) {
  return db.pages.some((page) => page.key === `${source}:${sourceId}` && page.status === "ok");
}

export function horseKey(horse) {
  return [
    normalizeHorseIdentityPart(horse.name),
    horse.birthYear ?? "",
    normalizeHorseIdentityPart(horse.sire),
    normalizeHorseIdentityPart(horse.dam)
  ].join("|");
}

export function normalizeHorseIdentityPart(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, "")
    .trim();
}

function photoKey(photo) {
  return [
    photo.horseId,
    photo.source,
    photo.sourceId,
    photo.imageUrl || photo.caption || photo.sourcePageUrl
  ].join("|");
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""));
}
