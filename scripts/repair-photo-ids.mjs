import { loadStore, saveStore } from "./lib/store.mjs";

const db = await loadStore();
const usedIds = new Set();
let nextNumber = db.photos.reduce((max, photo) => {
  const number = Number(String(photo.id || "").match(/^photo_(\d+)$/)?.[1] || 0);
  return Math.max(max, number);
}, 0) + 1;
let reassigned = 0;

for (const photo of db.photos) {
  if (!usedIds.has(photo.id)) {
    usedIds.add(photo.id);
    continue;
  }
  while (usedIds.has(`photo_${nextNumber}`)) nextNumber += 1;
  photo.id = `photo_${nextNumber}`;
  usedIds.add(photo.id);
  reassigned += 1;
}

await saveStore(db);

console.log(`reassigned photos: ${reassigned}`);
