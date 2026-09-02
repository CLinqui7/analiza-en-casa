import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

// This is the CH01 functional and proof surface. Generated QA artifacts and
// the certification document are deliberately absent, so recording evidence
// cannot invalidate the implementation it records.
export const ch01Scope = [
  'apps/web/src/app/login',
  'apps/web/src/app/(workspace)/dashboard',
  'apps/web/src/app/(workspace)/patients',
  'apps/web/src/app/(workspace)/clinical/orders/page.tsx',
  'apps/web/src/components/app-shell.tsx',
  'apps/web/src/components/login-form.tsx',
  'apps/web/src/components/install-app.tsx',
  'apps/web/src/components/providers.tsx',
  'apps/web/src/lib/auth.ts',
  'apps/web/src/lib/permissions.ts',
  'apps/web/src/lib/data-provider.ts',
  'apps/web/src/lib/demo-data.ts',
  'packages/contracts/src',
  'packages/domain/src',
  'apps/web/e2e/ch01.spec.ts',
  'apps/web/e2e/ch10.spec.ts',
  'apps/web/e2e/workspace.spec.ts',
  'tests/selenium/test_ch01.py',
  'tests/selenium/test_medical_orders.py',
  'tests/selenium/helpers/action_recorder.py',
  'docs/qa/UI_ACTION_INVENTORY.json',
  'scripts/generate-video-react-traceability.mjs',
  'scripts/verify-video-react-parity.mjs',
  'scripts/verify-video-traceability-mirror.mjs',
  'scripts/functional-fingerprint.mjs',
  'scripts/print-functional-fingerprint.mjs',
];

function collect(root, candidate, paths) {
  const absolute = resolve(root, candidate);
  if (!existsSync(absolute)) return;
  if (statSync(absolute).isDirectory()) {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) collect(root, resolve(candidate, entry.name), paths);
  } else paths.push(relative(root, absolute).replaceAll('\\', '/'));
}

export function functionalEntries(root = process.cwd(), overrides = new Map()) {
  const paths = [];
  for (const candidate of ch01Scope) collect(root, candidate, paths);
  return paths.sort().map((path) => [path, overrides.get(path) ?? readFileSync(resolve(root, path))]);
}

export function fingerprintEntries(entries) {
  const hash = createHash('sha256');
  for (const [path, content] of entries) {
    hash.update(path); hash.update('\0'); hash.update(content); hash.update('\0');
  }
  return hash.digest('hex');
}

export function ch01FunctionalFingerprint(root = process.cwd(), overrides = new Map()) {
  return fingerprintEntries(functionalEntries(root, overrides));
}
