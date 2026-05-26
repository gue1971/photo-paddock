import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadStore, rootDir } from "./lib/store.mjs";

const db = await loadStore();
const reviewDir = path.join(rootDir, "docs");
const markdownPath = path.join(reviewDir, "race-date-review.md");
const todoPath = path.join(rootDir, "data", "race-date-overrides.todo.json");

const horses = new Map(db.horses.map((horse) => [horse.id, horse]));
const groups = new Map();

for (const photo of db.photos) {
  if (photo.raceDateSource === "override") continue;
  const key = photo.raceKey || `${(photo.raceDate || photo.publishedDate || "").slice(0, 4)}:${photo.raceName || ""}`;
  if (!key) continue;
  const group = groups.get(key) || {
    key,
    raceName: photo.raceName || "",
    currentDate: photo.raceDate || "",
    publishedDates: new Set(),
    sourceIds: new Set(),
    horses: new Set(),
    photos: 0,
    category: classify(photo.raceName || "", photo.raceDate || "")
  };
  group.photos += 1;
  group.publishedDates.add(photo.publishedDate || photo.issueDate || "");
  group.sourceIds.add(photo.sourceId || "");
  group.horses.add(horses.get(photo.horseId)?.name || photo.horseId);
  groups.set(key, group);
}

const rows = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key, "ja"));
const todo = Object.fromEntries(rows.map((row) => [row.key, row.currentDate]));
const markdown = [
  "# 開催日レビュー",
  "",
  "JRA公式重賞一覧で自動確定できなかった写真だけを並べています。",
  "正しい場合はそのまま、違う場合は `data/race-date-overrides.todo.json` の日付を直してください。",
  "",
  "修正例:",
  "",
  "```json",
  "{",
  "  \"2016:クラスターC\": \"2016-08-16\"",
  "}",
  "```",
  "",
  "修正後はこちらで `data/race-date-overrides.json` に反映して再注釈します。",
  "",
  "| 確認 | キー | 現在の日付 | 分類 | 公開日 | focus | 写真数 | 対象馬サンプル |",
  "| --- | --- | --- | --- | --- | --- | ---: | --- |",
  ...rows.map((row) => `| ${[
    "未確認",
    code(row.key),
    row.currentDate,
    row.category,
    [...row.publishedDates].filter(Boolean).sort().join(", "),
    [...row.sourceIds].filter(Boolean).sort((a, b) => Number(a) - Number(b)).map((id) => `focus/${id}`).join(", "),
    String(row.photos),
    [...row.horses].slice(0, 8).join(", ")
  ].join(" | ")} |`)
].join("\n");

await mkdir(reviewDir, { recursive: true });
await writeFile(markdownPath, `${markdown}\n`);
await writeFile(todoPath, `${JSON.stringify(todo, null, 2)}\n`);

console.log(`review rows: ${rows.length}`);
console.log(markdownPath);
console.log(todoPath);

function classify(raceName, raceDate) {
  if (/クラスターC/.test(raceName)) return "地方交流";
  if (/[・／/、,]/.test(raceName) && !/^天皇賞・[春秋]$/.test(raceName)) return "複数レース名";
  if (raceDate.startsWith("2015-")) return "2015年初期分";
  return "要確認";
}

function code(value) {
  return `\`${String(value).replaceAll("|", "\\|")}\``;
}
