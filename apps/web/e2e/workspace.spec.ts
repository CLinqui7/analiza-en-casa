import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('sidebar accordions preserve stable clinical and inventory routes', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Clínico' }).click();
  await page.getByRole('link', { name: 'Reporte de salud' }).click();
  await expect(page).toHaveURL(/\/clinical\/reports$/);
  await expect(page.getByRole('heading', { name: 'Reporte de salud' })).toBeVisible();
  await page.getByRole('button', { name: 'Inventario' }).click();
  await page.getByRole('link', { name: 'Kárdex' }).click();
  await expect(page).toHaveURL(/\/inventory\/kardex$/);
  await expect(page.getByText('Saldo derivado')).toBeVisible();
});

test('patient duplicate validation and individual vital registration are usable', async ({
  page,
}) => {
  await page.goto('/patients');
  await page.getByRole('button', { name: 'Agregar paciente' }).click();
  await page.getByLabel('Nombre completo').fill('Paciente Demo Repetido');
  await page.getByLabel('Número de documento').fill('123456789');
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(page.getByText('Ya existe un registro con este documento')).toBeVisible();

  await page.goto('/clinical/reports');
  await page.getByRole('button', { name: 'Registrar medición individual' }).click();
  await page.getByLabel('Fecha y hora').fill('2026-08-28T10:30');
  await page.getByLabel('Pulso (lpm)').fill('70');
  await page.getByRole('button', { name: 'Guardar medición' }).click();
  await expect(page.getByRole('status')).toContainText('Medición individual registrada');
  await expect(page.getByText('Pulso: 70 lpm')).toBeVisible();
});

test('dashboard has no automatically detectable serious accessibility violations', async ({
  page,
}) => {
  await page.goto('/dashboard');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
