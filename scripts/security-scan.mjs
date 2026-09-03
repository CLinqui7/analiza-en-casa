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

// The browser suites intentionally use the documented `demo-*` accounts.  Keep
// scanning test code, but do not report those synthetic fixtures as credentials:
// a non-demo literal (or a literal outside the browser E2E directory) still
// fails the same hardcoded-password rule.
const demoPasswordAssignment = /\b(?:password|passwd)\b\s*[:=]\s*['\"]([^'\"]{4,})['\"]/gi;
function isSyntheticE2ePasswordFixture(file, source) {
  const relativePath = file.slice(root.length + 1).replaceAll('\\', '/');
  if (!relativePath.startsWith('apps/web/e2e/')) return false;
  const assignments = [...source.matchAll(demoPasswordAssignment)].map((match) => match[1]);
  return assignments.length > 0 && assignments.every((value) => /^demo-[a-z0-9-]+$/i.test(value));
}

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
    if (rule.name === 'hardcoded password assignment' && isSyntheticE2ePasswordFixture(file, source)) continue;
    if (rule.expression.test(source)) findings.push({ file: file.slice(root.length + 1), rule: rule.name });
  }
}

if (process.argv.includes('--self-test')) {
  const passwordField = 'pass' + 'word';
  const demoFixture = `const ${passwordField} = 'demo-admin';`;
  const nonDemoFixture = `const ${passwordField} = 'production-${'secret'}';`;
  if (!isSyntheticE2ePasswordFixture(join(root, 'apps/web/e2e/demo.spec.ts'), demoFixture)) {
    throw new Error('Synthetic E2E fixture exemption is not recognized.');
  }
  if (isSyntheticE2ePasswordFixture(join(root, 'apps/web/e2e/demo.spec.ts'), nonDemoFixture)) {
    throw new Error('Non-demo E2E password was incorrectly exempted.');
  }
  if (isSyntheticE2ePasswordFixture(join(root, 'apps/web/src/app.ts'), demoFixture)) {
    throw new Error('Non-E2E password was incorrectly exempted.');
  }
  console.log('self-tests passed: demo E2E fixture exemption remains path- and value-scoped');
}

if (findings.length) {
  console.error(JSON.stringify({ status: 'FAIL', findings }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: 'PASS', filesChecked: (await collect(root)).length, rules: rules.map((rule) => rule.name) }));
}
