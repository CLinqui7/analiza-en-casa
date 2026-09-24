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
  await expect(page.getByText('captura.png')).toBeVisible();

  await page.getByRole('button', { name: 'Ver imagen' }).click();
  await expect(page.getByRole('dialog', { name: /Imagen adjunta captura.png/ })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar imagen' }).click();

  await page.getByRole('button', { name: 'Gestionar' }).click();
  await page.getByLabel('Estado del comentario').selectOption('RESOLVED');
  await page
    .getByLabel('Respuesta para la persona que reportó')
    .fill('Se reorganizó el acceso y se mejoró el seguimiento visual del reporte.');
  await page.getByLabel('Pantalla corregida').fill('/feedback');
  await page.getByRole('button', { name: 'Guardar respuesta' }).click();
  await expect(page.getByRole('status')).toContainText(
    'La respuesta y el estado quedaron guardados.',
  );
  await expect(page.getByText('Resuelto', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: /Nuevos 0/ }).click();
  await expect(page.getByText('No encontramos coincidencias')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();

  await page.reload();
  await expect(page.getByText('Quiero que las funciones de enfermería')).toBeVisible();
  await page.getByRole('button', { name: 'Gestionar' }).click();
  await expect(page.getByLabel('Estado del comentario')).toHaveValue('RESOLVED');
  await expect(page.getByLabel('Respuesta para la persona que reportó')).toHaveValue(
    'Se reorganizó el acceso y se mejoró el seguimiento visual del reporte.',
  );
  await expect(page.getByText(/unrecognized_keys/)).toHaveCount(0);

  const emptyScrollSpace = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('.main-content');
    const content = document.querySelector<HTMLElement>('.feedback-page');
    if (!main || !content) return Number.POSITIVE_INFINITY;
    return main.scrollHeight - (content.offsetTop + content.offsetHeight);
  });
  expect(emptyScrollSpace).toBeLessThanOrEqual(90);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
