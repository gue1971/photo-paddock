import { absoluteUrl, attr, normalizeText, stripTags } from "./lib/html.mjs";
import { downloadImage, fetchText } from "./lib/download.mjs";
import { addError, isPageImported, loadStore, markPage, saveStore, upsertHorse, upsertPhoto } from "./lib/store.mjs";
import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const latest = Number(args.latest ?? args.id ?? 726);
  const oldest = Number(args.oldest ?? latest);
  const downloadImages = Boolean(args["download-images"]);
  const force = Boolean(args.force);

  const db = await loadStore();
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (let id = latest; id >= oldest; id -= 1) {
    if (!force && isPageImported(db, "keibalab", String(id))) {
      skipped += 1;
      continue;
    }

    const url = `https://www.keibalab.jp/column/focus/${id}/`;
    try {
      const html = await fetchText(url);
      const result = parseKeibalabPage(html, id, url);
      if (!result.horses.length) {
        throw new Error("本文から馬情報を抽出できませんでした。未ログイン向け表示、公開前、またはページ構造変更の可能性があります。");
      }

      if (force) {
        db.photos = db.photos.filter((photo) => photo.source !== "keibalab" || photo.sourceId !== String(id));
      }

      for (const item of result.horses) {
        const horse = upsertHorse(db, item.horse);
        for (const [index, photo] of item.photos.slice(0, 1).entries()) {
          let localImagePath = "";
          if (downloadImages && photo.imageUrl) {
            localImagePath = await downloadImage(photo.imageUrl, "keibalab", id, `${item.horse.name}-${index + 1}`);
          }
          upsertPhoto(db, {
            horseId: horse.id,
            source: "keibalab",
            sourceId: String(id),
            sourcePageUrl: url,
            imageUrl: photo.imageUrl,
            localImagePath,
            caption: [result.publishedDate, item.raceName || result.raceName].filter(Boolean).join(" ") || result.title,
            raceName: item.raceName || result.raceName,
            photoDate: result.publishedDate,
            issueDate: result.publishedDate,
            sourceOrder: index + 1,
            comment: item.comment
          });
        }
      }

      markPage(db, {
        source: "keibalab",
        sourceId: String(id),
        url,
        title: result.title,
        fetchedAt: new Date().toISOString(),
        status: "ok",
        horses: result.horses.length,
        photos: result.horses.reduce((sum, item) => sum + Math.min(item.photos.length, 1), 0)
      });
      imported += 1;
      console.log(`ok keibalab/${id}: ${result.horses.length} horses`);
    } catch (error) {
      failed += 1;
      addError(db, { source: "keibalab", sourceId: String(id), url, message: error.message });
      markPage(db, {
        source: "keibalab",
        sourceId: String(id),
        url,
        fetchedAt: new Date().toISOString(),
        status: "error",
        error: error.message
      });
      console.warn(`error keibalab/${id}: ${error.message}`);
    }
  }

  await saveStore(db);
  console.log(`done: imported=${imported} skipped=${skipped} failed=${failed}`);
}

export function parseKeibalabPage(html, id, url) {
  const title = extractMeta(html, "og:title") || stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const publishedDate = normalizeDate(html.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\([^)]+\)/)?.[0] ?? html.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/)?.[0] ?? "");
  const titleRaceNames = extractRaceNamesFromTitle(title);
  const raceName = title.match(/[【\[]([^】\]]+)/)?.[1] ?? titleRaceNames.join("／");
  const singlePageRaceName = raceName && !isMultiRaceName(raceName) ? raceName : "";
  const articleCandidate = html.match(/<!--記 事-->([\s\S]*?)<!-- \/ソーシャルボタン -->/i)?.[1] ?? "";
  const article = articleCandidate.includes("PPhorseWrap") ? articleCandidate : html;
  const raceNames = extractRaceTabs(article);
  const sections = extractRaceSections(article, raceNames);
  const raceOverride = singlePageRaceName && sections.length <= 1 ? singlePageRaceName : "";
  const blocks = sections.length ? sections.flatMap((section) => {
    return horseBlocks(section.html).map((block) => ({ block, raceName: section.raceName }));
  }) : horseBlocks(article).map((block) => ({ block, raceName }));

  return {
    source: "keibalab",
    sourceId: String(id),
    title: title.replace("｜馬体FOCUS", "").trim(),
    publishedDate,
    raceName,
    horses: blocks.map(({ block, raceName: blockRaceName }) => {
      const horse = parseHorseBlock(block, url, publishedDate);
      return horse ? { ...horse, raceName: raceOverride || blockRaceName || raceName } : null;
    }).filter(Boolean)
  };
}

export function isMultiRaceName(raceName = "") {
  if (/^天皇賞・[春秋]$/.test(raceName.trim())) return false;
  return /[・／/、,]/.test(raceName);
}

function extractRaceTabs(article) {
  const entries = [...article.matchAll(/<p class="focusBtn(\d+)">([\s\S]*?)<\/p>/gi)];
  return Object.fromEntries(entries.map((match) => [match[1], stripTags(match[2])]).filter(([, name]) => name));
}

function extractRaceSections(article, raceNames) {
  const matches = [...article.matchAll(/<!--\s*レース(\d+)\s*start\s*-->([\s\S]*?)<!--\s*レース\1\s*end\s*-->/gi)];
  const sections = matches
    .map((match) => ({
      raceName: raceNames[match[1]] || "",
      html: match[2]
    }))
    .filter((section) => section.html.includes("PPhorseWrap"));
  if (matches.length && !matches.some((match) => match[1] === "1") && raceNames["1"]) {
    const firstMarkedSectionStart = matches[0].index ?? 0;
    const leadingHtml = article.slice(0, firstMarkedSectionStart);
    if (leadingHtml.includes("PPhorseWrap")) {
      sections.unshift({ raceName: raceNames["1"], html: leadingHtml });
    }
  }
  return sections;
}

function horseBlocks(article) {
  const markedBlocks = [...article.matchAll(/<!--\s*\/+([^/<]+?)\/+\s*-->\s*(<div class="PPhorseWrap[\s\S]*?)<!--\s*\/+\1\/+\s*-->/gi)].map((match) => match[2]);
  const fallbackBlocks = [...article.matchAll(/<div class="PPhorseWrap[\s\S]*?(?=<div class="PPhorseWrap|<span class="red">※|<!--\s*レース|$)/gi)].map((match) => match[0]);
  return markedBlocks.length ? markedBlocks : fallbackBlocks;
}

function parseHorseBlock(block, url, publishedDate) {
  const name = stripTags(
    block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ??
    block.match(/<div class="PPnameWrap3"[\s\S]*?<span[^>]*class="[^"]*\bbold\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ??
    block.match(/<div class="PPnameWrap"[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ??
    ""
  );
  if (!name) return null;
  const profileText = stripTags(
    block.match(/<div class="PPnameWrap2"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ??
    block.match(/<div class="PPnameWrap3"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ??
    block.match(/<div class="PPnameWrap"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ??
    ""
  );
  const sexAge = profileText.match(/([牡牝セ])\s*(\d+)/);
  const age = sexAge ? Number(sexAge[2]) : null;
  const publishedYear = publishedDate ? Number(publishedDate.slice(0, 4)) : null;
  const sire = tableValue(block, "父");
  const damCell = rawTableValue(block, "母");
  const dam = stripTags(damCell.replace(/<span[\s\S]*?<\/span>/gi, ""));
  const damsire = stripTags(damCell.match(/母父[:：]\s*([^<]+)/)?.[1] ?? rawTableValue(block, "母父"));
  const comment = stripTags(
    block.match(/<div class="PPcomment"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ??
    block.match(/<th[^>]*>\s*POINT\s*<\/th>\s*<td[^>]*>([\s\S]*?)(?:<\/td>|\/td>|<\/table>)/i)?.[1] ??
    block.match(/<th[^>]*>\s*POINT\s*<\/th>\s*<\/tr>\s*<tr>\s*<td[^>]*colspan=["']2["'][^>]*>([\s\S]*?)<\/td>/i)?.[1] ??
    ""
  );
  const photos = [...block.matchAll(/<a[^>]+href=["']([^"']+\.(?:jpg|jpeg|png|webp|gif)\??[^"']*)["'][^>]*>\s*<img/gi)]
    .map((match) => ({ imageUrl: normalizeImageUrl(absoluteUrl(url, match[1])) }))
    .filter((photo, index, array) => photo.imageUrl && array.findIndex((item) => item.imageUrl === photo.imageUrl) === index);

  return {
    horse: {
      name,
      birthYear: publishedYear && age !== null ? publishedYear - age : null,
      sex: sexAge?.[1] ?? "",
      sire,
      dam,
      damsire
    },
    photos,
    comment
  };
}

function normalizeImageUrl(url) {
  return url.replace(/\.(jpe?g|png|webp|gif)\.\1(\?|$)/i, ".$1$2");
}

function tableValue(block, label) {
  return stripTags(rawTableValue(block, label));
}

function rawTableValue(block, label) {
  const pattern = new RegExp(`<th[^>]*>\\s*${label}\\s*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, "i");
  return block.match(pattern)?.[1] ?? "";
}

function extractMeta(html, property) {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*>`, "i"))?.[0] ?? "";
  return normalizeText(attr(tag, "content"));
}

function normalizeDate(value) {
  const match = value.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function extractRaceNamesFromTitle(title) {
  const candidates = [
    ["フェブラリーS", /フェブラリーS/],
    ["チューリップ賞", /チューリップ賞/],
    ["弥生賞", /弥生賞/],
    ["フィリーズR", /フィリーズR/],
    ["中山牝馬S", /中山牝馬S/],
    ["阪神大賞典", /阪神大賞典/],
    ["スプリングS", /スプリングS|スプリングＳ|スプリング(?![A-Za-zＡ-Ｚａ-ｚ])/],
    ["高松宮記念", /高松宮記念/],
    ["大阪杯", /(?:産経)?大阪杯/],
    ["ダービー卿CT", /ダービー卿CT/],
    ["桜花賞", /桜花賞/],
    ["皐月賞", /皐月賞/],
    ["フローラS", /フローラS/],
    ["マイラーズC", /マイラーズC/],
    ["天皇賞(春)", /天皇賞[・(（]?春[)）]?/],
    ["NHKマイルC", /NHKマイル[CSＣＳ]*/],
    ["ヴィクトリアM", /ヴィクトリアM/],
    ["オークス", /オークス/],
    ["日本ダービー", /日本ダービー/],
    ["安田記念", /安田記念/],
    ["エプソムC", /エプソムC/],
    ["マーメイドS", /マーメイドS/],
    ["函館スプリントS", /函館スプリントS|函館SS/],
    ["ユニコーンS", /ユニコーンS/],
    ["宝塚記念", /宝塚記念/],
    ["凱旋門賞", /凱旋門賞/],
    ["CBC賞", /CBC賞/],
    ["ラジオNIKKEI賞", /ラジオNIKKEI賞/],
    ["七夕賞", /七夕賞/],
    ["プロキオンS", /プロキオンS/],
    ["函館記念", /函館記念/],
    ["中京記念", /中京記念/],
    ["アイビスSD", /アイビスSD|アイビスサマーダッシュ/],
    ["クイーンS", /クイーンS/],
    ["小倉記念", /小倉記念/],
    ["レパードS", /レパードS/],
    ["関屋記念", /関屋記念/],
    ["エルムS", /エルムS/],
    ["札幌記念", /札幌記念/],
    ["北九州記念", /北九州記念/],
    ["新潟2歳S", /新潟2歳S/],
    ["キーンランドC", /キーンランドC/],
    ["新潟記念", /新潟記念/],
    ["小倉2歳S", /小倉2歳S/],
    ["札幌2歳S", /札幌2歳S/],
    ["京成杯AH", /京成杯AH/],
    ["セントウルS", /セントウルS/],
    ["ローズS", /ローズS/],
    ["セントライト記念", /セントライト記念/],
    ["神戸新聞杯", /神戸新聞杯/],
    ["オールカマー", /オールカマー/],
    ["スプリンターズS", /スプリンターズS/],
    ["毎日王冠", /毎日王冠/],
    ["京都大賞典", /京都大賞典/],
    ["秋華賞", /秋華賞/],
    ["菊花賞", /菊花賞/],
    ["天皇賞(秋)", /天皇賞[・(（]?秋[)）]?/],
    ["アルゼンチン共和国杯", /アルゼンチン共和国杯/],
    ["みやこS", /みやこS/],
    ["エリザベス女王杯", /エリザベス女王杯/],
    ["マイルCS", /マイルCS|マイルＣＳ/],
    ["ジャパンC", /ジャパンC|ジャパンカップ/],
    ["チャンピオンズC", /チャンピオンズC/],
    ["阪神JF", /阪神JF/],
    ["朝日杯FS", /朝日杯FS/],
    ["有馬記念", /有馬記念/],
    ["ホープフルS", /ホープフルS/],
    ["中山金杯", /中山金杯/],
    ["京都金杯", /京都金杯/],
    ["シンザン記念", /シンザン記念/],
    ["フェアリーS", /フェアリーS/],
    ["日経新春杯", /日経新春杯/],
    ["京成杯", /京成杯/],
    ["AJCC", /AJCC|アメリカJCC/],
    ["東海S", /東海S/],
    ["シルクロードS", /シルクロードS/],
    ["根岸S", /根岸S/],
    ["東京新聞杯", /東京新聞杯/],
    ["きさらぎ賞", /きさらぎ賞/],
    ["クイーンC", /クイーンC/],
    ["共同通信杯", /共同通信杯/],
    ["京都記念", /京都記念/],
    ["中山記念", /中山記念/],
    ["阪急杯", /阪急杯/],
    ["金鯱賞", /金鯱賞/]
  ];
  return candidates
    .map(([name, pattern]) => ({ name, index: title.search(pattern) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .filter((item, index, array) => array.findIndex((other) => other.name === item.name) === index)
    .map((item) => item.name);
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
