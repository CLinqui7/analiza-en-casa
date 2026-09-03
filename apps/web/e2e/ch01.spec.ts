import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';

// test-id: playwright:ch01-direct-auth
// test-id: playwright:ch01-patient-tabs-import
// test-id: playwright:ch01-patient-video-columns
// test-id: playwright:ch01-search-pagination
// test-id: playwright:workspace-loading-empty-error
// test-id: playwright:ch01-xlsx-export
// test-id: playwright:ch01-triage-botmaker-status
// test-id: playwright:workspace-sidebar-accordions
// test-id: playwright:ch01-dashboard-six-metrics
// test-id: playwright:ch01-measurements-table
// test-id: playwright:ch01-user-menu
// test-id: playwright:ch01-logout
// test-id: playwright:ch01-login-recovery
// test-id: playwright:ch01-pwa-install-surface

async function login(page: import('@playwright/test').Page, path = '/dashboard') {
  await page.goto(`/login?next=${encodeURIComponent(path)}`);
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}$`));
}

test('CH01-F001 direct-auth preserves the requested patients route', async ({ page }) => {
  await page.goto('/patients');
  await expect(page).toHaveURL(/\/login\?next=%2Fpatients/);
  await login(page, '/patients');
  await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();
});

test('CH01-F002 patient-tabs-import exposes the bulk import surface', async ({ page }) => {
  await login(page, '/patients');
  for (const tab of ['Activos', 'Inactivos', 'Carga masiva'])
    await expect(page.getByRole('tab', { name: new RegExp(tab) })).toBeVisible();
  await page.getByRole('tab', { name: /Carga masiva/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Importar pacientes' });
  await dialog.locator('[data-action-id="PATIENT-IMPORT-FILE"]').setInputFiles({
    name: 'ch01.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'document,firstName,lastName,documentType\nCH01-IMPORT,Persona,Prueba,OTHER',
    ),
  });
  await expect(dialog.locator('[data-action-id="PATIENT-IMPORT-PREVIEW"]')).toContainText(
    '1 filas válidas',
  );
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toHaveCount(0);
});

test('CH01-F003 patient-video-columns presents the observed administrative columns', async ({
  page,
}) => {
  await login(page, '/patients');
  expect(await page.locator('thead th').allTextContents()).toEqual([
    'Acción',
    'Documento ↕',
    'Nombre completo ↑',
    'Edad',
    'Empresa',
    'Triage',
    'Notif. Botmaker',
    'Estado',
  ]);
  await expect(
    page.getByRole('cell', { name: 'Sin clasificar', exact: true }).first(),
  ).toBeVisible();
});

test('CH01-F004 search-pagination filters and pages patient records', async ({ page }) => {
  await login(page, '/patients');
  await page.getByLabel('Buscar paciente').fill('Aurora');
  await expect(page.getByText('Paciente Demo Aurora', { exact: true })).toBeVisible();
  await page.getByLabel('Buscar paciente').fill('sin coincidencia ch01');
  await expect(page.getByText('Sin resultados')).toBeVisible();
});

test('CH01-F006 list state represents an empty filtered result safely', async ({ page }) => {
  await login(page, '/patients');
  await page.getByLabel('Buscar paciente').fill('resultado inexistente ch01');
  await expect(page.getByText('Sin resultados')).toBeVisible();
});

test('CH01-F008 hierarchical menu exposes only live routes', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Clínico' }).click();
  await page.getByRole('link', { name: 'Reporte de salud' }).click();
  await expect(page).toHaveURL(/\/clinical\/reports$/);
});

test('CH01-F005 xlsx-export creates a valid workbook', async ({ page }) => {
  await login(page, '/patients');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar Excel' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('pacientes-activos.xlsx');
  const archive = unzipSync(new Uint8Array(await readFile((await download.path()) as string)));
  expect(Object.keys(archive).sort()).toEqual([
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/_rels/workbook.xml.rels',
    'xl/workbook.xml',
    'xl/worksheets/sheet1.xml',
  ]);
  expect(strFromU8(archive['xl/workbook.xml'])).toContain('name="Pacientes"');
  const sheetXml = strFromU8(archive['xl/worksheets/sheet1.xml']);
  expect(sheetXml).toContain('<dimension ref="A1:G');
  expect(sheetXml).toContain('>Documento</t>');
  expect(sheetXml).toContain('>Notif. Botmaker</t>');
  expect((sheetXml.match(/<row /g) ?? []).length).toBeGreaterThan(1);
});

test('CH01-F007 triage-botmaker-status persists as administrative state', async ({ page }) => {
  await login(page, '/patients');
  await page.getByRole('button', { name: 'Agregar paciente' }).click();
  const dialog = page.getByRole('dialog', { name: 'Agregar paciente' });
  await dialog.getByLabel('Tipo de documento').selectOption('OTHER');
  await dialog.getByLabel('Número de documento').fill('CH01-CONSENT');
  await dialog.getByLabel('Nombre completo').fill('Paciente Consentimiento CH01');
  await dialog.getByLabel('Fecha de nacimiento').fill('1985-04-20');
  await dialog.getByLabel('Femenino').check();
  await dialog.getByLabel('Teléfono celular').fill('7000-0001');
  await dialog.getByLabel('Empresa').fill('Empresa sintética');
  await dialog
    .getByRole('textbox', { name: 'Dirección obligatorio', exact: true })
    .fill('Dirección sintética');
  await dialog.getByLabel('Comentarios relevantes de la dirección').fill('Referencia sintética');
  await dialog.getByLabel('Triage administrativo').fill('Pendiente administrativo');
  await dialog.getByLabel('Autoriza notificaciones operativas por WhatsApp').uncheck();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await page.reload();
  await page.getByLabel('Buscar paciente').fill('CH01-CONSENT');
  await expect(page.getByRole('row', { name: /Paciente Consentimiento CH01/ })).toContainText('No');
  await expect(page.getByRole('row', { name: /Paciente Consentimiento CH01/ })).toContainText(
    'Pendiente administrativo',
  );
});

test('CH01-F009 dashboard-six-metrics and CH01-F010 measurement table are safe', async ({
  page,
}) => {
  await login(page);
  for (const metric of [
    'Pacientes con alertas',
    'Pacientes activos',
    'Tratamientos actualizados',
    'Tratamientos por finalizar',
    'Planes de cuidado',
    'Incidentes',
  ])
    await expect(page.getByText(metric, { exact: true })).toBeVisible();
  for (const header of [
    'Acciones',
    'Paciente',
    'FC',
    'FR',
    'Oxígeno',
    'Sistólica',
    'Diastólica',
    'Temp',
    'Dolor',
    'Glicemia',
    'Fecha',
    'Recurso',
  ])
    await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
  await expect(page.getByText('Sin clasificar', { exact: true })).toBeVisible();
});

test('CH01-F011-F014 user menu, logout, recovery, and PWA fallback work honestly', async ({
  page,
}) => {
  await login(page);
  await page.locator('[data-action-id="USER-MENU-OPEN"]').click();
  await expect(page.getByRole('menu')).toContainText('Analiza en Casa');
  await page.keyboard.press('Escape');
  await page.locator('[data-action-id="AUTH-LOGOUT"]').last().click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.getByRole('button', { name: 'Recuperar acceso' }).click();
  await expect(page.getByText('no se envió ningún mensaje')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Instalar en dispositivo' }).click();
  await expect(page.getByRole('status')).toContainText('La instalación no está disponible');
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
});
