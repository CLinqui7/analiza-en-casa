import { expect, test } from '@playwright/test';

test('nurse can submit an internal catalog request without external messaging', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill('nurse@demo.local');
  await page.getByLabel('Clave').fill('demo-nurse');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const items = [
    { id: 'supply-qa', sku: 'INS-QA', name: 'Insumo sintético', category: 'SUPPLIES' },
  ];
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/supply-requests', async (route) => {
    if (route.request().method() === 'POST') {
      submitted = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'request-qa' }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ requests: [], catalogItems: items }),
      });
    }
  });
  await page.goto('/supply-requests');
  await page.getByRole('button', { name: 'Nueva solicitud' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva solicitud de enfermería' });
  await dialog
    .getByRole('combobox', { name: 'Buscar paciente por nombre o DUI para solicitud' })
    .fill('Aurora');
  await dialog.getByRole('option').first().click();
  await dialog
    .getByRole('combobox', { name: 'Buscar medicamento, insumo o equipo' })
    .fill('INS-QA');
  await dialog.getByRole('option', { name: /INS-QA/ }).click();
  await dialog.getByLabel('Cantidad').fill('3');
  await dialog.getByLabel('Prioridad operativa').selectOption('HIGH');
  await dialog.getByRole('button', { name: 'Enviar solicitud interna' }).click();
  await expect(page.getByText('Solicitud interna recibida y auditada.')).toBeVisible();
  expect(submitted).toMatchObject({ catalogItemId: 'supply-qa', quantity: 3, priority: 'HIGH' });
  expect(submitted).not.toHaveProperty('organizationId');
});
