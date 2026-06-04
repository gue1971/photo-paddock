import { horseKey, loadStore, normalizeHorseIdentityPart, saveStore } from "./lib/store.mjs";

const reviewedNameOnlyMerges = new Set([
  "アジアエクスプレス",
  "アフォード",
  "アルビアーノ",
  "エイシンブルズアイ",
  "エキストラエンド",
  "カレンミロティック",
  "カイトヒルウインド",
  "カフェオリンポス",
  "キャンベルジュニア",
  "キタサンチャンネル",
  "グラスエイコウオー",
  "ゴールドティアラ",
  "ゴスホークケン",
  "コンゴウリキシオー",
  "コイントス",
  "サンヴァレー",
  "サンライズマックス",
  "サトノクラウン",
  "ジェミードレス",
  "スーニ",
  "スティンガー",
  "スパークホーク",
  "ダイワファルコン",
  "ダッシングブレイズ",
  "ダイタクリーヴァ",
  "ダイヤモンドビコー",
  "ダービーレグノ",
  "ダノンメジャー",
  "トウカイオーザ",
  "トウカイポイント",
  "トゥザヴィクトリー",
  "トシザブイ",
  "トラストファイヤー",
  "トロットスター",
  "ノボジャック",
  "ノボトゥルー",
  "フラアンジェリコ",
  "フルーキー",
  "フレイムヘイロー",
  "ベストウォーリア",
  "ビハインドザマスク",
  "ブリリアントロード",
  "ブルーリッジリバー",
  "マイネルブライアン",
  "マイネルミラノ",
  "マチカネキンノホシ",
  "マヤノライジン",
  "マンボツイスト",
  "メジロマイヤー",
  "ヤマカツスズラン",
  "ヤマニンセラフィム",
  "リージェントブラフ",
  "リキアイタイカン",
  "レインダンス",
  "ローマンエンパイア",
  "アグネスソニック",
  "イーグルカフェ",
  "エアトゥーレ",
  "オースミエルスト",
  "ワンアンドオンリー"
].map(normalizeHorseIdentityPart));

const db = await loadStore();
const photoCounts = new Map();
const reliablePhotoCounts = new Map();
for (const photo of db.photos) {
  photoCounts.set(photo.horseId, (photoCounts.get(photo.horseId) ?? 0) + 1);
  if (!isLikelyNewYearIssueAgeShift(photo)) {
    reliablePhotoCounts.set(photo.horseId, (reliablePhotoCounts.get(photo.horseId) ?? 0) + 1);
  }
}

const byName = new Map();
for (const horse of db.horses) {
  const nameKey = normalizeHorseIdentityPart(horse.name);
  const group = byName.get(nameKey) ?? [];
  group.push(horse);
  byName.set(nameKey, group);
}

let mergedGroups = 0;
let removedHorses = 0;
const skipped = [];

for (const group of byName.values()) {
  if (group.length < 2) continue;
  const nameKey = normalizeHorseIdentityPart(group[0].name);
  if (reviewedNameOnlyMerges.has(nameKey)) {
    mergeGroup(group);
    continue;
  }

  const byPedigree = new Map();
  for (const horse of group) {
    const signature = pedigreeSignature(horse);
    const subgroup = byPedigree.get(signature) ?? [];
    subgroup.push(horse);
    byPedigree.set(signature, subgroup);
  }

  let mergedAny = false;
  for (const subgroup of byPedigree.values()) {
    if (subgroup.length < 2 || !canMerge(subgroup)) continue;
    mergeGroup(subgroup);
    mergedAny = true;
  }
  if (!mergedAny) skipped.push(group);
}

for (const horse of db.horses) {
  horse.key = horseKey(horse);
}

await saveStore(db);

console.log(`merged groups: ${mergedGroups}`);
console.log(`removed horses: ${removedHorses}`);
console.log(`skipped duplicate-name groups: ${skipped.length}`);
for (const group of skipped.slice(0, 20)) {
  console.log(`skip: ${group[0].name}`);
  for (const horse of group) {
    console.log(`  ${horse.id} ${horse.birthYear ?? ""} ${horse.sire ?? ""} / ${horse.dam ?? ""} / ${horse.damsire ?? ""}`);
  }
}

function canMerge(group) {
  const birthYears = group.map((horse) => horse.birthYear).filter((year) => Number.isFinite(year));
  const birthSpan = birthYears.length > 0 ? Math.max(...birthYears) - Math.min(...birthYears) : 0;
  const pedigreeSignatures = new Set(group.map((horse) => pedigreeSignature(horse)).filter(Boolean));
  return pedigreeSignatures.size === 1 && birthSpan <= 2;
}

function mergeGroup(group) {
  const canonical = chooseCanonical(group);
  const duplicates = group.filter((horse) => horse.id !== canonical.id);
  for (const duplicate of duplicates) {
    for (const photo of db.photos) {
      if (photo.horseId === duplicate.id) photo.horseId = canonical.id;
    }
    fillMissing(canonical, duplicate);
    mergeBodyTags(canonical, duplicate);
  }
  canonical.key = horseKey(canonical);
  db.horses = db.horses.filter((horse) => !duplicates.some((duplicate) => duplicate.id === horse.id));
  mergedGroups += 1;
  removedHorses += duplicates.length;
}

function chooseCanonical(group) {
  return [...group].sort((a, b) => {
    const reliableDiff = (reliablePhotoCounts.get(b.id) ?? 0) - (reliablePhotoCounts.get(a.id) ?? 0);
    if (reliableDiff !== 0) return reliableDiff;
    const photoDiff = (photoCounts.get(b.id) ?? 0) - (photoCounts.get(a.id) ?? 0);
    if (photoDiff !== 0) return photoDiff;
    const completeDiff = completenessScore(b) - completenessScore(a);
    if (completeDiff !== 0) return completeDiff;
    const yearDiff = (b.birthYear ?? 0) - (a.birthYear ?? 0);
    if (yearDiff !== 0) return yearDiff;
    return String(a.id).localeCompare(String(b.id), "en", { numeric: true });
  })[0];
}

function fillMissing(target, source) {
  for (const field of ["birthYear", "sex", "sire", "dam", "damsire", "notes"]) {
    if (target[field] === undefined || target[field] === null || target[field] === "") {
      target[field] = source[field] ?? target[field];
    }
  }
}

function mergeBodyTags(target, source) {
  if (!Array.isArray(source.bodyTags) || source.bodyTags.length === 0) return;
  if (!Array.isArray(target.bodyTags)) target.bodyTags = [];
  const byTag = new Map(target.bodyTags.map((item) => [item.tag, item]));
  for (const incoming of source.bodyTags) {
    const current = byTag.get(incoming.tag);
    if (!current) {
      target.bodyTags.push(incoming);
      byTag.set(incoming.tag, incoming);
      continue;
    }
    current.confidence = current.confidence === "confirmed" || incoming.confidence === "confirmed" ? "confirmed" : current.confidence;
    current.evidence = [...(current.evidence || []), ...(incoming.evidence || [])];
    current.evidenceCount = current.evidence.length || Math.max(current.evidenceCount || 0, incoming.evidenceCount || 0);
  }
}

function completenessScore(horse) {
  return ["birthYear", "sex", "sire", "dam", "damsire"].reduce((score, field) => {
    return score + (horse[field] === undefined || horse[field] === null || horse[field] === "" ? 0 : 1);
  }, 0);
}

function isLikelyNewYearIssueAgeShift(photo) {
  return /^\d{4}-01-0[1-6]$/.test(photo.raceDate || photo.photoDate || "") && /金杯/.test(photo.raceName || photo.caption || "");
}

function pedigreeSignature(horse) {
  const parts = [horse.sire, horse.dam, horse.damsire].map(normalizeHorseIdentityPart);
  if (parts.every((part) => part === "")) return "";
  return parts.join("|").toLowerCase();
}
