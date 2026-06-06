import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, loadStore } from "./lib/store.mjs";
import { loadRaceAliases, normalizeRaceName, raceKey } from "./lib/races.mjs";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/import-race-results-from-csv.mjs <target-frontier-results.csv>");
  process.exit(1);
}

const resultsPath = path.join(dataDir, "race-results.json");
const db = await loadStore();
const aliases = await loadRaceAliases();
const existingResults = await loadResults();
const text = await readFile(inputPath, "utf8");
const rows = parseCsv(text.replace(/^\uFEFF/, ""));
const [headers, ...records] = rows;
const index = Object.fromEntries(headers.map((header, i) => [header.trim(), i]));
const required = ["日付", "レース名", "馬名", "着順", "馬体重"];
for (const header of required) {
  if (!(header in index)) {
    console.error(`Missing required column: ${header}`);
    process.exit(1);
  }
}

const photoRaceKeys = new Set(db.photos.map((photo) => photo.raceKey).filter(Boolean));
const results = {
  version: 1,
  races: {
    ...(existingResults.races || {})
  }
};
const stats = {
  rows: 0,
  races: new Set(),
  matchedPhotoRaces: new Set(),
  unmatchedRaceKeys: new Set(),
  entries: 0
};

for (const row of records) {
  if (!row.some((value) => String(value || "").trim())) continue;
  stats.rows += 1;
  const rawDate = cell(row, index, "日付");
  const sourceRaceName = cell(row, index, "レース名");
  const date = normalizeTargetDate(rawDate);
  const year = date.slice(0, 4);
  const raceInfo = normalizeTargetRaceName(sourceRaceName, aliases, date);
  const key = raceKey(year, raceInfo.name);
  if (!key) continue;
  for (const [existingKey, existingRace] of Object.entries(results.races)) {
    if (existingKey !== key && existingRace.date === date && existingRace.sourceRaceNames?.includes(sourceRaceName)) {
      delete results.races[existingKey];
    }
  }
  if (!results.races[key]) {
    results.races[key] = {
      date,
      name: raceInfo.name,
      source: "target-frontier-csv",
      grade: raceInfo.grade,
      sourceRaceNames: [],
      entries: {}
    };
  }
  const race = results.races[key];
  race.date ||= date;
  race.name ||= raceInfo.name;
  if (raceInfo.grade && !race.grade) race.grade = raceInfo.grade;
  if (!race.sourceRaceNames.includes(sourceRaceName)) race.sourceRaceNames.push(sourceRaceName);
  const horseName = cell(row, index, "馬名");
  const finish = normalizeFinish(cell(row, index, "着順"));
  race.entries[horseName] = {
    finish: finish.finish,
    status: finish.status,
    bodyWeight: normalizeNumber(cell(row, index, "馬体重")),
    sex: cell(row, index, "性別"),
    age: normalizeNumber(cell(row, index, "年齢")),
    birthDate: normalizeBirthDate(cell(row, index, "生年月日")),
    sire: cell(row, index, "種牡馬"),
    dam: cell(row, index, "母馬"),
    damsire: cell(row, index, "母父馬"),
    sourceRaceName
  };
  stats.entries += 1;
  stats.races.add(key);
  if (photoRaceKeys.has(key)) stats.matchedPhotoRaces.add(key);
  else stats.unmatchedRaceKeys.add(key);
}

results.races = Object.fromEntries(Object.entries(results.races).sort(([a], [b]) => b.localeCompare(a, "ja")));
await writeFile(resultsPath, `${JSON.stringify(results, null, 2)}\n`);

console.log(`rows: ${stats.rows}`);
console.log(`entries imported: ${stats.entries}`);
console.log(`races in csv: ${stats.races.size}`);
console.log(`matched photo races: ${stats.matchedPhotoRaces.size}`);
console.log(`unmatched race keys: ${stats.unmatchedRaceKeys.size}`);
if (stats.unmatchedRaceKeys.size) {
  console.log("unmatched examples:");
  for (const key of [...stats.unmatchedRaceKeys].slice(0, 20)) console.log(`- ${key}`);
}

async function loadResults() {
  try {
    return JSON.parse(await readFile(resultsPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { version: 1, races: {} };
  }
}

function cell(row, index, header) {
  return String(row[index[header]] ?? "").normalize("NFKC").trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        i += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function normalizeTargetDate(value) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 6) return `20${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return "";
}

function normalizeTargetRaceName(value, aliases, date = "") {
  const normalized = String(value)
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[ＳＣＨ]/g, (char) => ({ "Ｓ": "S", "Ｃ": "C", "Ｈ": "H" })[char]);
  const grade = normalized.match(/G[123]$/)?.[0] || "";
  const base = normalized
    .replace(/G[123]$/, "")
    .replace(/H$/, "")
    .replace(/S$/, "S");
  const targetAliases = {
    "CBC賞": "CBC賞",
    "JC": "ジャパンカップ",
    "アーリン": "アーリントンC",
    "アイビス": "アイビスサマーダッシュ",
    "アイルラ": "アイルランドT",
    "東京優駿": "日本ダービー",
    "優駿牝馬": "オークス",
    "アルゼン": "アルゼンチン共和国杯",
    "アルテミ": "アルテミスS",
    "葵S": "葵S",
    "ヴィクト": "ヴィクトリアマイル",
    "NHKマ": "NHKマイルカップ",
    "エプソム": "エプソムC",
    "エリザベ": "エリザベス女王杯",
    "エルムS": "エルムS",
    "オーシャ": "オーシャンS",
    "オータム": "京成杯AH",
    "オールカ": "オールカマー",
    "カペラS": "カペラS",
    "キーンラ": "キーンランドカップ",
    "京都新聞": "京都新聞杯",
    "天皇賞春": "天皇賞・春",
    "天皇賞秋": "天皇賞・秋",
    "京王杯ス": "京王杯SC",
    "京王杯2": "京王杯2歳S",
    "京阪杯": "京阪杯",
    "京都2歳": "京都2歳S",
    "京都大賞": "京都大賞典",
    "京都牝馬": "京都牝馬S",
    "ユニコー": "ユニコーンS",
    "フローラ": "フローラS",
    "マイラー": "マイラーズC",
    "マイルチ": "マイルCS",
    "福島牝馬": "福島牝馬S",
    "アンタレ": "アンタレスS",
    "サウジア": "サウジアラビアRC",
    "しらさぎ": "しらさぎS",
    "シリウス": "シリウスS",
    "ニュージ": "ニュージーランドT",
    "阪神牝馬": "阪神牝馬S",
    "阪神カッ": "阪神カップ",
    "阪神ジュ": "阪神ジュベナイルF",
    "チャーチ": "チャーチルダウンズC",
    "チャレン": "チャレンジC",
    "ダービー": "ダービー卿CT",
    "ターコイ": "ターコイズS",
    "高松宮記": "高松宮記念",
    "マーチS": "マーチS",
    "阪神大賞": "阪神大賞典",
    "フラワー": "フラワーC",
    "ファルコ": "ファルコンS",
    "スプリンG1": "スプリンターズS",
    "スプリンG2": "スプリングS",
    "スワンS": "スワンS",
    "セントウ": "セントウルS",
    "セントラ": "セントライト記念",
    "フィリー": "フィリーズレビュー",
    "中山牝馬": "中山牝馬S",
    "チューリ": "チューリップ賞",
    "小倉大賞": "小倉大賞典",
    "小倉記念": "小倉記念",
    "小倉牝馬": "小倉牝馬S",
    "フェブラ": "フェブラリーS",
    "フューチ": "朝日杯FS",
    "ダイヤモ": "ダイヤモンドS",
    "共同通信": "共同通信杯",
    "東京新聞": "東京新聞杯",
    "クイーン": Number(date.slice(5, 7)) >= 7 ? "クイーンS" : "クイーンC",
    "きさらぎ": "きさらぎ賞",
    "シルクロ": "シルクロードS",
    "アメリカ": "アメリカJCC",
    "プロキオ": "プロキオンS",
    "日経新春": "日経新春杯",
    "シンザン": "シンザン記念",
    "フェアリ": "フェアリーS",
    "ファンタ": "ファンタジーS",
    "ホープフ": "ホープフルS",
    "マーメイ": "マーメイドS",
    "みやこS": "みやこS",
    "ラジオNI": "ラジオNIKKEI賞",
    "レパード": "レパードS",
    "ローズS": "ローズS",
    "関屋記念": "関屋記念",
    "紫苑S": "紫苑S",
    "小倉2歳": "小倉2歳S",
    "新潟2歳": "新潟2歳S",
    "新潟記念": "新潟記念",
    "新潟大賞": "新潟大賞典",
    "札幌2歳": "札幌2歳S",
    "神戸新聞": "神戸新聞杯",
    "中京2歳": "中京2歳S",
    "中京記念": "中京記念",
    "中日新聞": "中日新聞杯",
    "東京スポ": "東京スポーツ杯2歳S",
    "東海S": "東海S",
    "函館2歳": "函館2歳S",
    "函館スプ": "函館スプリントS",
    "函館記念": "函館記念",
    "富士S": "富士S",
    "府中牝馬": "府中牝馬S",
    "武蔵野S": "武蔵野S",
    "福島記念": "福島記念",
    "平安S": "平安S",
    "北九州記": "北九州記念",
    "目黒記念": "目黒記念",
    "デイリー": "デイリー杯2歳S",
    "チャンピ": "チャンピオンズカップ",
    "ステイヤ": "ステイヤーズS"
  };
  return {
    name: normalizeRaceName(targetAliases[`${base}${grade}`] || targetAliases[base] || base, aliases),
    grade
  };
}

function normalizeFinish(value) {
  const normalized = String(value).normalize("NFKC").trim();
  if (normalized === "消") return { finish: "", status: "scratched" };
  if (normalized === "外") return { finish: "", status: "excluded" };
  if (normalized === "止") return { finish: "", status: "stopped" };
  return { finish: normalizeNumber(normalized), status: "started" };
}

function normalizeNumber(value) {
  const normalized = String(value).normalize("NFKC").replace(/[^\d-]/g, "");
  return normalized ? Number(normalized) : null;
}

function normalizeBirthDate(value) {
  const match = String(value).normalize("NFKC").replace(/\s+/g, "").match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}
