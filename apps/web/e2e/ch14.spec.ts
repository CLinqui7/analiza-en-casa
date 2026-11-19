import { expect, test } from '@playwright/test';

// test-id: playwright:ch14-inventory-factual-list
// test-id: playwright:ch14-inventory-permissions
// test-id: playwright:ch14-inventory-item-history
// test-id: playwright:ch14-inventory-acknowledgements
// test-id: playwright:ch14-inventory-closures
// test-id: playwright:ch14-inventory-suppliers
// test-id: playwright:ch14-inventory-supplier-permissions
// test-id: playwright:ch14-inventory-warehouses
// test-id: playwright:ch14-inventory-warehouse-permissions
// test-id: playwright:ch14-inventory-traceability
// test-id: playwright:ch14-inventory-kits
// test-id: playwright:ch14-inventory-kit-permissions

async function login(
  page: import('@playwright/test').Page,
  email = 'admin@demo.local',
  password = 'demo-admin',
) {
  await page.goto('/login?next=%2Finventory');
  await page.getByLabel('Usuario o correo').fill(email);
  await page.getByLabel('Clave').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test('CH14 lists only factual synthetic balances and keeps undefined inventory operations disabled', async ({
  page,
}) => {
  await login(page);
  await expect(page).toHaveURL(/\/inventory$/);
  const auditBefore = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );
  await expect(page.getByRole('button', { name: 'Ítems', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  for (const header of [
    'Acciones',
    'Tipo',
    'Código',
    'Nombre',
    'Bodega',
    'Disponible',
    'Retenido',
    'Vencido',
    'Total físico',
  ])
    await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
  // The current synthetic seed also includes the explicitly inert medication SKU.
  // Check all three rows instead of silently dropping the new selector fixture.
  await expect(
    page.getByRole('navigation', { name: 'Secciones de existencias' }).locator('a,button'),
  ).toHaveText(['Ítems', 'Proveedores', 'Bodegas']);
  const inertMedication = page.getByRole('row').filter({ hasText: 'MED-QA-001' });
  await expect(inertMedication).toHaveCount(1);
  await expect(inertMedication.getByRole('cell', { name: '100', exact: true })).toHaveCount(2);
  await expect(inertMedication.getByRole('button', { name: 'Generar traslado' })).toBeDisabled();
  await page.getByLabel('Buscar inventario').fill('sin-inventario-ch14');
  await expect(page.locator('tbody .empty-state')).toContainText('Sin ítems documentados');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-inventario-ch14');
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
    )
    .toBe(auditBefore);
});

test('CH14 grants factual inventory access to INVENTORY and denies NURSE directly', async ({
  browser,
}) => {
  const inventory = await browser.newPage();
  await login(inventory, 'inventory@demo.local', 'demo-inventory');
  await expect(inventory.getByRole('heading', { name: 'Existencias' })).toBeVisible();
  await expect(inventory.getByLabel('Buscar inventario')).toBeVisible();
  const nurse = await browser.newPage();
  await login(nurse, 'nurse@demo.local', 'demo-nurse');
  await expect(nurse.locator('main[role="alert"]')).toContainText(
    'Acceso restringido para el rol NURSE',
  );
  await expect(nurse.getByRole('heading', { name: 'Existencias' })).toHaveCount(0);
  await expect(nurse.locator('[data-action-id="INVENTORY-ITEM-HISTORY-OPEN"]')).toHaveCount(0);
  await expect(nurse.locator('[data-action-id="INVENTORY-ACKNOWLEDGEMENTS-OPEN"]')).toHaveCount(0);
  await expect(nurse.locator('[data-action-id="INVENTORY-CLOSURES-OPEN"]')).toHaveCount(0);
  await expect(nurse.locator('[data-action-id="INVENTORY-SUPPLIERS-OPEN"]')).toHaveCount(0);
  await inventory.close();
  await nurse.close();
});

test('CH14 opens an item-scoped factual history and filters existing movement dates without mutation', async ({
  page,
}) => {
  await login(page);
  const auditBefore = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );
  await page
    .getByRole('row')
    .filter({ hasText: 'KIT-DEMO-001' })
    .locator('[data-action-id="INVENTORY-ITEM-HISTORY-OPEN"]')
    .click();
  const dialog = page.getByRole('dialog', { name: 'Movimientos del ítem' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Código')).toHaveValue('KIT-DEMO-001');
  for (const header of [
    'Tipo',
    'Fecha',
    'Lote / Serie',
    'Origen',
    'Destino',
    'Cantidad',
    'Movimiento',
    'Estado',
  ])
    await expect(dialog.getByRole('columnheader', { name: header })).toBeVisible();
  await expect(dialog.locator('tbody tr')).toHaveCount(2);
  await dialog.getByLabel('Desde').fill('2026-08-28');
  await expect(dialog.locator('tbody tr')).toHaveCount(1);
  await expect(dialog.locator('tbody tr')).toContainText('EXIT');
  await dialog.getByLabel('Hasta').fill('2026-08-27');
  await expect(dialog.getByText('Sin movimientos en el rango')).toBeVisible();
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
    )
    .toBe(auditBefore);
  await expect(page.getByRole('dialog', { name: 'Movimientos del ítem' })).toHaveCount(0);
});

test('CH14 preserves supplier contacts in the dedicated directory without mutating on search', async ({
  browser,
}) => {
  const admin = await browser.newPage();
  await login(admin);
  const auditBefore = await admin.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );
  await admin.locator('[data-action-id="INVENTORY-SUPPLIERS-OPEN"]').click();
  await expect(admin.getByRole('heading', { name: 'Proveedores', exact: true })).toBeVisible();
  await expect(admin.locator('[data-action-id="INVENTORY-SUPPLIERS-CREATE"]')).toBeEnabled();
  await expect(admin.getByRole('table', { name: 'Proveedores', exact: true })).toBeVisible();
  for (const name of ['Contacto', 'Teléfonos', 'Correo', 'Dirección']) {
    await expect(admin.getByRole('columnheader', { name, exact: true })).toBeVisible();
  }
  await expect(admin.getByText('Proveedor sintético de QA')).toBeVisible();
  await admin.getByLabel('Buscar proveedor', { exact: true }).fill('sin-proveedor-ch14');
  await expect(admin.getByText('Sin proveedores', { exact: true })).toBeVisible();
  await admin.reload();
  await expect
    .poll(() =>
      admin.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
    )
    .toBe(auditBefore);
  await admin.close();
  const inventory = await browser.newPage();
  await login(inventory, 'inventory@demo.local', 'demo-inventory');
  await inventory.locator('[data-action-id="INVENTORY-SUPPLIERS-OPEN"]').click();
  await expect(inventory.getByText('Proveedor sintético de QA')).toBeVisible();
  await inventory.close();
});

test('CH14 lets AUDITOR search the empty supplier surface without mutation', async ({ page }) => {
  await login(page, 'auditor@demo.local', 'demo-auditor');
  const auditBefore = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );
  await page.locator('[data-action-id="INVENTORY-SUPPLIERS-OPEN"]').click();
  await expect(page.getByRole('heading', { name: 'Proveedores', exact: true })).toBeVisible();
  await expect(page.locator('[data-action-id="INVENTORY-SUPPLIERS-CREATE"]')).toHaveCount(0);
  await page.getByLabel('Buscar proveedor', { exact: true }).fill('sin-proveedor-auditor');
  await expect(page.getByText('Sin proveedores', { exact: true })).toBeVisible();
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
    )
    .toBe(auditBefore);
});

test('CH14 denies DOCTOR direct inventory supplier access', async ({ page }) => {
  await login(page, 'doctor@demo.local', 'demo-doctor');
  await expect(page).toHaveURL(/\/clinical\/hospitalizations$/);
  await page.goto('/inventory/suppliers');
  await expect(page.locator('main[role="alert"]')).toContainText('DOCTOR');
  await expect(page.locator('[data-action-id="INVENTORY-SUPPLIERS-OPEN"]')).toHaveCount(0);
});

test('CH14 denies FINANCE direct inventory supplier access', async ({ page }) => {
  await login(page, 'finance@demo.local', 'demo-finance');
  await expect(page.locator('main[role="alert"]')).toContainText('FINANCE');
  await expect(page.locator('[data-action-id="INVENTORY-SUPPLIERS-OPEN"]')).toHaveCount(0);
});

test('CH14 renders registered warehouses and keeps server writes disabled in mock mode', async ({
  page,
}) => {
  await login(page);
  const auditBefore = await page.evaluate(() =>
    localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries'),
  );
  await page.locator('[data-action-id="INVENTORY-WAREHOUSES-OPEN"]').click();
  await expect(page.getByRole('heading', { name: 'Existencias' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bodegas', exact: true })).toBeVisible();
  await expect(page.getByLabel('Estado de bodegas')).toBeEnabled();
  await expect(page.getByLabel('Estado de bodegas')).toHaveValue('ALL');
  await expect(page.locator('[data-action-id="INVENTORY-WAREHOUSE-CREATE"]')).toBeDisabled();
  await expect(page.getByRole('columnheader', { name: 'Nombre' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Descripción' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Estado' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Actualización' })).toBeVisible();
  await expect(page.getByText('Bodega central demo')).toBeVisible();
  await expect(page.getByText('Bodega norte demo')).toBeVisible();
  await page.getByLabel('Buscar bodegas').fill('sin-bodega-ch14');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-bodega-ch14');
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('analiza.en.casa.workspace.v3.auditEntries')),
    )
    .toBe(auditBefore);
});

test('CH14 lets INVENTORY open the registered Bodegas surface', async ({ page }) => {
  await login(page, 'inventory@demo.local', 'demo-inventory');
  await page.locator('[data-action-id="INVENTORY-WAREHOUSES-OPEN"]').click();
  await expect(page.getByText('Bodega central demo')).toBeVisible();
});

test('CH14 lets AUDITOR search the empty Bodegas surface', async ({ page }) => {
  await login(page, 'auditor@demo.local', 'demo-auditor');
  await page.locator('[data-action-id="INVENTORY-WAREHOUSES-OPEN"]').click();
  await page.getByLabel('Buscar bodegas').fill('sin-bodega-auditor');
  await expect(page.locator('tbody .empty-state')).toContainText('sin-bodega-auditor');
});

test('CH14 denies DOCTOR direct inventory warehouse access', async ({ page }) => {
  await login(page, 'doctor@demo.local', 'demo-doctor');
  await expect(page).toHaveURL(/\/clinical\/hospitalizations$/);
  await page.goto('/inventory');
  await expect(page.locator('main[role="alert"]')).toContainText('DOCTOR');
  await expect(page.locator('[data-action-id="INVENTORY-WAREHOUSES-OPEN"]')).toHaveCount(0);
});

test('CH14 denies NURSE direct inventory warehouse access', async ({ page }) => {
  await login(page, 'nurse@demo.local', 'demo-nurse');
  await expect(page.locator('main[role="alert"]')).toContainText('NURSE');
  await expect(page.locator('[data-action-id="INVENTORY-WAREHOUSES-OPEN"]')).toHaveCount(0);
});

test('CH14 denies FINANCE direct inventory warehouse access', async ({ page }) => {
  await login(page, 'finance@demo.local', 'demo-finance');
  await expect(page.locator('main[role="alert"]')).toContainText('FINANCE');
  await expect(page.locator('[data-action-id="INVENTORY-WAREHOUSES-OPEN"]')).toHaveCount(0);
});

test('CH14 exposes traceability controls without inventing received stock in mock mode', async ({
  page,
}) => {
  await login(page);
  await page.goto('/inventory/kardex');
  await page.getByRole('link', { name: 'Control de lotes y series' }).click();
  await expect(
    page.getByRole('heading', { name: 'Lotes y números de serie', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Sin lotes', { exact: true })).toBeVisible();
  await expect(page.getByText(/Toda recepción inicia en cuarentena/)).toBeVisible();
  await page.locator('[data-action-id="INVENTORY-SERIALS-TAB"]').click();
  await expect(page.getByText('Sin números de serie', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Vencimiento' })).toBeVisible();
  await expect(page.locator('[data-action-id="INVENTORY-TRACE-RECEIVE"]')).toBeDisabled();
  await expect(page.locator('[data-action-id="INVENTORY-TRACE-ISSUE"]')).toBeDisabled();
});

test('CH14 prior legacy panels stay out of the stock navigation for operational and read-only roles', async ({
  browser,
}) => {
  for (const [email, password] of [
    ['inventory@demo.local', 'demo-inventory'],
    ['auditor@demo.local', 'demo-auditor'],
  ]) {
    const page = await browser.newPage();
    await login(page, email, password);
    const stock = page.getByRole('navigation', { name: 'Secciones de existencias' });
    await expect(stock.locator('a,button')).toHaveText(['Ítems', 'Proveedores', 'Bodegas']);
    for (const label of [
      'Acuses',
      'Cierres',
      'Kit de insumos',
      'Movimientos',
      'Comprometido',
      'Lotes',
    ])
      await expect(stock.getByText(label, { exact: true })).toHaveCount(0);
    await page.close();
  }
});

test('CH14 shows patient and document in the ledger, and only the three manual movement types', async ({
  page,
}) => {
  await login(page);
  await page.goto('/inventory/kardex');
  for (const name of [
    'Paciente',
    'Responsable',
    'Entrada disponible',
    'Salida disponible',
    'Saldo disponible',
  ])
    await expect(page.getByRole('columnheader', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Referencia', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Registrar movimiento' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Tipo de movimiento').locator('option')).toHaveText([
    'Entrada',
    'Salida',
    'Devolución',
  ]);
  for (const label of ['Referencia', 'Motivo'])
    await expect(dialog.getByLabel(label, { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await page.goto('/inventory/movements');
  await expect(page).toHaveURL(/\/inventory\/home-deliveries$/);
  await expect(
    page.getByRole('heading', { name: 'Ubicación de equipo e instrumentos por paciente' }),
  ).toBeVisible();
});
