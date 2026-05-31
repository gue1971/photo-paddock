import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, loadStore } from "./lib/store.mjs";

const db = await loadStore();
const photos = db.photos
  .filter((photo) => photo.source === "keibabook" && photo.localImagePath && photo.imageUrl)
  .sort((a, b) => `${a.sourceId}:${a.sourceOrder}`.localeCompare(`${b.sourceId}:${b.sourceOrder}`));

const problems = [];
let checked = 0;

for (const photo of photos) {
  const localPath = path.join(dataDir, photo.localImagePath);
  const local = await readFile(localPath);
  const response = await fetch(photo.imageUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 PhotoPaddockImporter/0.1",
      "referer": new URL(photo.imageUrl).origin
    }
  });
  if (!response.ok) {
    problems.push(`${photo.sourceId}/${photo.sourceOrder}: ${response.status} ${response.statusText}`);
    continue;
  }
  const remote = Buffer.from(await response.arrayBuffer());
  if (hash(local) !== hash(remote)) {
    problems.push(`${photo.sourceId}/${photo.sourceOrder}: image differs ${photo.localImagePath}`);
  }
  checked += 1;
}

console.log(`checked images: ${checked}`);
if (problems.length) {
  console.log(`problems: ${problems.length}`);
  for (const problem of problems) console.log(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log("problems: none");
}

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
