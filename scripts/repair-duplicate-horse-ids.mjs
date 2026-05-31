import { writeFile } from "node:fs/promises";
import path from "node:path";
import { loadStore, rootDir, saveStore } from "./lib/store.mjs";

const db = await loadStore();
const idCounts = new Map();
for (const horse of db.horses) idCounts.set(horse.id, (idCounts.get(horse.id) || 0) + 1);

const duplicateIds = new Set([...idCounts].filter(([, count]) => count > 1).map(([id]) => id));
const affectedPages = [...new Set(
  db.photos
    .filter((photo) => duplicateIds.has(photo.horseId))
    .map((photo) => `${photo.source}:${photo.sourceId}`)
)].sort();

const usedIds = new Set();
let nextNumber = db.horses.reduce((max, horse) => {
  const number = Number(String(horse.id || "").match(/^horse_(\d+)$/)?.[1] || 0);
  return Math.max(max, number);
}, 0) + 1;
let reassigned = 0;

for (const horse of db.horses) {
  if (!usedIds.has(horse.id)) {
    usedIds.add(horse.id);
    continue;
  }
  while (usedIds.has(`horse_${nextNumber}`)) nextNumber += 1;
  horse.id = `horse_${nextNumber}`;
  usedIds.add(horse.id);
  reassigned += 1;
}

const affectedPageSet = new Set(affectedPages);
const beforePhotos = db.photos.length;
db.photos = db.photos.filter((photo) => !affectedPageSet.has(`${photo.source}:${photo.sourceId}`));
db.pages = db.pages.filter((page) => !affectedPageSet.has(`${page.source}:${page.sourceId}`));
db.errors = (db.errors || []).filter((error) => !affectedPageSet.has(`${error.source}:${error.sourceId}`));

await saveStore(db);

const outputPath = path.join(rootDir, "data", "repair-duplicate-horse-pages.json");
await writeFile(outputPath, `${JSON.stringify({ affectedPages }, null, 2)}\n`);

console.log(`duplicate horse ids: ${duplicateIds.size}`);
console.log(`reassigned horses: ${reassigned}`);
console.log(`affected pages: ${affectedPages.length}`);
console.log(`removed photos: ${beforePhotos - db.photos.length}`);
console.log(`wrote ${path.relative(rootDir, outputPath)}`);
