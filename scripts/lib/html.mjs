export function decodeEntities(value = "") {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)));
}

export function stripTags(value = "") {
  return normalizeText(decodeEntities(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ")));
}

export function normalizeText(value = "") {
  return value.replace(/\r/g, "").replace(/[ \t\f\v]+/g, " ").replace(/\n\s+/g, "\n").replace(/\s+\n/g, "\n").trim();
}

export function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ?? "";
}

export function absoluteUrl(base, maybeUrl) {
  if (!maybeUrl) return "";
  return new URL(maybeUrl, base).href;
}

export function slug(value = "") {
  return value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "unknown";
}
