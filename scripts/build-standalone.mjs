import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const modules = [
  "app/domain.js",
  "app/parity-summary.js",
  "app/mock-data.js",
  "app/config.js",
  "app/supabase-adapter.js",
  "app/store.js",
  "app/templates.js",
  "app/views.js",
  "app/main.js"
];

function stripModuleSyntax(source) {
  return source
    .replace(/^\s*import\s+[\s\S]*?\s+from\s+["'][^"']+["'];?\s*$/gm, "")
    .replace(/^\s*import\s+["'][^"']+["'];?\s*$/gm, "")
    .replace(/\bexport\s+(?=(?:async\s+)?function|const|let|class)/g, "")
    .replace(/\bexport\s*\{[^}]*\};?/g, "");
}

const css = await readFile(join(root, "app/styles.css"), "utf8");
const codeParts = [];
for (const path of modules) {
  const source = await readFile(join(root, path), "utf8");
  codeParts.push(`\n// ===== ${path} =====\n${stripModuleSyntax(source)}`);
}

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0f2d3f">
<meta name="color-scheme" content="light">
<title>Analiza en Casa · Demo QA autónoma</title>
<style>${css}</style>
</head>
<body>
<noscript>Este sistema necesita JavaScript para funcionar.</noscript>
<div id="app" aria-live="polite"></div>
<div id="overlay-root" class="overlay-root"></div>
<div id="modal-root" class="modal-root"></div>
<div id="toast-root" class="toast-root" aria-live="assertive"></div>
<script type="module">
${codeParts.join("\n")}
</script>
</body>
</html>`;

await mkdir(join(root, "standalone"), { recursive: true });
await writeFile(join(root, "standalone/Analiza_en_Casa_Demo_QA.html"), html);
await writeFile(join(root, "Analiza_en_Casa_Demo_QA.html"), html);
console.log(`Standalone generado: ${Buffer.byteLength(html).toLocaleString()} bytes`);
