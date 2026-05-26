import { loadStore, saveStore } from "./lib/store.mjs";

const db = await loadStore();
let changed = 0;

db.photos.forEach((photo, index) => {
  const nextId = `photo_${index + 1}`;
  if (photo.id !== nextId) {
    photo.id = nextId;
    changed += 1;
  }
});

await saveStore(db);
console.log(`renumbered photos: ${changed}`);
