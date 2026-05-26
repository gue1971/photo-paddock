import { spawn } from "node:child_process";
import { loadStore } from "./lib/store.mjs";

const args = parseArgs(process.argv.slice(2));
const db = await loadStore();
const latest = Number(args.latest ?? 726);
const minExisting = Math.max(0, ...db.pages.filter((page) => page.source === "keibalab" && page.status === "ok").map((page) => Number(page.sourceId)));
const oldest = minExisting ? minExisting + 1 : latest;

if (oldest > latest) {
  console.log(`keibalab is up to date: latest imported ${minExisting}`);
  process.exit(0);
}

const childArgs = ["scripts/import-keibalab.mjs", "--latest", String(latest), "--oldest", String(oldest)];
if (args["download-images"]) childArgs.push("--download-images");
if (args.force) childArgs.push("--force");

const child = spawn(process.execPath, childArgs, { stdio: "inherit" });
child.on("exit", (code) => {
  process.exit(code ?? 1);
});

function parseArgs(items) {
  const parsed = {};
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = items[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
