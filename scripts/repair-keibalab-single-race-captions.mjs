import { loadStore, saveStore } from "./lib/store.mjs";

const db = await loadStore();
let changed = 0;

for (const page of db.pages) {
  if (page.source !== "keibalab" || page.status !== "ok") continue;
  const titleRaceName = page.title?.match(/[【\[]([^】\]]+)/)?.[1] ?? "";
  if (!titleRaceName || isMultiRaceName(titleRaceName)) continue;

  for (const photo of db.photos) {
    if (photo.source !== "keibalab" || photo.sourceId !== page.sourceId) continue;
    if (photo.raceName === titleRaceName && photo.caption === [photo.photoDate || photo.issueDate, titleRaceName].filter(Boolean).join(" ")) continue;
    photo.raceName = titleRaceName;
    photo.caption = [photo.photoDate || photo.issueDate, titleRaceName].filter(Boolean).join(" ");
    changed += 1;
  }
}

await saveStore(db);
console.log(`updated ${changed} keibalab single-race captions`);

function isMultiRaceName(raceName = "") {
  return /[・／/、,]/.test(raceName);
}
