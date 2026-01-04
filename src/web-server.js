import http from "http";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const webRoot = path.join(projectRoot, "web");
const webSrcRoot = path.join(webRoot, "src");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function resolvePath(urlPath) {
  if (urlPath === "/") return { root: webRoot, filePath: path.join(webRoot, "index.html") };
  if (urlPath.startsWith("/src/")) {
    return { root: webSrcRoot, filePath: path.join(webSrcRoot, urlPath.replace("/src/", "")) };
  }
  return { root: webRoot, filePath: path.join(webRoot, urlPath) };
}

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `http://${host}`);
    const requestPath = decodeURIComponent(url.pathname);
    const resolved = resolvePath(requestPath);
    if (!resolved.filePath.startsWith(resolved.root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const data = await readFile(resolved.filePath);
    const ext = path.extname(resolved.filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  } catch (err) {
    res.writeHead(404);
    res.end("Not found");
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 5173;
server.listen(port, () => {
  console.log(`Rummix UI running on http://localhost:${port}`);
});
