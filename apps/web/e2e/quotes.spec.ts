import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page, email = 'admin@demo.local', password = 'demo-admin') {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function openNewQuote(page: import('@playwright/test').Page) {
  await page.goto('/quotes');
  await page.getByRole('button', { name: 'Nueva cotización' }).click();
  return page.getByRole('dialog', { name: 'Nueva cotización' });
}

test('quotes list searches normalized id, patient, case and status, then clears', async ({ page }) => {
  await login(page); await page.goto('/quotes');
  const search = page.getByLabel('Buscar cotización');
  await search.fill('quote demo 001'); await expect(page.getByText('quote-demo-001')).toBeVisible();
  await search.fill('Áurora'); await expect(page.getByText('quote-demo-001')).toBeVisible();
  await search.fill('case demo 001'); await expect(page.getByText('quote-demo-001')).toBeVisible();
  await search.fill('draft'); await expect(page.getByText('quote-demo-001')).toBeVisible();
  await search.fill('no existe QA'); await expect(page.getByText('Sin resultados', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).click(); await expect(search).toHaveValue('');
});

test('quote builder persists all categories, calculations, edit, send, revision and related actions', async ({ page }) => {
  await login(page);
  let dialog = await openNewQuote(page);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  dialog = await openNewQuote(page);
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(dialog.getByText('El resumen operativo es obligatorio.')).toBeVisible();
  await dialog.getByLabel('Resumen operativo').fill('Cotización QA integral');
  await dialog.getByLabel('Comentarios').fill('Comentario QA persistente');
  for (const category of ['Servicios', 'Estudios diagnósticos', 'Medicamentos', 'Insumos', 'Equipos', 'Honorarios', 'Extras']) {
    await dialog.getByRole('tab', { name: category }).click();
    await dialog.getByLabel('Concepto').fill(`Concepto ${category}`);
    await dialog.getByLabel('Cantidad').fill('1');
    await dialog.getByLabel('Precio manual').fill('10');
    await dialog.getByLabel('Descuento manual').fill('1');
    await dialog.locator('[data-action-id="QUOTE-ITEM-ADD"]').click();
  }
  await dialog.getByRole('tab', { name: 'Servicios' }).click();
  await dialog.getByRole('button', { name: 'Editar' }).click();
  await dialog.getByLabel('Cantidad').fill('2');
  await dialog.getByRole('button', { name: 'Actualizar línea' }).click();
  await dialog.getByRole('tab', { name: 'Extras' }).click();
  await dialog.getByRole('button', { name: 'Eliminar' }).click();
  await dialog.getByLabel('Tipo').selectOption('PERCENT');
  await dialog.getByLabel('Porcentaje de descuento').fill('10');
  await dialog.getByLabel('Responsabilidad explícita de aseguradora').fill('5');
  await expect(dialog.getByLabel('Totales de cotización')).toContainText('USD 57.60');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('status')).toContainText('Borrador de cotización persistido');
  await expect(page).toHaveURL(/\/quotes$/);
  await page.reload(); await page.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').last().click();
  await expect(page.getByText('Comentario QA persistente')).toBeVisible();
  await expect(page.getByText('Concepto Servicios')).toBeVisible();
  await page.getByRole('button', { name: 'Editar borrador' }).click();
  dialog = page.getByRole('dialog', { name: /Editar borrador/ });
  await dialog.getByLabel('Resumen operativo').fill('Cotización QA editada');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('status')).toContainText('actualizado y persistido');
  await expect(page).toHaveURL(/\/quotes$/);
  await page.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').last().click();
  await page.getByRole('button', { name: 'Enviar versión' }).click();
  await expect(page.getByRole('status')).toContainText('inmutable'); await page.reload();
  await expect(page.getByRole('button', { name: 'Editar borrador' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enviar versión' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Revisar / nueva versión' }).click();
  dialog = page.getByRole('dialog', { name: /Revisar/ });
  await page.getByRole('button', { name: 'Crear revisión' }).click();
  await expect(dialog.getByText('El motivo de revisión es obligatorio.')).toBeVisible();
  await dialog.getByLabel('Motivo de revisión').fill('Ajuste QA documentado');
  await page.getByRole('button', { name: 'Crear revisión' }).click();
  await expect(page.getByRole('status')).toContainText('Nueva versión');
  await expect(page).toHaveURL(/\/quotes$/);
  await page.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').last().click();
  await expect(page.getByRole('cell', { name: 'Ajuste QA documentado' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'v1' })).toBeVisible(); await expect(page.getByRole('cell', { name: 'v2' })).toBeVisible();
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printCalled = 'true'; }; });
  await page.getByRole('button', { name: 'Imprimir' }).click(); await expect(page.locator('html')).toHaveAttribute('data-print-called', 'true');
  await page.getByRole('button', { name: 'Abrir seguro' }).click(); await expect(page).toHaveURL(/\/insurance\?quote=/);
  await page.goBack(); await page.getByRole('button', { name: 'Abrir pagos' }).click(); await expect(page).toHaveURL(/\/payments\?quote=/);
  await page.goBack(); await page.getByRole('button', { name: 'Enviar WhatsApp' }).click(); await expect(page.getByRole('status')).toContainText('Proveedor de mensajería no configurado');
  await page.getByRole('button', { name: 'Copiar enlace portal' }).click(); await expect(page.getByRole('status')).toContainText('Portal seguro no configurado');
});

test('quote permissions keep auditor read-only and mobile has no horizontal overflow', async ({ browser }) => {
  const auditorContext = await browser.newContext(); const auditor = await auditorContext.newPage();
  await login(auditor, 'auditor@demo.local', 'demo-auditor'); await auditor.goto('/quotes');
  await expect(auditor.getByRole('button', { name: 'Nueva cotización' })).toHaveCount(0);
  await auditor.locator('[data-action-id="QUOTE-DETAIL-NAVIGATE"]').first().click();
  await expect(auditor.getByRole('button', { name: 'Editar borrador' })).toHaveCount(0);
  await expect(auditor.getByRole('button', { name: 'Enviar versión' })).toHaveCount(0); await auditorContext.close();
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } }); const mobile = await mobileContext.newPage();
  await login(mobile); await mobile.goto('/quotes');
  expect(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await mobileContext.close();
});
