import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('patient phone asks for a country and formats national digits', async ({ page }) => {
  await page.goto('/patients');
  await page.getByRole('button', { name: 'Agregar paciente' }).click();
  const dialog = page.getByRole('dialog', { name: 'Agregar paciente' });
  const country = dialog.getByRole('combobox', { name: 'Teléfono celular: país' });
  const phone = dialog.getByRole('textbox', { name: 'Teléfono celular' });
  await expect(country).toHaveValue('SV');
  await phone.fill('71234567');
  await expect(phone).toHaveValue('7123-4567');
  await country.selectOption('CU');
  await expect(country).toHaveValue('CU');
  await expect(phone).toHaveValue('7123-4567');
});

test('clinical scales show ten source images without claiming clinical approval', async ({
  page,
}) => {
  await page.goto('/clinical/scales');
  await expect(page.getByRole('heading', { name: 'Escalas clínicas', exact: true })).toBeVisible();
  await expect(page.locator('.clinical-scale-card')).toHaveCount(10);
  await expect(page.locator('.clinical-scales-summary > div').nth(2)).toContainText(
    /0\s*versiones clínicas aprobadas/,
  );
  const glasgow = page.locator('#glasgow');
  await expect(glasgow).toContainText('Fuente por aclarar');
  await glasgow.getByText('Ver imagen original').click();
  await expect(glasgow.getByRole('img', { name: /captura original/i })).toBeVisible();
  await page.screenshot({ path: 'apps/web/test-results/scales-review.png' });
  await page.goto('/changes');
  await expect(page.getByRole('link', { name: 'Ver imagen original' })).toHaveCount(10);
});

test('agenda duration shortcuts are compact and keep the existing shift flow', async ({ page }) => {
  await page.goto('/agenda');
  await page.getByRole('button', { name: 'Crear turno', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Crear turno a paciente' });
  const sixHours = dialog.getByRole('button', { name: 'Turno 6 horas' });
  await expect(sixHours).toBeVisible();
  const size = await sixHours.boundingBox();
  expect(size).not.toBeNull();
  expect(size!.width).toBeLessThan(210);
  expect(size!.height).toBeLessThan(65);
  await expect(dialog).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'apps/web/test-results/agenda-schedule-review.png' });
});

test('scale catalog fits a narrow screen without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/clinical/scales');
  await expect(page.getByRole('heading', { name: 'Escalas clínicas', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
