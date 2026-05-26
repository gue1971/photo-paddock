import { loadStore, saveStore } from "./lib/store.mjs";

const db = await loadStore();
const before = db.photos.length;
db.photos = db.photos.filter((photo) => photo.source !== "keibalab" || Number(photo.sourceOrder || 1) === 1);

for (const page of db.pages) {
  if (page.source !== "keibalab" || page.status !== "ok") continue;
  const count = db.photos.filter((photo) => photo.source === "keibalab" && photo.sourceId === page.sourceId).length;
  page.photos = count;
}

await saveStore(db);
console.log(`removed ${before - db.photos.length} keibalab comparison photos`);
console.log(`remaining photos ${db.photos.length}`);
