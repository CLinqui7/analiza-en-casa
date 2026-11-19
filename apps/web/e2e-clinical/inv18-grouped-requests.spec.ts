import { test, expect, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
const fixturePath = process.env.NOV17_QA_RESULT;
const secret = process.env.ANALIZA_QA_PASSWORD;
async function login(page: Page, role: string, path: string) {
  await page.goto('/login?next=' + encodeURIComponent(path));
  await page.getByLabel('Usuario o correo').fill('qa-' + role + '@example.test');
  await page.getByLabel('Clave').fill(secret!);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL((url) => url.pathname === path);
}
test('solicitud clínica agrupada y ampliación aprobada con adicionales en ambas pantallas', async ({
  page,
  browser,
}) => {
  expect(fixturePath).toBeTruthy();
  expect(secret).toBeTruthy();
  const fixture = JSON.parse(
    readFileSync(join(dirname(fixturePath!), 'inv18-groups.json'), 'utf8'),
  ) as { run: string; quoteId: string; medicationSku: string; serviceSku: string };
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'nurse', '/supply-requests');
  await page.getByRole('button', { name: 'Nueva solicitud' }).click();
  let dialog = page.getByRole('dialog');
  await dialog
    .getByRole('combobox', { name: 'Buscar paciente por nombre o DUI para solicitud' })
    .fill(fixture.run);
  await dialog
    .getByRole('option', { name: new RegExp(fixture.run) })
    .first()
    .click();
  await dialog
    .getByRole('combobox', { name: 'Buscar medicamento, insumo o equipo' })
    .fill(fixture.medicationSku);
  await dialog.getByRole('option', { name: new RegExp(fixture.medicationSku) }).click();
  await dialog.getByLabel('Cantidad', { exact: true }).fill('2');
  await dialog.getByRole('button', { name: 'Agregar otro concepto' }).click();
  const second = dialog.getByRole('group', { name: 'Concepto 2' });
  await second.getByLabel('Categoría', { exact: true }).selectOption('FEES');
  await second.getByLabel('Servicio médico').selectOption('Visita');
  await second.getByLabel('Honorario médico').selectOption('25');
  await expect(dialog.getByLabel('Cantidad', { exact: true })).toHaveCount(2);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const screenshots = join('.local', 'inv18-browser');
  mkdirSync(screenshots, { recursive: true });
  await page.screenshot({ path: join(screenshots, 'nursing-group-mobile.png') });
  const post = page.waitForResponse(
    (r) => r.url().endsWith('/api/supply-requests') && r.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Enviar solicitud interna' }).click();
  const stored = await post;
  expect(stored.status(), await stored.text()).toBe(201);
  const request = await stored.json();
  expect(request.products.length).toBe(2);
  await expect(dialog).toHaveCount(0);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    baseURL: process.env.CLINICAL_QA_BASE_URL ?? 'http://127.0.0.1:4317',
  });
  try {
    const admin = await context.newPage();
    await login(admin, 'admin', '/clinical/prequotes');
    const row = admin
      .getByRole('row')
      .filter({ hasText: fixture.run })
      .filter({ hasText: 'Pendiente' })
      .first();
    await row.getByRole('button', { name: 'Revisar solicitud' }).click();
    dialog = admin.getByRole('dialog');
    await dialog.getByLabel('Asignar a una cotización').selectOption({ index: 1 });
    await dialog.getByRole('button', { name: 'Agregar concepto', exact: true }).click();
    await dialog.getByLabel('Categoría', { exact: true }).selectOption('SERVICES');
    await dialog
      .getByRole('combobox', { name: 'Buscar concepto de catálogo' })
      .fill(fixture.serviceSku);
    await dialog.getByRole('option', { name: new RegExp(fixture.serviceSku) }).click();
    await dialog
      .getByLabel('Motivo de la ampliación')
      .fill('Conceptos sintéticos añadidos desde revisión');
    await admin.screenshot({ path: join(screenshots, 'prequote-group-desktop.png') });
    const assign = admin.waitForResponse(
      (r) => r.url().endsWith('/api/prequotes') && r.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Añadir a cotización' }).click();
    const saved = await assign;
    expect(saved.status(), await saved.text()).toBe(200);
    const result = await saved.json();
    expect(result.quoteId).not.toBe(fixture.quoteId);
    await expect(dialog).toHaveCount(0);
    await admin.getByRole('link', { name: 'Ver cotización actualizada' }).click();
    await expect(admin).toHaveURL((url) => url.pathname.endsWith('/' + result.quoteId));
    await expect(admin.getByText('Adicional', { exact: true }).first()).toBeVisible();
  } finally {
    await context.close();
  }
});
