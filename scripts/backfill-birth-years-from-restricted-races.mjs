import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, horseKey, loadStore, saveStore } from "./lib/store.mjs";

const db = await loadStore();
const photosByHorse = new Map();

const twoYearOldRaces = new Set([
  "朝日杯FS",
  "阪神ジュベナイルF",
  "小倉2歳S",
  "新潟2歳S",
  "函館2歳S",
  "札幌2歳S",
  "ファンタジーS"
]);

const threeYearOldRaces = new Set([
  "皐月賞",
  "桜花賞",
  "日本ダービー",
  "オークス",
  "優駿牝馬",
  "菊花賞",
  "秋華賞",
  "NHKマイルカップ",
  "神戸新聞杯",
  "セントライト記念",
  "ローズS",
  "フィリーズレビュー",
  "チューリップ賞",
  "弥生賞",
  "スプリングS",
  "共同通信杯",
  "きさらぎ賞",
  "京成杯",
  "シンザン記念",
  "フローラS",
  "ファルコンS",
  "クリスタルC",
  "アーリントンC",
  "ラジオNIKKEI賞",
  "青葉賞",
  "ユニコーンS"
]);

for (const photo of db.photos) {
  if (!photo.horseId) continue;
  const group = photosByHorse.get(photo.horseId) ?? [];
  group.push(photo);
  photosByHorse.set(photo.horseId, group);
}

let updated = 0;
const reviewed = [];
const conflicts = [];

for (const horse of db.horses) {
  if (horse.birthYear !== undefined && horse.birthYear !== null) continue;
  const photos = photosByHorse.get(horse.id) ?? [];
  const candidates = [];
  for (const photo of photos) {
    const age = restrictedAge(photo);
    const year = Number(String(photo.raceDate || photo.photoDate || photo.issueDate || "").slice(0, 4));
    if (!age || !year) continue;
    candidates.push({
      birthYear: year - age,
      age,
      raceName: photo.raceName || "",
      raceDate: photo.raceDate || photo.photoDate || photo.issueDate || "",
      photoId: photo.id
    });
  }
  const years = [...new Set(candidates.map((candidate) => candidate.birthYear))];
  if (years.length === 0) continue;
  if (years.length > 1) {
    conflicts.push({
      horseId: horse.id,
      name: horse.name,
      candidates
    });
    continue;
  }
  horse.birthYear = years[0];
  horse.key = horseKey(horse);
  updated += 1;
  reviewed.push({
    horseId: horse.id,
    name: horse.name,
    birthYear: horse.birthYear,
    evidence: candidates
  });
}

await saveStore(db);
await mkdir(dataDir, { recursive: true });
await writeFile(path.join(dataDir, "birth-year-restricted-race-backfill.json"), `${JSON.stringify({ updated: reviewed, conflicts }, null, 2)}\n`);

console.log(`restricted-race birth years: ${updated}`);
console.log(`conflicts: ${conflicts.length}`);

function restrictedAge(photo) {
  const raceName = normalizeName(photo.raceName || "");
  const raceDate = photo.raceDate || photo.photoDate || "";
  if (!raceName || !raceDate) return null;
  const month = Number(raceDate.slice(5, 7));

  if (twoYearOldRaces.has(raceName)) return 2;
  if (threeYearOldRaces.has(raceName)) return 3;
  if (raceName === "フェアリーS") return month === 12 ? 2 : 3;
  return null;
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/^[■◆]+/, "")
    .replace(/\s+/g, "")
    .replace(/ステークス$/, "S")
    .replace(/^ダービー$/, "日本ダービー")
    .replace(/^オークス$/, "オークス")
    .replace(/^NHKマイルC$/, "NHKマイルカップ")
    .replace(/^阪神ジュべナイルフィリーズ$/, "阪神ジュベナイルF")
    .replace(/^阪神ジュベナイルフィリーズ$/, "阪神ジュベナイルF")
    .replace(/^ラジオたんぱ賞$/, "ラジオNIKKEI賞")
    .trim();
}
