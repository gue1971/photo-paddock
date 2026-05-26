import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./lib/store.mjs";

const todoPath = path.join(dataDir, "race-date-overrides.todo.json");
const overridesPath = path.join(dataDir, "race-date-overrides.json");

const todo = JSON.parse(await readFile(todoPath, "utf8"));
const overrides = JSON.parse(await readFile(overridesPath, "utf8"));
const applied = [];
const skipped = [];

for (const [key, value] of Object.entries(todo)) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    overrides[key] = value;
    applied.push(key);
  } else {
    skipped.push(key);
  }
}

await writeFile(overridesPath, `${JSON.stringify(Object.fromEntries(Object.entries(overrides).sort()), null, 2)}\n`);

console.log(`applied: ${applied.length}`);
if (applied.length) console.log(applied.map((key) => `- ${key}: ${overrides[key]}`).join("\n"));
if (skipped.length) console.log(`skipped invalid dates: ${skipped.join(", ")}`);
