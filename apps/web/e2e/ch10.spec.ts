import { expect, test } from '@playwright/test';

// test-id: playwright:ch10-medical-order-list
// test-id: playwright:ch10-medical-order-menu-and-guards

async function loginToOrders(page: import('@playwright/test').Page, email = 'admin@demo.local', password = 'demo-admin') {
  await page.goto('/login?next=%2Fclinical%2Forders');
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/clinical\/orders$/);
}

test('CH10 factual medical-order list filters active and inactive patients without deriving clinical values', async ({ page }) => {
  await loginToOrders(page);
  await expect(page.getByRole('columnheader', { name: 'Acciones', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Nombre', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Cédula', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Fecha Nac.', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Triage', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Hospitalización', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Estatus', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Tratamientos con cambios' })).toBeDisabled();
  await expect(page.getByRole('tab', { name: 'Actualizaciones' })).toBeDisabled();
  await page.getByLabel('Buscar orden médica').fill('Aurora');
  await expect(page.getByText('Paciente Demo Aurora', { exact: true })).toBeVisible();
  await page.getByLabel('Buscar orden médica').fill('sin-coincidencia-ch10');
  await expect(page.getByText('No hay registros disponibles', { exact: true })).toBeVisible();
  await page.getByLabel('Buscar orden médica').fill('');
  await page.getByRole('tab', { name: 'Inactivos', exact: true }).click();
  await expect(page.getByText('Paciente Demo Brisa', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Activos', exact: true }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByText('Paciente Demo Gloria', { exact: true })).toBeVisible();
});

test('CH10 row menu exposes document choice while keeping undefined order and XPO flows non-mutating', async ({ page }) => {
  await loginToOrders(page);
  await page.getByRole('button', { name: 'Acciones para Paciente Demo Aurora' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver Órdenes' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Registro XPO' })).toBeDisabled();
  await page.getByRole('button', { name: 'Nuevo' }).click();
  const dialog = page.getByRole('dialog', { name: '¿Qué quieres crear?' });
  await expect(dialog.getByRole('button', { name: 'Orden Médica' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Tarjeta de medicamentos' })).toBeDisabled();
  await expect(dialog.getByRole('status')).toContainText('permanece bloqueada');
});

test('CH10 denies the medical-order direct route to INVENTORY', async ({ page }) => {
  await page.goto('/login?next=%2Fclinical%2Forders');
  await page.getByLabel('Usuario o correo').fill('inventory@demo.local');
  await page.getByLabel('Clave').fill('demo-inventory');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByText('Acceso restringido para el rol INVENTORY.', { exact: true })).toBeVisible();
});

test('CH10 permits DOCTOR to read the factual list', async ({ page }) => {
  await loginToOrders(page, 'doctor@demo.local', 'demo-doctor');
  await expect(page.getByText('Paciente Demo Aurora', { exact: true })).toBeVisible();
});

test('CH10 permits NURSE to read but not expose a new clinical document', async ({ page }) => {
  await loginToOrders(page, 'nurse@demo.local', 'demo-nurse');
  await page.getByRole('button', { name: 'Acciones para Paciente Demo Aurora' }).click();
  await expect(page.getByRole('button', { name: 'Nuevo' })).toHaveCount(0);
});

test('CH10 permits AUDITOR to read but not expose a new clinical document', async ({ page }) => {
  await loginToOrders(page, 'auditor@demo.local', 'demo-auditor');
  await page.getByRole('button', { name: 'Acciones para Paciente Demo Aurora' }).click();
  await expect(page.getByRole('button', { name: 'Nuevo' })).toHaveCount(0);
});

test('CH10 denies the medical-order direct route to FINANCE', async ({ page }) => {
  await page.goto('/login?next=%2Fclinical%2Forders');
  await page.getByLabel('Usuario o correo').fill('finance@demo.local');
  await page.getByLabel('Clave').fill('demo-finance');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByText('Acceso restringido para el rol FINANCE.', { exact: true })).toBeVisible();
});
