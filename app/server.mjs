import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const startPort = Number(process.env.PORT || 4174);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

listen(startPort);

function listen(port) {
  const server = createServer(handleRequest(port));
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && port < startPort + 20) {
      listen(port + 1);
      return;
    }
    throw error;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Photo Paddock: http://127.0.0.1:${port}`);
  });
}

function handleRequest(port) {
  return async (request, response) => {
    try {
      const url = new URL(request.url, `http://127.0.0.1:${port}`);
      const pathname = url.pathname === "/" ? "/public/index.html" : url.pathname;
      const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
      const filePath = path.join(root, safePath);
      if (!filePath.startsWith(root)) throw new Error("invalid path");
      const body = await readFile(filePath);
      response.writeHead(200, { "content-type": types[path.extname(filePath)] || "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  };
}
