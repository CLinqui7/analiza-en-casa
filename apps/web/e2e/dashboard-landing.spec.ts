import { expect, test } from '@playwright/test';

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

// test-id: playwright:restricted-dashboard-landing
test('a nurse without dashboard access lands on patients, even from a dashboard link', async ({
  page,
}) => {
  await page.goto('/login?next=%2Fdashboard');
  await signIn(page, 'nurse@demo.local', 'demo-nurse');
  await expect(page).toHaveURL(/\/patients$/);
  await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/patients$/);
  await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();
});

test('analytics-only accounts return to their authorized page from a dashboard link', async ({
  page,
}) => {
  await page.goto('/login');
  await signIn(page, 'analytics@demo.local', 'demo-analytics');
  await expect(page).toHaveURL(/\/analytics\/logins$/);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/analytics\/logins$/);
  await expect(page.getByRole('heading', { name: 'Bitácora de accesos' })).toBeVisible();
});

test('authorized accounts keep their dashboard landing', async ({ page }) => {
  await page.goto('/login');
  await signIn(page, 'admin@demo.local', 'demo-admin');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole('heading', { name: 'Una vista clara de tu operación' }),
  ).toBeVisible();
});
