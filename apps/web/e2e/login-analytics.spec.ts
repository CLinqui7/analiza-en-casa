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
};

test('dedicated analytics account sees live login frequency without workspace access', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/login-analytics', async (route) => {
    requests += 1;
    await route.fulfill({ json: snapshot });
  });
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill('analytics@demo.local');
  await page.getByLabel('Clave').fill('demo-analytics');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/analytics\/logins$/);
  await expect(page.getByRole('heading', { name: 'Bitácora de accesos' })).toBeVisible();
  await expect(page.getByText('user.one@example.test')).toHaveCount(2);
  await expect(page.getByRole('cell', { name: '9', exact: true })).toHaveCount(2);
  await expect(page.getByText('Sin accesos registrados')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pacientes' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Auditoría' })).toHaveCount(0);
  const requestsBeforeRefresh = requests;
  await page.getByRole('button', { name: 'Actualizar ahora' }).click();
  await expect.poll(() => requests).toBeGreaterThan(requestsBeforeRefresh);
  await page.setViewportSize({ width: 390, height: 844 });
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
