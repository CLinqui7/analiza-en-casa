import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const origin = new URL(process.env.ANALIZA_PREVIEW_URL).origin;
assert.ok(origin.endsWith('.vercel.app'), 'Use the intended Preview deployment');
const bypass = process.env.ANALIZA_PREVIEW_BYPASS;
assert.ok(bypass, 'Authenticated operator access is required; do not disable protection');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
// Send the operator header only to this deployment, never to maps, fonts or other origins.
await context.route(`${origin}/**`, (route) =>
  route.continue({
    headers: { ...route.request().headers(), 'x-vercel-protection-bypass': bypass },
  }),
);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const directory = '.local/preview-studio';
await mkdir(directory, { recursive: true });
const reviewed = [];
const dialogs = [];
async function noOverflow(route) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    `${route}: viewport overflow`,
  );
}
try {
  await page.goto(`${origin}/login`);
  await page.screenshot({ path: `${directory}/login.png` });
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave', { exact: true }).fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.getByText('Cargando indicadores sintéticos…').waitFor({ state: 'hidden' });
  await page.getByText('Entorno demo · ADMIN', { exact: true }).waitFor();
  const routes = await page
    .locator('aside nav a[href]')
    .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))]);
  for (const path of routes) {
    await page.goto(`${origin}${path}`);
    await page.waitForLoadState('networkidle');
    assert.ok(await page.locator('main h1, .main-content h1').count(), `${path}: missing heading`);
    await noOverflow(path);
    const name = path.slice(1).replaceAll('/', '-') || 'dashboard';
    await page.screenshot({ path: `${directory}/${name}.png` });
    reviewed.push({ path, heading: await page.locator('h1').first().innerText() });
    const action = {
      '/patients': 'PATIENT-CREATE',
      '/hospitalizations': 'HOSPITALIZATION-CREATE',
      '/quotes': 'QUOTE-CREATE',
      '/nursing-team': 'NURSE-ACCOUNT-CREATE',
      '/catalogs/operational': 'CONFIGURATION-CREATE',
      '/clinical/administrations': 'MEDICATION-ADMINISTER',
      '/reports/visits-goals': 'HOME-VISIT-CREATE',
    }[path];
    if (action) {
      await page.locator(`[data-action-id="${action}"]`).first().click();
      await page.getByRole('dialog').first().waitFor({ state: 'visible' });
      await page.screenshot({ path: `${directory}/${name}-dialog.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow(`${path} mobile dialog`);
      await page.screenshot({ path: `${directory}/${name}-mobile-dialog.png` });
      dialogs.push(path);
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
  }
  await page.goto(`${origin}/patients`);
  await page.locator('[data-action-id="DESKTOP-NAV-TOGGLE"]').click();
  await page.locator('[data-action-id="DASHBOARD-NAVIGATE"]').last().click();
  await page.waitForURL('**/dashboard');
  assert.ok(await page.locator('.app-shell.sidebar-collapsed').count());
  await page.screenshot({ path: `${directory}/dashboard-collapsed.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow('dashboard mobile');
  await page.screenshot({ path: `${directory}/dashboard-mobile.png` });
  assert.deepEqual(errors, []);
  const report = {
    verifiedAt: new Date().toISOString(),
    url: origin,
    mode: 'PROTECTED_PREVIEW_DEMO',
    reviewed,
    desktopAndMobileDialogs: dialogs,
    collapsedNavigationPersists: true,
    browserErrors: errors,
    mongoInPreview: false,
  };
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
