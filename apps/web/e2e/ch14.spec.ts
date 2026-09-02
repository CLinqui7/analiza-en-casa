import { expect, test } from '@playwright/test';

// test-id: playwright:ch14-inventory-factual-list
// test-id: playwright:ch14-inventory-permissions
// test-id: playwright:ch14-inventory-item-history
// test-id: playwright:ch14-inventory-acknowledgements
// test-id: playwright:ch14-inventory-closures
// test-id: playwright:ch14-inventory-suppliers

async function login(page: import('@playwright/test').Page, email = 'admin@demo.local', password = 'demo-admin') {
  await page.goto('/login?next=%2Finventory');
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test('CH14 lists only factual synthetic balances and keeps undefined inventory operations disabled', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/inventory$/);
  const auditBefore = await page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'));
  await expect(page.getByText('Items', { exact: true })).toHaveAttribute('aria-current', 'page');
  for (const header of ['Acciones', 'Tipo', 'Código', 'Nombre', 'Bodega', 'Disp', 'Comp', 'Total']) await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
  await expect(page.getByText('No definido')).toHaveCount(2);
  await expect(page.getByText('No calculable')).toHaveCount(2);
  await expect(page.locator('[data-action-id="INVENTORY-ITEM-EXPORT"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="INVENTORY-TRANSFERS"]')).toBeDisabled();
  await page.getByLabel('Buscar inventario').fill('sin-inventario-ch14');
  await expect(page.locator('tbody .empty-state')).toContainText('Sin ítems documentados');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-inventario-ch14');
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'))).toBe(auditBefore);
});

test('CH14 grants factual inventory access to INVENTORY and denies NURSE directly', async ({ browser }) => {
  const inventory = await browser.newPage();
  await login(inventory, 'inventory@demo.local', 'demo-inventory');
  await expect(inventory.getByRole('heading', { name: 'Gestión de inventario' })).toBeVisible();
  await expect(inventory.getByLabel('Buscar inventario')).toBeVisible();
  const nurse = await browser.newPage();
  await login(nurse, 'nurse@demo.local', 'demo-nurse');
  await expect(nurse.locator('main[role="alert"]')).toContainText('Acceso restringido para el rol NURSE');
  await expect(nurse.getByRole('heading', { name: 'Gestión de inventario' })).toHaveCount(0);
  await expect(nurse.locator('[data-action-id="INVENTORY-ITEM-HISTORY-OPEN"]')).toHaveCount(0);
  await expect(nurse.locator('[data-action-id="INVENTORY-ACKNOWLEDGEMENTS-OPEN"]')).toHaveCount(0);
  await expect(nurse.locator('[data-action-id="INVENTORY-CLOSURES-OPEN"]')).toHaveCount(0);
  await expect(nurse.locator('[data-action-id="INVENTORY-SUPPLIERS-OPEN"]')).toHaveCount(0);
  await inventory.close();
  await nurse.close();
});

test('CH14 opens an item-scoped factual history and filters existing movement dates without mutation', async ({ page }) => {
  await login(page);
  const auditBefore = await page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'));
  await page.locator('[data-action-id="INVENTORY-ITEM-HISTORY-OPEN"]').first().click();
  const dialog = page.getByRole('dialog', { name: 'Movimientos de item' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Código')).toHaveValue('KIT-DEMO-001');
  for (const header of ['Tipo', 'Fecha', 'Lote / Serie', 'Origen', 'Destino', 'Cantidad', 'Movimiento', 'Estado']) await expect(dialog.getByRole('columnheader', { name: header })).toBeVisible();
  await expect(dialog.locator('tbody tr')).toHaveCount(2);
  await dialog.getByLabel('Desde').fill('2026-08-28');
  await expect(dialog.locator('tbody tr')).toHaveCount(1);
  await expect(dialog.locator('tbody tr')).toContainText('EXIT');
  await dialog.getByLabel('Hasta').fill('2026-08-27');
  await expect(dialog.getByText('Sin movimientos en el rango')).toBeVisible();
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'))).toBe(auditBefore);
  await expect(page.getByRole('dialog', { name: 'Movimientos de item' })).toHaveCount(0);
});

test('CH14 shows the read-only Acuses anatomy and factual empty sources without mutation', async ({ page }) => {
  await login(page);
  const auditBefore = await page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'));
  await page.locator('[data-action-id="INVENTORY-ACKNOWLEDGEMENTS-OPEN"]').click();
  await expect(page.getByRole('heading', { name: 'Inventario / Acuses' })).toBeVisible();
  await expect(page.getByLabel('Tipo Área')).toBeDisabled();
  await expect(page.locator('[data-action-id="INVENTORY-ACK-TAB-PATIENTS"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('columnheader', { name: 'ID', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Acciones' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Identificación' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Paciente' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Empresa' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Estado' })).toBeVisible();
  await expect(page.getByText('Sin pacientes documentados')).toBeVisible();
  await expect(page.getByText('Paciente Demo Aurora')).toHaveCount(0);
  await page.locator('[data-action-id="INVENTORY-ACK-TAB-RESOURCES"]').click();
  await expect(page.getByText('Sin recursos documentados')).toBeVisible();
  await page.locator('[data-action-id="INVENTORY-ACK-TAB-UNAVAILABLE"]').click();
  await expect(page.getByText('Sin registros no disponibles')).toBeVisible();
  await page.locator('[data-action-id="INVENTORY-ACK-TAB-REQUESTS"]').click();
  await expect(page.getByText('Sin solicitudes documentadas')).toBeVisible();
  await page.locator('[data-action-id="INVENTORY-ACK-TAB-TASKS"]').click();
  await expect(page.getByText('Sin tareas documentadas')).toBeVisible();
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'))).toBe(auditBefore);
});

test('CH14 Acuses does not source patient or case data for any inventory reader', async ({ browser }) => {
  const admin = await browser.newPage();
  await login(admin);
  await admin.locator('[data-action-id="INVENTORY-ACKNOWLEDGEMENTS-OPEN"]').click();
  await expect(admin.getByText('Sin pacientes documentados')).toBeVisible();
  await expect(admin.getByText('Paciente Demo Aurora')).toHaveCount(0);
  await admin.close();
  const inventory = await browser.newPage();
  await login(inventory, 'inventory@demo.local', 'demo-inventory');
  await inventory.locator('[data-action-id="INVENTORY-ACKNOWLEDGEMENTS-OPEN"]').click();
  await expect(inventory.getByText('Sin pacientes documentados')).toBeVisible();
  await expect(inventory.getByRole('columnheader', { name: 'Paciente' })).toBeVisible();
  await expect(inventory.getByText('Paciente Demo Aurora')).toHaveCount(0);
  await inventory.close();
});

test('CH14 exposes read-only Cierres tabs with factual empty sources and no audit mutation', async ({ page }) => {
  await login(page);
  const auditBefore = await page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'));
  await page.locator('[data-action-id="INVENTORY-CLOSURES-OPEN"]').click();
  await expect(page.getByRole('heading', { name: 'Inventario / Cierres' })).toBeVisible();
  await expect(page.locator('[data-action-id="INVENTORY-CLOSURES-TAB-PENDING"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Pacientes activos' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Acciones' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'DUI/NIT' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Paciente' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Empresa' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Estado' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Fecha de inicio' })).toBeVisible();
  await expect(page.getByText('Sin cierres documentados')).toBeVisible();
  await expect(page.getByText('Paciente Demo Aurora')).toHaveCount(0);
  await page.locator('[data-action-id="INVENTORY-CLOSURES-TAB-TOTALS"]').click();
  await expect(page.getByText('Sin cierres totales documentados')).toBeVisible();
  await page.locator('[data-action-id="INVENTORY-CLOSURES-TAB-CLOSED"]').click();
  await expect(page.getByText('Sin cierres cerrados documentados')).toBeVisible();
  await page.locator('[data-action-id="INVENTORY-CLOSURES-TAB-RESOURCES"]').click();
  await expect(page.getByText('Sin recursos de cierre documentados')).toBeVisible();
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'))).toBe(auditBefore);
});

test('CH14 exposes an empty read-only supplier list without supplier mutations', async ({ browser }) => {
  const admin = await browser.newPage();
  await login(admin);
  const auditBefore = await admin.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'));
  await admin.locator('[data-action-id="INVENTORY-SUPPLIERS-OPEN"]').click();
  await expect(admin.getByRole('heading', { name: 'Inventario / Proveedores' })).toBeVisible();
  await expect(admin.getByRole('heading', { name: 'Proveedores', exact: true })).toBeVisible();
  await expect(admin.locator('[data-action-id="INVENTORY-SUPPLIERS-CREATE"]')).toBeDisabled();
  await expect(admin.getByLabel('Registros de proveedores por página')).toBeDisabled();
  await expect(admin.locator('[data-action-id="INVENTORY-SUPPLIERS-PAGE-PREV"]')).toBeDisabled();
  await expect(admin.locator('[data-action-id="INVENTORY-SUPPLIERS-PAGE-NEXT"]')).toBeDisabled();
  await expect(admin.getByRole('columnheader', { name: 'Código' })).toBeVisible();
  await expect(admin.getByRole('columnheader', { name: 'Empresa' })).toBeVisible();
  await expect(admin.getByRole('columnheader', { name: 'Contacto' })).toBeVisible();
  await expect(admin.getByRole('columnheader', { name: 'Teléfono' })).toBeVisible();
  await expect(admin.getByRole('columnheader', { name: 'Correo' })).toBeVisible();
  await expect(admin.getByRole('columnheader', { name: 'Dirección' })).toBeVisible();
  await expect(admin.getByText('Sin proveedores documentados')).toBeVisible();
  await admin.getByLabel('Buscar proveedores').fill('sin-proveedor-ch14');
  await expect(admin.locator('tbody .empty-state')).toContainText('sin-proveedor-ch14');
  await admin.reload();
  await expect.poll(() => admin.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'))).toBe(auditBefore);
  await admin.close();
  const inventory = await browser.newPage();
  await login(inventory, 'inventory@demo.local', 'demo-inventory');
  await inventory.locator('[data-action-id="INVENTORY-SUPPLIERS-OPEN"]').click();
  await expect(inventory.getByText('Sin proveedores documentados')).toBeVisible();
  await inventory.close();
});
