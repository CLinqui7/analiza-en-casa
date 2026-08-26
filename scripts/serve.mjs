import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".csv": "text/csv; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function collectBody(request) {
  return new Promise((resolveBody, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) request.destroy();
    });
    request.on("end", () => {
      if (!raw) return resolveBody({});
      try { resolveBody(JSON.parse(raw)); } catch { resolveBody({ raw }); }
    });
    request.on("error", reject);
  });
}

async function runApi(name, request, response) {
  const file = join(root, "api", `${name}.js`);
  try {
    const module = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
    request.body = await collectBody(request);
    response.status = (code) => {
      response.statusCode = code;
      return response;
    };
    response.json = (data) => {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify(data));
    };
    await module.default(request, response);
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: error.message }));
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");

  if (url.pathname.startsWith("/api/")) {
    return runApi(url.pathname.slice(5).replace(/\/$/, ""), request, response);
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filepath = resolve(root, `.${safe}`);
  if (!filepath.startsWith(root)) {
    response.statusCode = 403;
    return response.end("Forbidden");
  }

  try {
    const info = await stat(filepath);
    if (info.isDirectory()) {
      response.statusCode = 302;
      response.setHeader("Location", `${pathname.replace(/\/$/, "")}/index.html`);
      return response.end();
    }
    response.statusCode = 200;
    response.setHeader("Content-Type", mime[extname(filepath)] || "application/octet-stream");
    response.setHeader("Cache-Control", extname(filepath) === ".html" ? "no-cache" : "public, max-age=300");
    createReadStream(filepath).pipe(response);
  } catch {
    response.statusCode = 404;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    const html = await readFile(join(root, "index.html"));
    response.end(html);
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Analiza en Casa QA disponible en http://localhost:${port}`);
  console.log("Presiona Ctrl+C para detener el servidor.");
});
