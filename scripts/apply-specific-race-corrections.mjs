import { loadStore, saveStore } from "./lib/store.mjs";
import { loadRaceDateOverrides, raceKey } from "./lib/races.mjs";

const db = await loadStore();
const overrides = await loadRaceDateOverrides();
const horses = new Map(db.horses.map((horse) => [horse.id, horse]));

const corrections = [
  { sourceId: "531", horseName: "ロンドンプラン", raceName: "小倉2歳S" },
  { sourceId: "531", horseName: "プロトポロス", raceName: "小倉2歳S" },
  { sourceId: "531", horseName: "ダイヤモンドハンズ", raceName: "札幌2歳S" },
  { sourceId: "687", birthYear: 2023, raceName: "中京2歳S" }
];

let changed = 0;

for (const correction of corrections) {
  const photos = db.photos.filter((item) => {
    const horse = horses.get(item.horseId);
    if (item.source !== "keibalab" || item.sourceId !== correction.sourceId) return false;
    if (correction.horseName && horse?.name !== correction.horseName) return false;
    if (correction.birthYear && horse?.birthYear !== correction.birthYear) return false;
    return true;
  });
  if (!photos.length) {
    console.log(`missing: focus/${correction.sourceId} ${correction.horseName || `${correction.birthYear}年産駒`}`);
    continue;
  }

  const year = Number(photos[0].publishedDate?.slice(0, 4) || photos[0].raceDate?.slice(0, 4));
  const key = raceKey(year, correction.raceName);
  const raceDate = overrides[key];
  if (!raceDate) {
    console.log(`missing date override: ${key}`);
    continue;
  }

  for (const photo of photos) {
    Object.assign(photo, {
      raceName: correction.raceName,
      raceKey: key,
      raceDate,
      raceDateSource: "override",
      photoDate: raceDate,
      caption: `${raceDate} ${correction.raceName}`
    });
    changed += 1;
  }
}

await saveStore(db);
console.log(`specific corrections: ${changed}`);
