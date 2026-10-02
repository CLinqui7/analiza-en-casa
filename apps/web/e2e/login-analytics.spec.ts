import { expect, test } from '@playwright/test';

const snapshot = {
  generatedAt: '2026-10-01T15:00:00.000Z',
  trackingSince: '2026-09-28T15:00:00.000Z',
  users: [
    {
      userId: 'synthetic-user-one',
      email: 'user.one@example.test',
      displayName: 'Usuario sintético uno',
      role: 'NURSE',
      active: true,
      totalLogins: 9,
      loginsLast7Days: 4,
      loginsLast30Days: 9,
      activeDaysLast30Days: 3,
      firstLoginAt: '2026-09-28T15:00:00.000Z',
      lastLoginAt: '2026-10-01T14:30:00.000Z',
    },
    {
      userId: 'synthetic-user-two',
      email: 'user.two@example.test',
      displayName: 'Usuario sintético dos',
      role: 'DOCTOR',
      active: true,
      totalLogins: 0,
      loginsLast7Days: 0,
      loginsLast30Days: 0,
      activeDaysLast30Days: 0,
      firstLoginAt: null,
      lastLoginAt: null,
    },
  ],
  recentLogins: [
    {
      id: 'synthetic-login-one',
      userId: 'synthetic-user-one',
      email: 'user.one@example.test',
      displayName: 'Usuario sintético uno',
      occurredAt: '2026-10-01T14:30:00.000Z',
    },
  ],
  dailyLogins: Array.from({ length: 14 }, (_, index) => ({
    day: new Date(Date.UTC(2026, 8, 18 + index)).toISOString().slice(0, 10),
    count: index === 13 ? 2 : index === 6 ? 1 : 0,
  })),
};

test('dedicated analytics account sees live login frequency without workspace access', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let requests = 0;
  await page.route('**/api/login-analytics', async (route) => {
    requests += 1;
    await route.fulfill({ json: snapshot });
  });
  await page.route('**/api/login-analytics/history?*', async (route) => {
    const month = new URL(route.request().url()).searchParams.get('month');
    await route.fulfill({ json: month === '2026-09' ? {
      userId: 'synthetic-user-one', month,
      days: [{ day: '2026-09-28', count: 1 }],
      events: [{ id: 'synthetic-september-login', occurredAt: '2026-09-28T15:00:00.000Z' }],
    } : {
      userId: 'synthetic-user-one', month: '2026-10',
      days: [{ day: '2026-10-01', count: 2 }],
      events: [
        { id: 'synthetic-login-one', occurredAt: '2026-10-01T14:30:00.000Z' },
        { id: 'synthetic-login-two', occurredAt: '2026-10-01T13:00:00.000Z' },
      ],
    } });
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill('analytics@demo.local');
  await page.getByLabel('Clave').fill('demo-analytics');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/analytics\/logins$/);
  await expect(page.getByRole('heading', { name: 'Bitácora de accesos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Accesos en los últimos 14 días' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Accesos diarios' }).locator('li')).toHaveCount(14);
  if (process.env.ANALIZA_ANALYTICS_SCREENSHOT) {
    await expect
      .poll(() =>
        page.locator('[class$="__privateBadge"]').evaluate((badge) => {
          const hero = badge.closest('header');
          return hero ? badge.getBoundingClientRect().top - hero.getBoundingClientRect().top : 0;
        }),
      )
      .toBeGreaterThan(20);
    await page.screenshot({ path: process.env.ANALIZA_ANALYTICS_SCREENSHOT, fullPage: true });
  }
  await expect(page.getByText('user.one@example.test')).toHaveCount(2);
  await expect(page.getByRole('cell', { name: '9', exact: true })).toHaveCount(2);
  await expect(page.getByText('Sin accesos registrados')).toBeVisible();
  await page.getByRole('row').filter({ hasText: 'Usuario sintético uno' }).getByRole('button', { name: 'Ver calendario' }).click();
  await expect(page.getByRole('heading', { name: 'Accesos de Usuario sintético uno' })).toBeVisible();
  await expect(page.getByRole('button', { name: /1 de octubre de 2026: 2 accesos/ })).toBeVisible();
  await page.getByRole('button', { name: /1 de octubre de 2026: 2 accesos/ }).click();
  await expect(page.getByText('Inicio de sesión exitoso')).toHaveCount(2);
  await page.getByRole('button', { name: 'Mes anterior' }).click();
  await expect(page.getByRole('button', { name: /28 de septiembre de 2026: 1 accesos/ })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar calendario' }).click();
  await page.getByRole('button', { name: 'Con acceso en 30 días' }).click();
  await expect(page.getByText('user.two@example.test')).toHaveCount(0);
  await page.getByRole('button', { name: 'Todos' }).click();
  await expect(page.getByRole('link', { name: 'Pacientes' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Auditoría' })).toHaveCount(0);
  const requestsBeforeRefresh = requests;
  await page.getByRole('button', { name: 'Actualizar ahora' }).click();
  await expect.poll(() => requests).toBeGreaterThan(requestsBeforeRefresh);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.locator('[class$="__privateBadge"]').evaluate((badge) => {
        const hero = badge.closest('header');
        return hero ? badge.getBoundingClientRect().top - hero.getBoundingClientRect().top : 0;
      }),
    )
    .toBeGreaterThan(20);
  if (process.env.ANALIZA_ANALYTICS_MOBILE_SCREENSHOT) {
    await page.screenshot({
      path: process.env.ANALIZA_ANALYTICS_MOBILE_SCREENSHOT,
      fullPage: true,
    });
  }
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    )
    .toBe(true);
});

test('ordinary admin role cannot open the private analytics route', async ({ page }) => {
  await page.goto('/login?next=%2Fanalytics%2Flogins');
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.locator('main[role="alert"]')).toContainText(
    'Acceso restringido para el rol ADMIN',
  );
});

test('webmaster keeps the admin workspace and receives analytics as an extra', async ({ page }) => {
  await page.route('**/api/login-analytics', (route) => route.fulfill({ json: snapshot }));
  await page.goto('/login?next=%2Fanalytics%2Flogins');
  await page.getByLabel('Usuario o correo').fill('webmaster@demo.local');
  await page.getByLabel('Clave').fill('demo-webmaster');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/analytics\/logins$/);
  await expect(page.getByRole('heading', { name: 'Bitácora de accesos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pacientes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Auditoría' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Analítica de accesos' })).toBeVisible();
});
