import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const shellSource = new URL('../apps/web/src/components/app-shell.tsx', import.meta.url);
const stylesheet = new URL('../apps/web/src/app/globals.css', import.meta.url);

function rule(css, selector) {
  const match = css.match(
    new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`),
  );
  assert.ok(match, `Expected CSS rule for ${selector}`);
  return match[1];
}

function lastRule(css, selector) {
  const offset = css.lastIndexOf(selector);
  assert.notEqual(offset, -1, `Expected CSS rule for ${selector}`);
  return rule(css.slice(offset), selector);
}

test('UI00 mobile navigation keeps account controls in an accessible drawer', async () => {
  const [shell, css] = await Promise.all([
    readFile(shellSource, 'utf8'),
    readFile(stylesheet, 'utf8'),
  ]);
  const mobileCss = css.slice(css.lastIndexOf('@media (max-width: 740px)'));

  assert.match(shell, /aria-controls="main-navigation"/);
  assert.match(shell, /className="mobile-nav-toggle"/);
  assert.match(
    shell,
    /className=\{`sidebar\$\{mobileNavigationOpen \? ' mobile-navigation-open' : ''\}`\}/,
  );
  assert.match(shell, /data-action-id="AUTH-LOGOUT"/);
  assert.match(shell, /data-action-id="USER-MENU-OPEN"/);
  assert.match(shell, /const closeMobileNavigation = useCallback/);
  assert.match(shell, /document\.addEventListener\('keydown', trapFocus\)/);

  assert.match(rule(mobileCss, '.sidebar'), /position:\s*fixed\s*;/);
  assert.match(rule(mobileCss, '.sidebar'), /visibility:\s*hidden\s*;/);
  assert.match(rule(mobileCss, '.sidebar.mobile-navigation-open'), /visibility:\s*visible\s*;/);
  assert.match(rule(mobileCss, '.sidebar-footer'), /display:\s*block\s*;/);
  assert.match(rule(mobileCss, '.mobile-nav-overlay'), /position:\s*fixed\s*;/);
});

test('UI00 account dialog is rooted outside animated content and supports focus return', async () => {
  const [shell, css] = await Promise.all([
    readFile(shellSource, 'utf8'),
    readFile(stylesheet, 'utf8'),
  ]);

  assert.match(shell, /createPortal\(/);
  assert.match(shell, /document\.body/);
  assert.match(shell, /aria-modal="true"/);
  assert.match(shell, /profileReturnFocusRef\.current\?\.focus\(\)/);
  assert.match(shell, /const closeUserProfile = useCallback/);
  assert.match(rule(css, '.dialog-backdrop'), /z-index:\s*50\s*;/);
  assert.match(lastRule(css, '.main-content > *'), /transform:\s*none\s*!important\s*;/);
});
