import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, horseKey, loadStore, normalizeHorseIdentityPart, saveStore } from "./lib/store.mjs";

const csvPath = process.argv[2] || "/Users/gue1971/Downloads/hokanyou.csv";
const csv = await readCsv(csvPath);
const db = await loadStore();
const overridesPath = path.join(dataDir, "horse-birth-year-overrides.json");

const unknowns = db.horses.filter((horse) => horse.birthYear === undefined || horse.birthYear === null);
const csvByName = new Map();
for (const row of csv) {
  const item = {
    birthYear: Number(row["生年"]),
    name: row["馬名"] || "",
    sire: row["種牡馬"] || "",
    dam: row["母名"] || "",
    damsire: row["母父名"] || ""
  };
  if (!Number.isFinite(item.birthYear) || !item.name) continue;
  const key = normalize(item.name);
  const items = csvByName.get(key) ?? [];
  items.push(item);
  csvByName.set(key, items);
}

const exact = [];
const uniqueName = [];
const review = [];
const missing = [];

for (const horse of unknowns) {
  const candidates = csvByName.get(normalize(horse.name)) ?? [];
  if (!candidates.length) {
    missing.push(reviewHorse(horse, []));
    continue;
  }

  const exactCandidates = candidates.filter((candidate) => {
    return normalize(candidate.sire) === normalize(horse.sire)
      && normalize(candidate.dam) === normalize(horse.dam);
  });

  if (exactCandidates.length === 1) {
    exact.push({ horse, candidate: exactCandidates[0] });
  } else if (candidates.length === 1) {
    uniqueName.push({ horse, candidate: candidates[0] });
  } else {
    review.push(reviewHorse(horse, candidates));
  }
}

const overrides = await loadExistingOverrides();
for (const { horse, candidate } of exact) {
  applyBirthYearOverride(horse, candidate, "name+sire+dam");
}
for (const { horse, candidate } of uniqueName) {
  applyBirthYearOverride(horse, candidate, "unique-name");
}

function applyBirthYearOverride(horse, candidate, matchedBy) {
  horse.birthYear = candidate.birthYear;
  horse.key = horseKey(horse);
  overrides[horse.id] = {
    name: horse.name,
    birthYear: candidate.birthYear,
    source: "hokanyou.csv",
    matchedBy,
    csvSire: candidate.sire,
    csvDam: candidate.dam
  };
}

await saveStore(db);
await writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`);
await writeFile(path.join(dataDir, "birth-year-csv-review.json"), `${JSON.stringify({ review, missing }, null, 2)}\n`);

console.log(`csv rows: ${csv.length}`);
console.log(`unknown horses before: ${unknowns.length}`);
console.log(`exact birth-year matches: ${exact.length}`);
console.log(`unique-name birth-year matches: ${uniqueName.length}`);
console.log(`review candidates: ${review.length}`);
console.log(`missing from csv: ${missing.length}`);

async function readCsv(filePath) {
  const bytes = await readFile(filePath);
  const text = new TextDecoder("shift_jis").decode(bytes);
  const rows = parseCsv(text);
  const header = rows.shift()?.map((cell) => cell.trim()) ?? [];
  return rows
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => Object.fromEntries(header.map((key, index) => [key, row[index]?.trim() ?? ""])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === "\"" && text[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function reviewHorse(horse, candidates) {
  return {
    id: horse.id,
    name: horse.name,
    sire: horse.sire || "",
    dam: horse.dam || "",
    damsire: horse.damsire || "",
    candidates: candidates.map((candidate) => ({
      birthYear: candidate.birthYear,
      name: candidate.name,
      sire: candidate.sire,
      dam: candidate.dam,
      damsire: candidate.damsire
    }))
  };
}

function normalize(value) {
  return normalizeHorseIdentityPart(value).toLowerCase();
}

async function loadExistingOverrides() {
  try {
    return JSON.parse(await readFile(overridesPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {};
  }
}
