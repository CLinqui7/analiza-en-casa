import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

// Read-only production smoke. Set ANALIZA_E2E_PASSWORD outside the repository.
const origin = process.env.ANALIZA_E2E_BASE_URL;
const password = process.env.ANALIZA_E2E_PASSWORD;
assert.ok(origin && /^https:\/\//.test(origin), 'Set an HTTPS ANALIZA_E2E_BASE_URL');
assert.ok(password, 'Set ANALIZA_E2E_PASSWORD privately');

const users = [
  ['karla@analizaencasa.com', false, 'MANAGER'],
  ['abigailsv92@analizaencasa.com', false, 'MANAGER'],
  ['analiza@analizaencasa.com', false, 'MANAGER'],
  ['claudia.pinzon@analizaencasa.com', true, 'REP'],
  ['nelly.viscarra@analizaencasa.com', false, 'MANAGER'],
  ['olaya.deras@analizaencasa.com', false, 'MANAGER'],
  ['sissy.chavez@analizaencasa.com', true, 'MANAGER'],
  ['nancy.vasquez@analizaencasa.com', false, 'MANAGER'],
];
const selectedEmails = process.env.ANALIZA_E2E_EMAILS?.split(',').map((email) => email.trim());
const selectedUsers = selectedEmails?.length
  ? users.filter(([email]) => selectedEmails.includes(email))
  : users;
assert.ok(selectedUsers.length, 'No matching accounts selected');
const source = readFileSync(
  new URL('../apps/web/src/components/app-shell.tsx', import.meta.url),
  'utf8',
);
const navigation = source.slice(
  source.indexOf('const navigation:'),
  source.indexOf('function NavigationGlyph'),
);
const expected = [...navigation.matchAll(/href: '(\/[^']+)'/g)]
  .map((match) => match[1])
  .filter((route) => route !== '/dashboard' && route !== '/analytics/logins');
assert.ok(expected.length > 30, 'Navigation inventory unexpectedly incomplete');
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [email, dashboard, scope] of selectedUsers) {
    console.log(`Checking ${email}`);
    const page = await browser.newPage();
    try {
      await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Usuario o correo').fill(email);
      await page.getByLabel('Clave').fill(password);
      await page.getByRole('button', { name: 'Iniciar sesión' }).click();
      await page.waitForURL(new RegExp(`${dashboard ? '/dashboard' : '/patients'}$`), {
        timeout: 30000,
      });
      const session = await page.evaluate(async () => {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        return response.json();
      });
      assert.equal(session.role, 'ADMIN', `${email}: role`);
      assert.equal(session.dashboardAccess, dashboard, `${email}: dashboard flag`);
      await page.waitForFunction(async () => {
        const response = await fetch('/api/operations/access', { cache: 'no-store' });
        return response.ok && (await response.json()).commercialAccess !== null;
      });
      const access = await page.evaluate(async () => {
        const [commercial, privateLog] = await Promise.all([
          fetch('/api/operations/access', { cache: 'no-store' }),
          fetch('/api/login-analytics', { cache: 'no-store' }),
        ]);
        return { commercial: await commercial.json(), privateLogStatus: privateLog.status };
      });
      assert.equal(access.commercial.commercialAccess, scope, `${email}: commercial page`);
      assert.equal(access.privateLogStatus, 403, `${email}: private access log API`);
      const apiStatuses = await page.evaluate(async () =>
        Promise.all(
          ['/api/quotes', '/api/hospitalizations', '/api/operations', '/api/feedback'].map(
            async (route) => [route, (await fetch(route, { cache: 'no-store' })).status],
          ),
        ),
      );
      for (const [route, status] of apiStatuses)
        assert.equal(status, 200, `${email}: ${route} API`);
      for (const trigger of await page.locator('button.nav-group-trigger').all()) {
        if ((await trigger.getAttribute('aria-expanded')) === 'false') await trigger.click();
      }
      const links = await page
        .locator('nav.nav-scroll a[href]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
      for (const route of expected) assert.ok(links.includes(route), `${email}: missing ${route}`);
      assert.equal(links.includes('/dashboard'), dashboard, `${email}: Dashboard navigation`);
      assert.equal(links.includes('/analytics/logins'), false, `${email}: private log navigation`);

      // Exercise every navigation destination once for a restricted Dashboard account.
      if (email === selectedUsers[0][0] && process.env.ANALIZA_E2E_SWEEP !== '0') {
        for (const route of expected) {
          await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
          await page.locator('.main-content').waitFor({ timeout: 20000 });
          if (route === '/reports/visits-goals')
            await page
              .getByRole('heading', { name: 'Visitas y metas · venta de equipos' })
              .waitFor();
          assert.ok(
            !/Acceso restringido para el rol|Acceso comercial restringido/.test(
              await page.locator('body').innerText(),
            ),
            `${route}: access denied`,
          );
        }
      }
      await page.goto(`${origin}/analytics/logins`);
      await page.getByText('Acceso restringido para el rol ADMIN.').waitFor();
      await page.goto(`${origin}/dashboard`);
      if (dashboard)
        await page.getByRole('heading', { name: 'Una vista clara de tu operación' }).waitFor();
      else await page.waitForURL(/\/patients$/, { timeout: 20000 });
      results.push({
        email,
        role: session.role,
        dashboard,
        commercial: scope,
        navigationPages: expected.length,
        privateLog: 'blocked',
      });
      console.log(`Passed ${email}`);
    } finally {
      await page.close();
    }
  }
  console.log(JSON.stringify({ passed: true, results }, null, 2));
} finally {
  await browser.close();
}
