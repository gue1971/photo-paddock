import { horseKey, loadStore, saveStore } from "./lib/store.mjs";

const corrections = [
  {
    name: "ミトラ",
    birthYear: 2008,
    sire: "シンボリクリスエス",
    dam: "エイグレット",
    damsire: "サンデーサイレンス"
  },
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

changed += mergeDuplicateKeibabookPhotos();
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

function mergeDuplicateKeibabookPhotos() {
  const groups = new Map();
  for (const photo of db.photos.filter((item) => item.source === "keibabook")) {
    const key = [photo.source, photo.sourceId, photo.sourceOrder].join("|");
    const group = groups.get(key) ?? [];
    group.push(photo);
    groups.set(key, group);
  }

  let removed = 0;
  const removeIds = new Set();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const canonical = [...group].sort((a, b) => photoCompletenessScore(b) - photoCompletenessScore(a))[0];
    for (const duplicate of group) {
      if (duplicate.id === canonical.id) continue;
      mergePhotoFields(canonical, duplicate);
      removeIds.add(duplicate.id);
      removed += 1;
    }
    canonical.key = [canonical.horseId, canonical.source, canonical.sourceId, canonical.imageUrl || canonical.caption || canonical.sourcePageUrl].join("|");
  }
  if (removeIds.size) db.photos = db.photos.filter((photo) => !removeIds.has(photo.id));
  return removed;
}

function photoCompletenessScore(photo) {
  return [
    photo.raceDate,
    photo.raceKey,
    photo.localImagePath,
    photo.comment,
    photo.caption,
    photo.photoDate
  ].reduce((score, value) => score + (value ? 1 : 0), 0);
}

function mergePhotoFields(target, source) {
  for (const field of ["raceDate", "raceDateSource", "raceKey", "raceName", "photoDate", "issueDate", "localImagePath", "comment", "caption", "sourcePageUrl", "imageUrl"]) {
    if (target[field] === undefined || target[field] === null || target[field] === "") {
      target[field] = source[field] ?? target[field];
    }
  }
}

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
