import { extractBodyTags } from "./lib/body-tags.mjs";
import { loadStore, saveStore } from "./lib/store.mjs";

const db = await loadStore();
const byHorse = new Map(db.horses.map((horse) => [horse.id, new Map()]));

for (const photo of db.photos) {
  const tags = extractBodyTags(photo.comment || "");
  if (!tags.length) continue;
  const horseTags = byHorse.get(photo.horseId);
  if (!horseTags) continue;
  for (const match of tags) {
    const item = horseTags.get(match.tag) || {
      tag: match.tag,
      category: match.category,
      confidence: "suggested",
      evidenceCount: 0,
      evidence: []
    };
    item.confidence = mergeConfidence(item.confidence, match.confidence);
    item.evidenceCount += 1;
    for (const phrase of match.evidence) {
      item.evidence.push({
        photoId: photo.id,
        raceDate: photo.raceDate || photo.photoDate || "",
        raceName: photo.raceName || "",
        phrase
      });
    }
    item.evidence = item.evidence.slice(0, 5);
    horseTags.set(match.tag, item);
  }
}

let taggedHorses = 0;
let changed = 0;
for (const horse of db.horses) {
  const horseTags = byHorse.get(horse.id) || new Map();
  if (horseTags.has("長躯短背")) {
    horseTags.delete("胴長");
    horseTags.delete("胴詰まり");
  }
  const nextTags = [...horseTags.values()]
    .sort((a, b) => tagSortKey(a).localeCompare(tagSortKey(b), "ja"))
    .map((tag) => ({
      ...tag,
      evidenceCount: tag.evidenceCount,
      evidence: tag.evidence.sort((a, b) => (b.raceDate || "").localeCompare(a.raceDate || ""))
    }));
  if (nextTags.length) taggedHorses += 1;
  if (JSON.stringify(horse.bodyTags || []) !== JSON.stringify(nextTags)) {
    horse.bodyTags = nextTags;
    changed += 1;
  }
}

await saveStore(db);

const tagCounts = new Map();
for (const horse of db.horses) {
  for (const tag of horse.bodyTags || []) tagCounts.set(tag.tag, (tagCounts.get(tag.tag) || 0) + 1);
}

console.log(`body-tagged horses: ${taggedHorses}`);
console.log(`changed horses: ${changed}`);
for (const [tag, count] of [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))) {
  console.log(`${tag}: ${count}`);
}

function mergeConfidence(current, next) {
  return current === "confirmed" || next === "confirmed" ? "confirmed" : "suggested";
}

function tagSortKey(item) {
  const categoryOrder = item.category === "体型" ? "0" : "1";
  const confidenceOrder = item.confidence === "confirmed" ? "0" : "1";
  return `${categoryOrder}:${confidenceOrder}:${item.tag}`;
}
