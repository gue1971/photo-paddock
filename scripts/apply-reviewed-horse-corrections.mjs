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
