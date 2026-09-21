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
