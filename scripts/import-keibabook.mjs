import { absoluteUrl, stripTags } from "./lib/html.mjs";
import { downloadImage, fetchText } from "./lib/download.mjs";
import { addError, loadStore, markPage, saveStore, upsertHorse, upsertPhoto } from "./lib/store.mjs";

const args = parseArgs(process.argv.slice(2));
const issue = String(args.issue ?? "");
const downloadImages = Boolean(args["download-images"]);

if (!/^\d{6}$/.test(issue)) {
  console.error("Usage: npm run import:keibabook -- --issue 180813 [--download-images]");
  process.exit(1);
}

const db = await loadStore();
const baseUrl = `http://old.keibado.ne.jp/keibabook/${issue}/`;

try {
  const indexHtml = await fetchText(`${baseUrl}index.html`, { encoding: "shift_jis" });
  const links = parseIndex(indexHtml);
  let horses = 0;
  let photos = 0;

  for (const link of links) {
    const pageUrl = absoluteUrl(baseUrl, link.href);
    try {
      const html = await fetchText(pageUrl, { encoding: "shift_jis" });
      const item = parsePhotoPage(html, pageUrl, issue, link.raceName, link.name);
      if (!item) throw new Error("馬情報を抽出できませんでした。");
      const horse = upsertHorse(db, item.horse);
      let localImagePath = "";
      if (downloadImages && item.photo.imageUrl) {
        localImagePath = await downloadImage(item.photo.imageUrl, "keibabook", issue, `${item.horse.name}-${item.photo.sourceOrder}`);
      }
      upsertPhoto(db, {
        horseId: horse.id,
        source: "keibabook",
        sourceId: issue,
        sourcePageUrl: pageUrl,
        imageUrl: item.photo.imageUrl,
        localImagePath,
        caption: item.photo.caption,
        raceName: link.raceName,
        photoDate: item.photo.photoDate,
        issueDate: issueToDate(issue),
        sourceOrder: item.photo.sourceOrder,
        comment: item.photo.comment
      });
      horses += 1;
      photos += 1;
      console.log(`ok keibabook/${issue}: ${item.horse.name}`);
    } catch (error) {
      addError(db, { source: "keibabook", sourceId: issue, url: pageUrl, message: error.message });
      console.warn(`error keibabook/${issue} ${pageUrl}: ${error.message}`);
    }
  }

  markPage(db, {
    source: "keibabook",
    sourceId: issue,
    url: `${baseUrl}index.html`,
    title: `競馬ブック ${issue}`,
    fetchedAt: new Date().toISOString(),
    status: "ok",
    horses,
    photos
  });
} catch (error) {
  addError(db, { source: "keibabook", sourceId: issue, url: `${baseUrl}index.html`, message: error.message });
  markPage(db, {
    source: "keibabook",
    sourceId: issue,
    url: `${baseUrl}index.html`,
    fetchedAt: new Date().toISOString(),
    status: "error",
    error: error.message
  });
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await saveStore(db);
}

export function parseIndex(html) {
  const links = [];
  let currentRace = "";
  const miniTables = [...html.matchAll(/<table[^>]+class=["']mini["'][\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const legacyBlocks = [...html.matchAll(/<!--\s*#BeginLibraryItem\s+"\/Library\/m_photo\.lbi"\s*-->([\s\S]*?)<!--\s*#EndLibraryItem\s*-->/gi)].map((match) => match[1]);
  const sections = miniTables.length ? miniTables : legacyBlocks.length ? legacyBlocks : [html];
  const mini = sections.join("\n").replace(/<!--[\s\S]*?-->/g, "");
  const rows = [...mini.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const scanTargets = rows.length ? rows : [mini];

  for (const row of scanTargets) {
    const heading = extractRaceHeading(row);
    if (heading) currentRace = heading;

    for (const token of row.matchAll(/<a\s+href=['"](\.\/)?(photo(\d+)\.html)['"][^>]*>([\s\S]*?)<\/a>/gi)) {
      links.push({
        href: token[2],
        sourceOrder: Number(token[3]),
        name: stripTags(token[4]),
        raceName: currentRace
      });
    }
  }
  return links;
}

function extractRaceHeading(row) {
  if (/<a\s/i.test(row)) return "";
  const boldHeading = row.match(/(?:<b>|<strong>)\s*<font[^>]*>([\s\S]*?)<\/font>\s*(?:<\/b>|<\/strong>)/i)
    ?? row.match(/<font[^>]*>\s*(?:<b>|<strong>)([\s\S]*?)(?:<\/b>|<\/strong>)\s*<\/font>/i);
  const text = stripTags(boldHeading?.[1] ?? row).normalize("NFKC").replace(/\s+/g, "").trim();
  if (!text || text.length > 30) return "";
  if (/^(PHOTO|BackNumber|CONTENTS|News|Home|リンク|更新情報)$/i.test(text)) return "";
  if (/写真|フォトパドック|競馬ブック|ニュース|編集部|出走予定馬|重賞展望/.test(text)) return "";
  return text.replace(/^[■◆]+/, "");
}

export function parsePhotoPage(html, pageUrl, issue, raceName, fallbackName) {
  const name = stripTags(html.match(/<img[^>]+p_name\.gif[^>]*>\s*([^<]+)/i)?.[1] ?? fallbackName);
  const profile = stripTags(html.match(/<div align="right"><font[^>]*>([\s\S]*?)<\/font><\/div>/i)?.[1] ?? "").normalize("NFKC");
  const sexAge = profile.match(/([牡牝セ])\s*(\d+)/);
  const photoDate = normalizeJapaneseDate(profile.match(/[（(]([^）)]+撮影)[）)]/)?.[1] ?? "", issue);
  const image = html.match(/<img\s+src=["']([^"']*(?:(?:pp|p_photo)(\d+)|photo_(\d+))\.jpg)["'][^>]*>/i);
  const comment = extractComment(html, image);
  const pedigree = [...html.matchAll(/<font size="2" color="#000000">([\s\S]*?)<\/font>/gi)].map((match) => stripTags(match[1])).filter(Boolean);
  const sire = pedigree[0] ?? "";
  const dam = pedigree[5] ?? "";
  const damsire = pedigree[6]?.split("\n")[0] ?? "";
  const issueYear = 2000 + Number(issue.slice(0, 2));
  const birthYear = sexAge ? issueYear - Number(sexAge[2]) : null;

  if (!name || !image) return null;
  return {
    horse: {
      name,
      birthYear,
      sex: sexAge?.[1] ?? "",
      sire,
      dam,
      damsire
    },
    photo: {
      imageUrl: absoluteUrl(pageUrl, image[1]),
      caption: [photoDate, raceName].filter(Boolean).join(" "),
      photoDate,
      sourceOrder: Number(image[2] ?? image[3]),
      comment
    }
  };
}

function extractComment(html, imageMatch) {
  if (!imageMatch) return "";
  const afterImage = html.slice((imageMatch.index ?? 0) + imageMatch[0].length);
  const beforePedigree = afterImage.split(/<table[^>]+width=["']?350["']?[^>]+border=["']?1["']?/i)[0] ?? afterImage;
  const fontTexts = [...beforePedigree.matchAll(/<font\b[^>]*size=["']?2["']?[^>]*>([\s\S]*?)<\/font>/gi)]
    .map((match) => stripTags(match[1]))
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return fontTexts.sort((a, b) => b.length - a.length)[0] ?? "";
}

function issueToDate(issue) {
  const year = 2000 + Number(issue.slice(0, 2));
  return `${year}-${issue.slice(2, 4)}-${issue.slice(4, 6)}`;
}

function normalizeJapaneseDate(value, issue) {
  const match = value.normalize("NFKC").match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return "";
  const year = 2000 + Number(issue.slice(0, 2));
  return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

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
