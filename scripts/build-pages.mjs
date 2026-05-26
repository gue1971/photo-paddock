import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const docsDir = path.join(root, "docs");

await mkdir(docsDir, { recursive: true });
await cp(path.join(publicDir, "app.js"), path.join(docsDir, "app.js"));
await cp(path.join(publicDir, "styles.css"), path.join(docsDir, "styles.css"));
await cp(path.join(publicDir, "manifest.webmanifest"), path.join(docsDir, "manifest.webmanifest"));
await cp(path.join(publicDir, "sw.js"), path.join(docsDir, "sw.js"));
await cp(path.join(publicDir, "icons"), path.join(docsDir, "icons"), { recursive: true });
await cp(path.join(root, "data"), path.join(docsDir, "data"), { recursive: true });
await writeFile(path.join(docsDir, ".nojekyll"), "");

const index = await readFile(path.join(publicDir, "index.html"), "utf8");
await writeFile(
  path.join(docsDir, "index.html"),
  index
    .replaceAll('href="/public/manifest.webmanifest"', 'href="./manifest.webmanifest"')
    .replaceAll('href="/public/icons/apple-touch-icon.png"', 'href="./icons/apple-touch-icon.png"')
    .replaceAll('href="/public/styles.css"', 'href="./styles.css"')
    .replaceAll('src="/public/app.js"', 'src="./app.js"')
);
