import { loadStore, saveStore } from "./lib/store.mjs";

const db = await loadStore();
const referencedHorseIds = new Set(db.photos.map((photo) => photo.horseId));
const before = db.horses.length;
db.horses = db.horses.filter((horse) => referencedHorseIds.has(horse.id));
await saveStore(db);
console.log(`removed ${before - db.horses.length} orphan horses`);
