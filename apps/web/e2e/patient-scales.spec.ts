import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('patient record opens all ten source forms with per-patient context', async ({ page }) => {
  await page.goto('/patients/patient-demo-001');
  await page.getByRole('link', { name: 'Abrir escalas' }).click();
  await expect(page).toHaveURL(/\/patients\/patient-demo-001\/scales$/);
  await expect(page.getByRole('heading', { name: 'Escalas del paciente' })).toBeVisible();
  await expect(page.locator('.patient-scale-choice')).toHaveCount(10);
  await page.getByRole('button', { name: /EVA · dolor/ }).click();
  await expect(page.getByRole('img', { name: /Imagen original de Escala de EVA/ })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Puntuación visible *' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar en el expediente' })).toBeDisabled();
  await page.screenshot({ path: 'apps/web/test-results/patient-scale-review.png' });
});

test('patient scale form fits mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/patients/patient-demo-001/scales?scale=esas');
  await expect(page.getByRole('heading', { name: 'Escalas del paciente' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Dolor *' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
