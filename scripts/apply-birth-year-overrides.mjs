import { readFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, horseKey, loadStore, saveStore } from "./lib/store.mjs";

const overridesPath = path.join(dataDir, "horse-birth-year-overrides.json");
const overrides = JSON.parse(await readFile(overridesPath, "utf8"));
const db = await loadStore();

let changed = 0;
let missing = 0;

for (const [horseId, override] of Object.entries(overrides)) {
  const horse = db.horses.find((item) => item.id === horseId);
  if (!horse) {
    missing += 1;
    continue;
  }
  if (horse.birthYear === override.birthYear) continue;
  horse.birthYear = override.birthYear;
  horse.key = horseKey(horse);
  changed += 1;
}

await saveStore(db);

console.log(`birth-year overrides applied: ${changed}`);
console.log(`missing horses in overrides: ${missing}`);
