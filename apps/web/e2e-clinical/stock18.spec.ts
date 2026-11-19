import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

async function post(page: Page, path: string, payload: unknown) {
  const response = await page.evaluate(
    async ({ path, payload }) => {
      const csrf = await (await fetch('/api/auth/csrf')).json();
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-analiza-csrf': csrf.csrfToken },
        body: JSON.stringify(payload),
      });
      return { status: response.status, error: response.ok ? null : (await response.json()).error };
    },
    { path, payload },
  );
  expect(response.status, response.error ?? path).toBeLessThan(300);
}
test('inventory mobile completes a warehouse transfer, loan, partial return and supplier contact', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(150000);
  expect(new URL(baseURL!).hostname).toBe('127.0.0.1');
  expect(process.env.ANALIZA_QA_MODE).toBe('1');
  const secret = process.env.ANALIZA_QA_PASSWORD;
  if (!secret) throw new Error('Ejecute la prueba con la base sintética aislada.');
  const screenshots = resolve('.local/qa-stock18-screenshots');
  mkdirSync(screenshots, { recursive: true });
  const run = randomUUID().slice(0, 7);
  const id = (name: string) => `equipo-qa-${name}-${run}`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login?next=%2Finventory');
  await page.getByLabel('Usuario o correo').fill('qa-admin-b@example.test');
  await page.getByLabel('Clave').fill(secret);
  const [login] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Iniciar sesión' }).click(),
  ]);
  expect(login.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Existencias', exact: true })).toBeVisible();
  await post(page, '/api/patients', {
    patient: {
      id: id('paciente'),
      fullName: `Paciente sintético ${run}`,
      documentType: 'OTHER',
      documentId: id('document'),
      referralOrigin: 'FAMILY_FRIENDS',
      dependents: [],
    },
  });
  for (const suffix of ['origen', 'destino'])
    await post(page, '/api/operations', {
      command: 'warehouse.save',
      warehouse: { id: id(suffix), code: id(suffix), name: id(suffix), status: 'ACTIVE' },
    });
  await post(page, '/api/operations', {
    command: 'catalog.save',
    item: {
      id: id('item'),
      sku: id('sku'),
      name: id('item'),
      category: 'EQUIPMENT',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    },
  });
  const key = randomUUID();
  await post(page, '/api/operations', {
    command: 'inventory.record',
    movement: {
      id: key,
      itemId: id('item'),
      warehouseId: id('origen'),
      quantity: 4,
      kind: 'ENTRY',
      reason: 'Entrada manual',
      createdAt: new Date().toISOString(),
    },
    idempotencyKey: key,
  });
  await page.reload();
  await page.getByLabel('Buscar inventario').fill(id('item'));
  const row = page.getByRole('row').filter({ hasText: id('origen') });
  await row.getByRole('button', { name: 'Generar traslado' }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Bodega de origen')).toHaveValue(id('origen'));
  await dialog.getByLabel('Bodega de destino').selectOption(id('destino'));
  await dialog.getByLabel('Cantidad').fill('1');
  await dialog.getByRole('button', { name: 'Confirmar traslado' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row.locator('[data-stock-label="Disponible"]')).toHaveText('3');
  await page.screenshot({ path: resolve(screenshots, 'existencias-movil.png') });
  const noOverflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  expect(await noOverflow()).toBe(true);
  await page.goto('/inventory/movements');
  await expect(page).toHaveURL(/\/inventory\/home-deliveries$/);
  await page.getByRole('button', { name: 'Registrar nueva ubicación' }).click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByRole('combobox', { name: 'Paciente', exact: true })
    .selectOption({ label: `Paciente sintético ${run}` });
  await dialog.getByRole('combobox', { name: 'Ítem', exact: true }).selectOption(id('item'));
  await dialog.getByRole('combobox', { name: 'Bodega', exact: true }).selectOption(id('origen'));
  await dialog.getByLabel('Cantidad').fill('2');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel('Buscar paciente, equipo o bodega').fill(id('item'));
  await page.getByRole('button', { name: 'Registrar devolución' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Tipo de movimiento')).toHaveValue('Devolución');
  await expect(dialog.getByLabel('Cantidad')).toHaveAttribute('max', '2');
  await dialog.getByLabel('Cantidad').fill('1');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Paciente sintético ' + run })).toHaveCount(
    2,
  );
  await page.screenshot({ path: resolve(screenshots, 'devolucion-movil.png') });
  expect(await noOverflow()).toBe(true);
  await page.getByRole('button', { name: 'Registrar devolución' }).click();
  await expect(page.getByRole('dialog').getByLabel('Cantidad')).toHaveAttribute('max', '1');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await page.goto('/inventory/kardex');
  await page.getByLabel('Documento o paciente').fill(`Paciente sintético ${run}`);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('tbody')).toContainText('Devolución en cuarentena');
  await page.getByRole('heading', { name: 'Detalle del Kárdex' }).scrollIntoViewIfNeeded();
  await page.locator('.inventory-ledger-table').scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(screenshots, 'kardex-movil.png') });
  expect(await noOverflow()).toBe(true);
  await page.goto('/inventory/suppliers');
  await page.getByRole('button', { name: 'Nuevo proveedor' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre de la empresa').fill(id('proveedor'));
  await dialog.getByLabel('Contacto', { exact: true }).fill('Equipo sintético QA');
  await dialog.getByLabel('Teléfono fijo').fill('0000-0000');
  await dialog.getByLabel('Correo', { exact: true }).fill('qa@example.invalid');
  await dialog.getByLabel('Dirección', { exact: true }).fill('Dirección sintética');
  await dialog.getByRole('button', { name: 'Guardar proveedor' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByLabel('Buscar proveedor').fill(id('proveedor'));
  await expect(page.getByRole('row').filter({ hasText: id('proveedor') })).toContainText(
    'Dirección sintética',
  );
});
