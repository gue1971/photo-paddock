import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./store.mjs";
import { slug } from "./html.mjs";

export async function fetchText(url, { encoding = "utf-8" } = {}) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 PhotoPaddockImporter/0.1"
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const buffer = await response.arrayBuffer();
  return new TextDecoder(encoding).decode(buffer);
}

export async function downloadImage(url, source, sourceId, nameHint) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 PhotoPaddockImporter/0.1",
      "referer": new URL(url).origin
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const contentType = response.headers.get("content-type") || "";
  const ext = extensionFromContentType(contentType) || path.extname(new URL(url).pathname) || ".jpg";
  const dir = path.join(dataDir, "images", source, String(sourceId));
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${slug(nameHint)}${ext.split("?")[0]}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, bytes);
  return path.relative(dataDir, filePath);
}

function extensionFromContentType(contentType) {
  if (contentType.includes("jpeg")) return ".jpg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  return "";
}
