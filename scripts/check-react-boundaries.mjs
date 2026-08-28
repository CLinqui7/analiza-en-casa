import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reactRoot = join(root, 'apps', 'web');
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs']);
const prohibited = [
  { expression: /dangerouslySetInnerHTML/, label: 'dangerouslySetInnerHTML' },
  { expression: /<iframe\b/i, label: 'iframe' },
  { expression: /(?:app\/main\.js|app\\main\.js|legacy-demo)/, label: 'legacy demo runtime reference' },
];

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === '.next' ? [] : collect(target);
    return extensions.has(extname(entry.name)) ? [target] : [];
  }));
  return nested.flat();
}

const violations = [];
for (const file of await collect(reactRoot)) {
  const source = await readFile(file, 'utf8');
  for (const rule of prohibited) {
    if (rule.expression.test(source)) violations.push({ file: file.slice(root.length + 1), rule: rule.label });
  }
}
if (violations.length) {
  console.error(JSON.stringify({ status: 'FAIL', violations }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: 'PASS', filesChecked: (await collect(reactRoot)).length, prohibitedPatterns: prohibited.map((rule) => rule.label) }));
}
