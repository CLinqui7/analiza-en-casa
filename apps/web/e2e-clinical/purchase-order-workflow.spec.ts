import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('orden aprobada, recepción parcial y aprobación financiera son acciones separadas', async ({
  page,
}) => {
  test.setTimeout(140_000);
  const run = randomUUID().slice(0, 8);
  await page.goto('/login?next=%2Fpurchase-orders');
  await page.getByLabel('Usuario o correo').fill('qa-admin@example.test');
  await page.getByLabel('Clave').fill(process.env.ANALIZA_QA_PASSWORD!);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Órdenes de compra', exact: true })).toBeVisible();
  const item = 'Insumo QA ' + run,
    supplier = 'Proveedor QA ' + run;
  await page.evaluate(
    async ({ run, item, supplier }) => {
      const { csrfToken } = await (await fetch('/api/auth/csrf')).json();
      for (const [suffix, name, category] of [
        ['p', supplier, 'PROVIDERS'],
        ['i', item, 'SUPPLIES'],
      ]) {
        const result = await fetch('/api/operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-analiza-csrf': csrfToken },
          body: JSON.stringify({
            command: 'catalog.save',
            item: {
              id: 'qa-' + suffix + run,
              sku: 'QA-' + suffix + run,
              name,
              category,
              status: 'ACTIVE',
              costPrice: 2.125,
              createdAt: new Date().toISOString(),
            },
          }),
        });
        if (!result.ok)
          throw new Error('No se pudo crear el catálogo sintético HTTP ' + result.status);
      }
    },
    { run, item, supplier },
  );
  await page.reload();
  await page.getByRole('combobox', { name: 'Proveedor de la orden' }).fill(supplier);
  await page.getByRole('option', { name: supplier, exact: true }).click();
  await page.getByRole('combobox', { name: 'Producto de la orden' }).fill(item);
  await page.getByRole('option', { name: new RegExp(item) }).click();
  await expect(page.getByLabel('Precio de referencia por unidad')).toHaveValue('2.125');
  await page.getByLabel('Cantidad entera').fill('5');
  await page.getByRole('button', { name: 'Agregar producto' }).click();
  await page.getByRole('button', { name: 'Guardar orden', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: supplier });
  await row.getByRole('button', { name: 'Editar orden' }).click();
  await expect(page.getByRole('heading', { name: 'Editar orden de compra' })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await row.getByRole('button', { name: 'Aprobar', exact: true }).click();
  await expect(row).toContainText('Aprobada');
  await page.goto('/purchases');
  await expect(page.getByRole('button', { name: 'Nueva compra' })).toHaveCount(0);
  const approved = page
    .getByRole('row')
    .filter({ hasText: supplier })
    .filter({ has: page.getByRole('button', { name: 'Recibir líneas' }) });
  await approved.getByRole('button', { name: 'Recibir líneas' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Bodega destino').selectOption('KIT');
  await dialog.getByLabel('Tipo de documento').selectOption('FISCAL_CREDIT');
  await dialog.getByLabel('Número de crédito fiscal').fill('CF-' + run);
  await dialog.getByLabel('Cantidad recibida').fill('4');
  await dialog.getByLabel('Lote').fill('QA-' + run);
  await dialog.getByLabel('Fecha de vencimiento').fill('2030-01-01');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.getByRole('button', { name: 'Guardar recepción' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await dialog.getByRole('button', { name: 'Guardar recepción' }).click();
  await expect(dialog).toHaveCount(0);
  const receipt = page.getByRole('row').filter({ hasText: 'CF-' + run });
  await expect(receipt).toContainText('9.61');
  const href = await receipt.getByRole('link', { name: 'Descargar PDF' }).getAttribute('href');
  expect(href).toBeTruthy();
  const pdf = await page.evaluate(async (url) => {
    const result = await fetch(url);
    const bytes = new Uint8Array(await result.arrayBuffer());
    return { status: result.status, header: String.fromCharCode(...bytes.subarray(0, 5)) };
  }, href!);
  expect(pdf).toEqual({ status: 200, header: '%PDF-' });

  await page.goto('/payables');
  const invoice = page.getByRole('row').filter({ hasText: 'CF-' + run });
  await expect(invoice).toContainText('pendiente de aprobación');
  await invoice.getByRole('button', { name: 'Aprobar factura' }).click();
  await expect(invoice).toContainText('Aprobada');
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: 'CF-' + run })).toHaveCount(1);
});
