import { expect, test, type Page } from '@playwright/test';
async function login(page: Page, role = 'admin') {
  await page.goto('/login?next=%2Fcatalogs%2Fdiscounts');
  await page.getByLabel('Usuario o correo').fill(role + '@demo.local');
  await page.getByLabel('Clave').fill('demo-' + role);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}
// Nov 3 authorization supersedes the historical blocked matrix.
// test-id: playwright:ch16-discount-matrix
test('CH16 exposes editable rates without inventing discounts or fake persistence', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: 'Agregar perfil' }).click();
  const dialog = page.getByRole('dialog', { name: 'Perfil de descuento' });
  for (const label of [
    'Servicios',
    'Laboratorios',
    'Medicamentos',
    'Equipos',
    'Insumos',
    'Honorarios',
  ])
    await expect(dialog.getByLabel(label + ' · %')).toHaveValue('');
  await dialog.getByLabel('Nombre', { exact: true }).fill('Perfil sintético CH16');
  await dialog.getByLabel('Servicios · %').fill('12');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('conexión segura');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await page.reload();
  await expect(page.getByText('Perfil sintético CH16')).toHaveCount(0);
});
for (const role of ['inventory', 'auditor', 'doctor', 'nurse', 'finance'])
  test('CH16 ' + role + ' can enter client-authorized discount configuration', async ({ page }) => {
    await login(page, role);
    await expect(page.getByRole('heading', { name: 'Descuentos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar perfil' })).toBeEnabled();
  });
