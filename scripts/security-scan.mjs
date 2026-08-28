import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ignored = new Set(['.git', 'node_modules', '.next', 'references', 'test-results', 'playwright-report']);
const textExtensions = new Set(['.js', '.mjs', '.ts', '.tsx', '.json', '.md', '.html', '.sql', '.yml', '.yaml', '.env', '.example']);
const rules = [
  { name: 'hardcoded password assignment', expression: /\b(?:password|passwd)\b\s*[:=]\s*['"][^'"]{4,}['"]/i },
  { name: 'private key block', expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'service role value assignment', expression: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s#]+/i },
  { name: 'AWS access key-shaped literal', expression: /\bAKIA[0-9A-Z]{16}\b/ },
];

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (ignored.has(entry.name)) return [];
    const target = join(directory, entry.name);
    if (entry.isDirectory()) return collect(target);
    return textExtensions.has(extname(entry.name).toLowerCase()) || entry.name === '.env.example' ? [target] : [];
  }));
  return nested.flat();
}

const findings = [];
for (const file of await collect(root)) {
  const source = await readFile(file, 'utf8');
  for (const rule of rules) {
    if (rule.expression.test(source)) findings.push({ file: file.slice(root.length + 1), rule: rule.name });
  }
}

if (findings.length) {
  console.error(JSON.stringify({ status: 'FAIL', findings }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: 'PASS', filesChecked: (await collect(root)).length, rules: rules.map((rule) => rule.name) }));
}
