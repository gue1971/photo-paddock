import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./lib/store.mjs";
import { loadRaceAliases, normalizeRaceName, raceKey } from "./lib/races.mjs";

const cacheDir = "/private/tmp/jra-jyusyo";
const overridesPath = path.join(dataDir, "race-date-overrides.json");
const manualOverridesPath = path.join(dataDir, "race-date-manual-overrides.json");
const aliases = await loadRaceAliases();
const overrides = {};
const manualOverrides = await loadManualOverrides();
const unmatched = new Set();

for (let year = 2015; year <= 2026; year += 1) {
  const html = new TextDecoder("shift_jis").decode(await readFile(path.join(cacheDir, `${year}.html`)));
  for (const row of extractRaceRows(html)) {
    const date = normalizeDate(year, row.date);
    const officialName = row.race.replace(/^(?:Jpn|J)?・?G?(?:[ⅠⅡⅢⅣV]|&#\d+;)+/, "");
    const normalized = normalizeOfficialRaceName(officialName, aliases);
    if (!normalized) {
      unmatched.add(officialName);
      continue;
    }
    const key = raceKey(year, normalized);
    overrides[key] = date;
  }
}

Object.assign(overrides, manualOverrides);

await writeFile(overridesPath, `${JSON.stringify(Object.fromEntries(Object.entries(overrides).sort()), null, 2)}\n`);
console.log(`official overrides: ${Object.keys(overrides).length}`);
if (unmatched.size) console.log(`unmatched official names: ${[...unmatched].slice(0, 30).join(", ")}`);

function normalizeOfficialRaceName(name, aliases) {
  const cleaned = name
    .replace(/&#8544;/g, "Ⅰ")
    .replace(/&#8545;/g, "Ⅱ")
    .replace(/&#8546;/g, "Ⅲ")
    .replace(/^農林水産省賞典/, "")
    .replace(/^日刊スポーツ賞/, "")
    .replace(/^スポーツニッポン賞/, "")
    .replace(/^夕刊フジ賞/, "")
    .replace(/^報知杯/, "")
    .replace(/^デイリー杯/, "")
    .replace(/^サンケイスポーツ杯/, "")
    .replace(/^関西テレビ放送賞/, "")
    .replace(/^テレビ西日本賞/, "")
    .replace(/^ラジオNIKKEI杯/, "")
    .replace(/^朝日杯セントライト記念/, "セントライト記念")
    .replace(/^産経賞/, "")
    .replace(/^ローレル競馬場賞/, "")
    .replace(/^ニュージーランドトロフィー/, "ニュージーランドT")
    .replace(/ステークス$/, "S")
    .replace(/カップ$/, "C")
    .replace(/記念$/, "記念")
    .replace(/賞$/, "賞");
  const direct = normalizeRaceName(cleaned, aliases);
  if (direct) return direct;
  const patterns = [
    ["NHKマイルC", /NHKマイル/],
    ["アメリカJCC", /アメリカジョッキー|アメリカJCC/],
    ["アルゼンチン共和国杯", /アルゼンチン共和国/],
    ["ヴィクトリアマイル", /ヴィクトリア/],
    ["エプソムC", /エプソム/],
    ["キーンランドC", /キーンランド/],
    ["クイーンカップ", /クイーンC|クイーンカップ/],
    ["クイーンステークス", /クイーンS|クイーンステークス/],
    ["シルクロードステークス", /シルクロード/],
    ["スプリンターズS", /スプリンターズ/],
    ["セントウルS", /セントウル/],
    ["チャンピオンズカップ", /チャンピオンズ/],
    ["フィリーズレビュー", /フィリーズ/],
    ["フェブラリーS", /フェブラリー/],
    ["フローラS", /フローラ/],
    ["マイルCS", /マイルチャンピオン|マイルCS/],
    ["ラジオNIKKEI賞", /ラジオNIKKEI/],
    ["阪神JF", /阪神ジュベナイル/],
    ["朝日杯FS", /朝日杯フューチュリティ/],
    ["天皇賞・春", /天皇賞.*春/],
    ["天皇賞・秋", /天皇賞.*秋/],
    ["ジャパンカップ", /ジャパン/],
    ["ホープフルS", /ホープフル/],
    ["京成杯AH", /京成杯オータム/],
    ["中山牝馬S", /中山牝馬/],
    ["函館スプリントS", /函館スプリント/],
    ["アイビスサマーダッシュ", /アイビス/],
    ["小倉2歳S", /小倉2歳/],
    ["札幌2歳S", /札幌2歳/],
    ["新潟2歳S", /新潟2歳/],
    ["CBC賞", /CBC/]
  ];
  return patterns.find(([, pattern]) => pattern.test(name))?.[0] || normalizeRaceName(name, aliases);
}

function extractRaceRows(html) {
  const rows = [];
  for (const match of html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
    const row = match[0];
    const dateMatch = row.match(/<td\b[^>]*class="[^"]*\bdate\b[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
    const raceMatch = row.match(/<td\b[^>]*class="[^"]*\brace\b[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
    if (dateMatch && raceMatch) {
      rows.push({
        date: stripTags(dateMatch[1]),
        race: stripTags(raceMatch[1])
      });
      continue;
    }

    const oldCells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => stripTags(cell[1])).filter(Boolean);
    const oldDateIndex = oldCells.findIndex((cell) => /\d+月\d+日/.test(cell));
    if (oldDateIndex >= 0 && oldCells[oldDateIndex + 1]) {
      rows.push({
        date: oldCells[oldDateIndex],
        race: oldCells[oldDateIndex + 1]
      });
    }
  }
  return rows;
}

function normalizeDate(year, text) {
  const match = text.match(/(\d+)月(\d+)日/);
  if (!match) return "";
  return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function stripTags(value) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, "")
    .replace(/\s+/g, "")
    .trim();
}

async function loadManualOverrides() {
  try {
    return JSON.parse(await readFile(manualOverridesPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { "2018:凱旋門賞": "2018-10-07" };
  }
}
