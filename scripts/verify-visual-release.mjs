// Read-only browser review of the known synthetic organization. No production records are written.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, expect, request } from '@playwright/test';

const baseURL = process.env.VISUAL_RELEASE_URL;
const account = JSON.parse(fs.readFileSync(process.env.VISUAL_RELEASE_ACCOUNT_FILE, 'utf8'));
assert.ok(baseURL?.startsWith('https://'));
assert.equal(account.organizationId, '157a0046-7ed7-4bd6-85b8-005431466298');
const api = await request.newContext({ baseURL });
const output = process.env.VISUAL_RELEASE_OUTPUT || '.local/visual-release';
fs.mkdirSync(output, { recursive: true });
const results = [], errors = [];
let browser;
try {
  const csrf = (await (await api.get('/api/auth/csrf')).json()).csrfToken;
  const login = await api.post('/api/auth/login', {
    headers: { 'x-analiza-csrf': csrf },
    data: { email: account.email, password: account.password },
  });
  assert.equal(login.status(), 200);
  const session = await login.json();
  assert.equal(session.userId, account.userId);
  const workspace = await (await api.get('/api/workspace')).json();
  const operations = await (await api.get('/api/operations')).json();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ baseURL, storageState: await api.storageState(), reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push({ route: new URL(page.url()).pathname, message: error.message }));
  const routes = fs.readdirSync('apps/web/src/app/(workspace)', { recursive: true })
    .map(path => path.replaceAll('\\', '/'))
    .filter(path => path.endsWith('/page.tsx') && !path.includes('['))
    .map(path => '/' + path.replace('/page.tsx', ''));
  const patient = workspace.patients.find(item => item.id.startsWith('patient-synthetic-qa-'));
  const admission = workspace.hospitalizations.find(item => item.id === 'case-synthetic-clinical-release');
  if (patient) routes.push('/patients/' + patient.id);
  if (admission) routes.push('/hospitalizations/' + admission.id);
  if (workspace.quotes[0]) routes.push('/quotes/' + workspace.quotes[0].id);
  for (const path of routes) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(path);
    const commercialRestricted = page.getByText('Acceso comercial restringido', { exact: true });
    await expect(page.locator('h1, main[role="alert"]').or(commercialRestricted).first()).toBeVisible();
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const denied = (await page.locator('main[role="alert"]').count()) || (await commercialRestricted.count());
    const item = { path, access: denied ? 'restricted' : 'available', widths: [] };
    if (!denied) {
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => document.fonts.check('500 14px "Analiza Inter"')));
      for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        assert.ok(overflow <= 1, `${path} overflows at ${width}: ${overflow}`);
        item.widths.push({ width, overflow });
      }
      if (['/quotes', '/clinical/orders', '/reports/returns', '/surveys', '/profile'].includes(path)) {
        await page.screenshot({ path: `${output}/${path.slice(1).replaceAll('/', '-')}-mobile.png`, fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.screenshot({ path: `${output}/${path.slice(1).replaceAll('/', '-')}.png`, fullPage: true });
      }
    }
    results.push(item);
    console.log('REVIEW', path, item.access);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/patients');
  const menu = page.locator('.patient-more-actions');
  await menu.locator('summary').focus();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('button', { name: 'Actualizar lista' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open');
  await expect(menu.locator('summary')).toBeFocused();
  await page.goto('/receivables');
  if (operations.medicationReturns.length) {
    const link = page.getByRole('link', { name: 'Ver devoluciones' });
    await expect(link).toHaveCSS('text-decoration-line', 'none');
    assert.ok(await link.evaluate(el => el.getBoundingClientRect().height >= 36));
    await link.click();
    await expect(page).toHaveURL(/\/reports\/returns$/);
  }
  assert.equal((await api.get('/api/health')).status(), 200);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'PASS', routes: results.length, restricted: results.filter(item => item.access === 'restricted').length, errors: errors.length, returnsLinkChecked: operations.medicationReturns.length > 0 }));
} finally {
  fs.writeFileSync(`${output}/report.json`, JSON.stringify({ results, errors }, null, 2));
  await browser?.close();
  await api.dispose();
}
