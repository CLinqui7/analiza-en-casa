import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const webPackage = JSON.parse(await readFile('apps/web/package.json', 'utf8'));

test('the Vercel app declares every imported workspace package', () => {
  assert.deepEqual(
    {
      contracts: webPackage.dependencies['@analiza/contracts'],
      domain: webPackage.dependencies['@analiza/domain'],
      ui: webPackage.dependencies['@analiza/ui'],
    },
    {
      contracts: 'file:../../packages/contracts',
      domain: 'file:../../packages/domain',
      ui: 'file:../../packages/ui',
    },
  );
});

test('the Vercel app declares browser-test packages included by TypeScript', () => {
  assert.deepEqual(
    {
      axe: webPackage.devDependencies['@axe-core/playwright'],
      playwright: webPackage.devDependencies['@playwright/test'],
    },
    {
      axe: '^4.11.0',
      playwright: '^1.62.1',
    },
  );
});
