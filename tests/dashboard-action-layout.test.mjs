import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const stylesheet = new URL('../apps/web/src/app/globals.css', import.meta.url);

function declarationBlock(css, selector) {
  const match = css.match(
    new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`),
  );
  assert.ok(match, `Expected CSS rule for ${selector}`);
  return match[1];
}

test('dashboard header action targets are non-fragmenting flex items', async () => {
  const css = await readFile(stylesheet, 'utf8');
  const container = declarationBlock(css, '.header-actions');
  const button = declarationBlock(css, '.header-actions > .button');

  assert.match(container, /display:\s*flex\s*;/);
  assert.match(container, /flex-wrap:\s*wrap\s*;/);
  assert.match(container, /align-items:\s*center\s*;/);
  assert.match(button, /display:\s*inline-flex\s*;/);
  assert.match(button, /flex:\s*0\s+0\s+auto\s*;/);
  assert.match(button, /white-space:\s*nowrap\s*;/);
});
