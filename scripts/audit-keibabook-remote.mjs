import { fetchText } from "./lib/download.mjs";
import { loadStore } from "./lib/store.mjs";
import { stripTags } from "./lib/html.mjs";

const db = await loadStore();
const checkPhotoPages = process.argv.includes("--photo-pages");
const horses = new Map(db.horses.map((horse) => [horse.id, horse]));
const issues = db.pages
  .filter((page) => page.source === "keibabook" && page.status === "ok")
  .map((page) => page.sourceId)
  .sort((a, b) => b.localeCompare(a));

const problems = [];

for (const issue of issues) {
  const baseUrl = `http://old.keibado.ne.jp/keibabook/${issue}/`;
  const indexHtml = await fetchText(`${baseUrl}index.html`, { encoding: "shift_jis" });
  const expected = parseIndex(indexHtml);
  const actual = db.photos
    .filter((photo) => photo.source === "keibabook" && photo.sourceId === issue)
    .sort((a, b) => Number(a.sourceOrder || 0) - Number(b.sourceOrder || 0))
    .map((photo) => ({
      order: Number(photo.sourceOrder || 0),
      name: horses.get(photo.horseId)?.name || "",
      raceName: photo.raceName || ""
    }));

  if (expected.length !== actual.length) {
    problems.push(`${issue}: count expected=${expected.length} actual=${actual.length}`);
  }

  const actualByOrder = new Map(actual.map((item) => [item.order, item]));
  for (const item of expected) {
    const found = actualByOrder.get(item.sourceOrder);
    if (!found) {
      problems.push(`${issue}: missing order ${item.sourceOrder} expected=${item.name}`);
      continue;
    }
    if (normalizeName(found.name) !== normalizeName(item.name)) {
      problems.push(`${issue}: order ${item.sourceOrder} expected=${item.name} actual=${found.name}`);
    }
  }

  if (checkPhotoPages) {
    for (const item of expected) {
      const found = actualByOrder.get(item.sourceOrder);
      if (!found) continue;
      const html = await fetchText(`${baseUrl}photo${String(item.sourceOrder).padStart(2, "0")}.html`, { encoding: "shift_jis" });
      const pageName = stripTags(html.match(/<img[^>]+p_name\.gif[^>]*>\s*([^<]+)/i)?.[1] ?? item.name);
      if (normalizeName(found.name) !== normalizeName(pageName)) {
        problems.push(`${issue}: photo${String(item.sourceOrder).padStart(2, "0")} expected=${pageName} actual=${found.name}`);
      }
    }
  }
}

console.log(`checked issues: ${issues.length}`);
if (problems.length) {
  console.log(`problems: ${problems.length}`);
  for (const problem of problems) console.log(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log("problems: none");
}

function parseIndex(html) {
  const links = [];
  let currentRace = "";
  const mini = (html.match(/<table[^>]+class=["']mini["'][\s\S]*?<\/table>/i)?.[0] ?? html)
    .replace(/<!--[\s\S]*?-->/g, "");
  const tokens = [...mini.matchAll(/<td[^>]*>\s*(?:<b>\s*<font[^>]*>|<font[^>]*>\s*<b>)([\s\S]*?)(?:<\/font>\s*<\/b>|<\/b>\s*<\/font>)[\s\S]*?<\/td>|<a\s+href=['"](\.\/)?(photo(\d+)\.html)['"][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const token of tokens) {
    if (token[1]) currentRace = stripTags(token[1]);
    if (token[3]) {
      links.push({
        sourceOrder: Number(token[4]),
        name: stripTags(token[5]),
        raceName: currentRace
      });
    }
  }
  return links;
}

function normalizeName(name) {
  return String(name || "").normalize("NFKC").replace(/\s+/g, "");
}
