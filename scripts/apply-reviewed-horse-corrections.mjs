import { horseKey, loadStore, saveStore } from "./lib/store.mjs";

const corrections = [
  {
    name: "ビハインドザマスク",
    birthYear: 1996,
    sire: "ホワイトマズル",
    dam: "ヴァインゴールド",
    damsire: "Mr. Prospector"
  }
];

const db = await loadStore();
let changed = 0;

changed += reassignPhotoHorse({
  source: "keibabook",
  sourceId: "040426",
  sourceOrder: 13,
  fromName: "ブラックタイド",
  toName: "クーリンガー"
});

for (const correction of corrections) {
  const horses = db.horses.filter((horse) => horse.name === correction.name);
  if (horses.length !== 1) continue;
  const horse = horses[0];
  for (const field of ["birthYear", "sire", "dam", "damsire"]) {
    if (horse[field] === correction[field]) continue;
    horse[field] = correction[field];
    changed += 1;
  }
  horse.key = horseKey(horse);
}

await saveStore(db);

console.log(`reviewed horse corrections: ${changed}`);

function reassignPhotoHorse({ source, sourceId, sourceOrder, fromName, toName }) {
  const photo = db.photos.find((item) => item.source === source && item.sourceId === sourceId && Number(item.sourceOrder) === sourceOrder);
  if (!photo) return 0;
  const current = db.horses.find((horse) => horse.id === photo.horseId);
  if (current?.name !== fromName) return 0;
  const target = db.horses.find((horse) => horse.name === toName && horse.sire === current.sire && horse.dam === current.dam)
    ?? db.horses.find((horse) => horse.name === toName);
  if (!target) return 0;
  photo.horseId = target.id;
  photo.key = [photo.horseId, photo.source, photo.sourceId, photo.imageUrl || photo.caption || photo.sourcePageUrl].join("|");
  return 1;
}
