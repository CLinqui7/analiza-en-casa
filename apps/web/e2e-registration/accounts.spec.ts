import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';

const credentials = () => ({ email: `qa-${randomUUID()}@example.test`, password: randomUUID() });

async function registerUi(page: Page) {
  const account = credentials();
  await page.goto('/register');
  await page.getByLabel('Tu nombre', { exact: true }).fill('Persona sintética QA');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(account.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(account.password);
  await page.getByLabel('Confirma tu contraseña', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Crear mi cuenta', exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByLabel('Nombre de la organización *', { exact: true })).toBeEnabled();
  return account;
}

async function request(page: Page, path: string, body?: unknown, csrf = true) {
  return page.evaluate(
    async ({ path, body, csrf }) => {
      const token =
        csrf && body !== undefined
          ? (await (await fetch('/api/auth/csrf')).json()).csrfToken
          : undefined;
      const response = await fetch(path, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Analiza-Csrf': token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, body, csrf },
  );
}

test('empty login, registration, questionnaire, reload, logout and password login', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.locator('[name="email"]')).toHaveValue('');
  await expect(page.locator('[name="password"]')).toHaveValue('');
  await expect(page.getByText('admin@demo.local', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Crea tu cuenta y tu espacio' })).toBeVisible();
  const account = await registerUi(page);
  await page
    .getByLabel('Nombre de la organización *', { exact: true })
    .fill('Organización sintética navegador');
  await page.getByLabel('Persona de contacto', { exact: true }).fill('Contacto de prueba');
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(
    page.getByRole('heading', { name: '¿Quiénes forman parte de tu equipo?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Agregar persona', exact: true }).click();
  await page.getByLabel('Nombre completo *', { exact: true }).fill('Personal sintético');
  await page.getByLabel('Función o cargo *', { exact: true }).fill('Administración');
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();
  await expect(page.getByRole('heading', { name: '¿Qué servicios ofrecen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Agregar servicio', exact: true }).click();
  await page.getByLabel('Nombre del servicio *', { exact: true }).fill('Servicio de prueba');
  await page
    .getByLabel('Descripción del servicio', { exact: true })
    .fill('Ficha sintética sin tarifa inventada');
  await page.getByRole('button', { name: 'Guardar cuestionario', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Tus datos quedaron guardados');
  await page.reload();
  await expect(page.getByLabel('Nombre de la organización *', { exact: true })).toHaveValue(
    'Organización sintética navegador',
  );
  const saved = await request(page, '/api/onboarding');
  expect(saved.status).toBe(200);
  expect(saved.body.staff[0].name).toBe('Personal sintético');
  expect(saved.body.services[0].name).toBe('Servicio de prueba');
  expect(saved.body.services[0].price).toBeUndefined();
  await page
    .getByLabel('Nombre de la organización *', { exact: true })
    .fill('Organización sintética editada');
  await page.getByRole('button', { name: 'Guardar avances', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Tus datos quedaron guardados');
  await page.locator('[data-action-id="AUTH-LOGOUT"]').last().click();
  await expect(page).toHaveURL(/\/login/);
  await page.locator('[name="email"]').fill(account.email);
  await page.locator('[name="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
  await page.goto('/onboarding');
  await expect(page.getByLabel('Nombre de la organización *', { exact: true })).toHaveValue(
    'Organización sintética editada',
  );
  expect(
    await page.evaluate(() => localStorage.getItem('analiza.en.casa.mock-session.v1')),
  ).toBeNull();
  const sessionCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'analiza_session',
  );
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.secure).toBe(true);
});

test('API rejects unauthenticated access, demo credentials, missing CSRF and tenant authority', async ({
  page,
  browser,
}) => {
  await page.goto('/login');
  expect((await request(page, '/api/onboarding')).status).toBe(401);
  expect(
    (await request(page, '/api/auth/register', { displayName: 'QA', ...credentials() }, false))
      .status,
  ).toBe(403);
  expect(
    (
      await request(page, '/api/auth/login', {
        email: 'admin@demo.local',
        password: ['demo', 'admin'].join('-'),
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await request(page, '/api/auth/register', {
        displayName: 'QA',
        ...credentials(),
        role: 'ADMIN',
      })
    ).status,
  ).toBe(400);
  await registerUi(page);
  await page.getByLabel('Nombre de la organización *', { exact: true }).fill('Espacio A sintético');
  await page.getByRole('button', { name: 'Guardar avances', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Tus datos quedaron guardados');
  const own = await request(page, '/api/onboarding');
  expect((await request(page, '/api/onboarding', own.body, false)).status).toBe(403);
  expect(
    (await request(page, '/api/onboarding', { ...own.body, organizationId: 'other' })).status,
  ).toBe(400);
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await other.goto(new URL('/register', page.url()).toString());
  const account = credentials();
  const created = await request(other, '/api/auth/register', {
    displayName: 'Otra persona QA',
    ...account,
  });
  expect(created.status).toBe(201);
  const otherSpace = await request(other, '/api/onboarding');
  expect(otherSpace.body.organization.name).toBe('');
  expect(otherSpace.body.staff).toEqual([]);
  expect(otherSpace.body.services).toEqual([]);
  await otherContext.close();
});

test('failed save keeps the entered data and never reports success', async ({ page }) => {
  await registerUi(page);
  await page
    .getByLabel('Nombre de la organización *', { exact: true })
    .fill('No guardado sintético');
  await page.route('**/api/onboarding', async (route) => {
    if (route.request().method() === 'POST')
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Almacenamiento temporalmente no disponible.' }),
      });
    return route.continue();
  });
  await page.getByRole('button', { name: 'Guardar avances', exact: true }).click();
  await expect(page.locator('.setup-page').getByRole('alert')).toContainText(
    'Almacenamiento temporalmente no disponible',
  );
  await expect(
    page.getByText('Tus datos quedaron guardados en tu espacio.', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Nombre de la organización *', { exact: true })).toHaveValue(
    'No guardado sintético',
  );
  expect((await request(page, '/api/onboarding')).body.expectedVersion).toBe(0);
});

test('mobile registration is usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Crea tu cuenta', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear mi cuenta', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
