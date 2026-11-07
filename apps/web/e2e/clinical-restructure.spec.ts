import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, path: string, role = 'admin') {
  await page.goto(`/login?next=${encodeURIComponent(path)}`);
  await page.getByLabel('Usuario o correo').fill(`${role}@demo.local`);
  await page.getByLabel('Clave').fill(`demo-${role}`);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

// test-id: playwright:clinical-config-editing-and-dialog-focus
test('scale editing tolerates unfinished text, rejects malformed uploads and traps dialog focus', async ({
  page,
}) => {
  await login(page, '/catalogs/clinical');
  await page.getByRole('button', { name: 'Escalas', exact: true }).click();
  const edit = page
    .locator('.clinical-patient-list')
    .getByRole('button', { name: 'Editar' })
    .first();
  await edit.click();
  const dialog = page.getByRole('dialog');
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Guardar', exact: true })).toBeFocused();
  await dialog.getByLabel('Versión de la definición').fill('');
  await expect(dialog.getByLabel('Respuesta 1', { exact: true })).toBeVisible();
  await dialog.getByLabel('Versión de la definición').fill('QA manual');
  await dialog.getByLabel('Respuesta 1', { exact: true }).fill('');
  await expect(dialog.getByLabel('Respuesta 2', { exact: true })).toBeVisible();
  await dialog.getByLabel('Cargar definición JSON').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"id":"UNKNOWN"}'),
  });
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Revise la definición');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(edit).toBeFocused();
});

// test-id: playwright:clinical-restructure-forms
test('medical and nursing entry points expose usable manual forms and preserve patient scope', async ({
  page,
}) => {
  await login(page, '/clinical/orders', 'nurse');
  await expect(page.getByRole('heading', { name: 'Órdenes médicas', exact: true })).toBeVisible();
  for (const kind of [
    'Indicación médica',
    'Evolución clínica',
    'Historia clínica',
    'Antecedentes clínicos',
  ]) {
    await page.locator('.clinical-action-grid').getByRole('button', { name: kind }).click();
    await page
      .locator('.clinical-patient-list')
      .getByRole('button', { name: kind })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('combobox', { name: 'Hospitalización', exact: true })
      .selectOption('case-demo-001');
    await dialog.getByLabel('Resumen', { exact: true }).fill('Observación sintética de QA');
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('conexión segura');
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Acciones de enfermería', exact: true }).click();
  for (const kind of [
    'Tarjeta de medicamentos',
    'Balance hídrico',
    'Plan de cuidado',
    'Administración de medicamentos',
    'Signos vitales',
    'Nota de enfermería',
    'Escala',
  ]) {
    await page
      .locator('.clinical-action-grid')
      .getByRole('button', { name: kind, exact: true })
      .click();
    await page
      .locator('.clinical-patient-list')
      .getByRole('button', { name: kind, exact: true })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Guardar', exact: true })).toHaveCount(1);
    await dialog
      .getByRole('combobox', { name: 'Hospitalización', exact: true })
      .selectOption('case-demo-001');
    if (kind === 'Signos vitales' || kind === 'Nota de enfermería') {
      const add = dialog.getByRole('button', { name: 'Agregar registro' });
      const before = await add.boundingBox();
      await add.click();
      await add.click();
      const after = await add.boundingBox();
      expect(after!.height).toBeLessThanOrEqual(before!.height + 1);
      expect(after!.width).toBeLessThanOrEqual(before!.width + 1);
      await expect(dialog.getByLabel('Hora', { exact: true })).toHaveCount(3);
    }
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  }
});

// test-id: playwright:clinical-annex-scales
test('all ten scales show numerical options with source-specific totals', async ({ page }) => {
  await login(page, '/clinical/orders');
  await page.getByRole('button', { name: 'Acciones de enfermería', exact: true }).click();
  await page
    .locator('.clinical-action-grid')
    .getByRole('button', { name: 'Escala', exact: true })
    .click();
  await page
    .locator('.clinical-patient-list')
    .getByRole('button', { name: 'Escala', exact: true })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('combobox', { name: 'Hospitalización', exact: true })
    .selectOption('case-demo-001');
  for (const [scale, score] of [
    ['EVA', 0],
    ['GLASGOW', 15],
    ['RAMSAY', 1],
    ['ECOG', 0],
    ['ESAS', null],
    ['KARNOFSKY', 100],
    ['DOWNTON', 0],
    ['BRADEN', 6],
    ['NORTON', 20],
    ['BARTHEL', 0],
  ] as const) {
    await dialog.getByRole('combobox', { name: 'Escala', exact: true }).selectOption(scale);
    for (const group of await dialog.locator('.clinical-scale-options').all())
      await group.getByRole('radio').first().check();
    await expect(dialog.locator('output')).toHaveText(
      score === null ? 'Perfil completo · sin suma global' : `Puntuación: ${score}`,
    );
  }
});

// test-id: playwright:clinical-restructure-responsive
for (const width of [1440, 390])
  test(`clinical workflow fits ${width}px including growing forms`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await login(page, '/clinical/orders');
    for (const path of [
      '/clinical/orders',
      '/clinical',
      '/clinical/balance',
      '/clinical/medication-cards',
      '/clinical/administrations',
      '/catalogs/clinical',
      '/catalogs/discounts',
      '/reports/returns',
    ]) {
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      ).toBe(true);
    }
    await page.goto('/clinical/balance');
    await page.locator('.clinical-patient-list').getByRole('button').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
    expect(
      await page
        .getByRole('dialog')
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);
    await page.screenshot({ path: `./.local/clinical-balance-${width}.png`, fullPage: true });
  });

// test-id: playwright:clinical-configuration-all-users
for (const role of ['nurse', 'doctor', 'finance', 'inventory', 'auditor'])
  test(`${role} can configure the client-authorized clinical and discount inputs`, async ({
    page,
  }) => {
    await login(page, '/catalogs/clinical', role);
    await expect(page.getByRole('button', { name: 'Agregar diagnóstico' })).toBeVisible();
    await page.goto('/catalogs/discounts');
    await page.getByRole('button', { name: 'Agregar perfil' }).click();
    await expect(page.getByRole('dialog').getByLabel('Servicios · %')).toBeVisible();
  });
