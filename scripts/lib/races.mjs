import { readFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./store.mjs";

const raceAliasesPath = path.join(dataDir, "race-aliases.json");
const raceDateOverridesPath = path.join(dataDir, "race-date-overrides.json");

export async function loadRaceAliases() {
  return JSON.parse(await readFile(raceAliasesPath, "utf8"));
}

export async function loadRaceDateOverrides() {
  try {
    return JSON.parse(await readFile(raceDateOverridesPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {};
  }
}

export function normalizeRaceName(name = "", aliases = {}) {
  const cleaned = String(name)
    .trim()
    .replace(/[ＳＣＲＭＧ]/g, (char) => ({ "Ｓ": "S", "Ｃ": "C", "Ｒ": "R", "Ｍ": "M", "Ｇ": "G" })[char])
    .replace(/[（）]/g, (char) => ({ "（": "(", "）": ")" })[char])
    .replace(/\s+/g, "");
  return aliases[cleaned] || cleaned;
}

export function raceKey(year, raceName) {
  return year && raceName ? `${year}:${raceName}` : "";
}

export function inferRaceDate(publishedDate) {
  if (!publishedDate) return "";
  const date = parseDate(publishedDate);
  if (!date) return "";
  const day = date.getUTCDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  date.setUTCDate(date.getUTCDate() + daysUntilSunday);
  return formatDate(date);
}

export function raceYearFromDate(date) {
  return date ? Number(date.slice(0, 4)) : null;
}

function parseDate(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function formatDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}
