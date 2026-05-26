import { loadStore, saveStore } from "./lib/store.mjs";

const db = await loadStore();
let changed = 0;

for (const photo of db.photos) {
  const nextUrl = normalizeImageUrl(photo.imageUrl || "");
  if (nextUrl && nextUrl !== photo.imageUrl) {
    const oldUrl = photo.imageUrl;
    photo.imageUrl = nextUrl;
    if (photo.key?.includes(oldUrl)) photo.key = photo.key.replace(oldUrl, nextUrl);
    changed += 1;
  }
}

await saveStore(db);
console.log(`repaired image urls: ${changed}`);

function normalizeImageUrl(url) {
  return url.replace(/\.(jpe?g|png|webp|gif)\.\1(\?|$)/i, ".$1$2");
}
