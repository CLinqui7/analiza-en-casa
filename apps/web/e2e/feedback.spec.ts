import { expect, test } from '@playwright/test';

test('nurse feedback accepts a module, request, photo and survives reload without technical errors', async ({
  page,
}) => {
  await page.goto('/feedback');
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/feedback$/);

  await page.getByText('Proponer una mejora', { exact: true }).click();
  await page.getByLabel(/Función o sección de Analiza/).selectOption('NAVIGATION');
  await page
    .getByLabel(/Describe lo que pasó o lo que quieres/)
    .fill('Quiero que las funciones de enfermería sean más fáciles de encontrar en el menú.');
  await page.getByLabel(/Subir una foto o captura/).setInputFiles({
    name: 'captura.png',
    mimeType: 'image/png',
    buffer: Buffer.from('captura sintetica'),
  });
  await page.getByRole('button', { name: 'Enviar reporte' }).click();

  await expect(page.getByRole('status')).toContainText('Tu reporte fue enviado correctamente.');
  await expect(page.getByText('Quiero que las funciones de enfermería')).toBeVisible();
  await expect(page.getByText('Imagen adjunta: captura.png')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Quiero que las funciones de enfermería')).toBeVisible();
  await expect(page.getByText(/unrecognized_keys/)).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
