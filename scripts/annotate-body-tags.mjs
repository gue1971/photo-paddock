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
  resolveLongShortBody(horseTags);
  resolveTagConflict(horseTags, "胴長", "胴詰まり");
  resolveTagConflict(horseTags, "首長", "首短");
  resolveTagConflict(horseTags, "直飛", "曲飛");
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

function resolveLongShortBody(tags) {
  const longShort = tags.get("長躯短背");

  if (longShort?.confidence === "confirmed") {
    tags.delete("胴長");
    tags.delete("胴詰まり");
    tags.delete("短背");
    return;
  }

  const compact = tags.get("胴詰まり");
  if (compact?.confidence === "confirmed") {
    tags.delete("長躯短背");
    tags.delete("胴長");
    return;
  }

  if (longShort) {
    tags.delete("胴長");
    tags.delete("胴詰まり");
    tags.delete("短背");
    return;
  }

  if (tags.has("短背") && tags.has("胴長")) {
    tags.set("長躯短背", combinedLongShortTag(tags.get("短背"), tags.get("胴長")));
    tags.delete("胴長");
    tags.delete("胴詰まり");
    tags.delete("短背");
  }
}

function combinedLongShortTag(shortBack, longBody) {
  const evidence = [...(shortBack.evidence || []), ...(longBody.evidence || [])]
    .sort((a, b) => (b.raceDate || "").localeCompare(a.raceDate || ""))
    .slice(0, 5);
  return {
    tag: "長躯短背",
    category: "体型",
    confidence: "suggested",
    evidenceCount: Math.max(shortBack.evidenceCount || 0, longBody.evidenceCount || 0),
    evidence
  };
}

function resolveTagConflict(tags, a, b) {
  if (!tags.has(a) || !tags.has(b)) return;
  const aScore = tagReliabilityScore(tags.get(a));
  const bScore = tagReliabilityScore(tags.get(b));
  if (aScore > bScore) tags.delete(b);
  else if (bScore > aScore) tags.delete(a);
  else {
    tags.delete(a);
    tags.delete(b);
  }
}

function tagReliabilityScore(tag) {
  const confidence = tag.confidence === "confirmed" ? 100 : 0;
  return confidence + (tag.evidenceCount || 0);
}
