import { expect, test } from '@playwright/test';
import { demoQuotes } from '../src/lib/demo-data';

// test-id: playwright:clinical-nov07-print-selection
// test-id: playwright:clinical-nov07-responsive-schedule
for (const width of [1440, 390])
  test(`clinical print selection and medication schedules at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/login?next=/clinical');
    await page.getByLabel('Usuario o correo').fill('admin@demo.local');
    await page.getByLabel('Clave').fill('demo-admin');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/clinical$/);
    await page
      .getByRole('combobox', { name: 'Paciente', exact: true })
      .selectOption('patient-demo-001');
    await page.getByRole('button', { name: '02 · Acciones médicas', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'Registros médicos' })
      .getByRole('button', { name: 'Indicación médica', exact: true })
      .click();
    await page.getByRole('button', { name: 'Imprimir sección', exact: true }).click();
    const print = page.getByRole('dialog', { name: 'Imprimir expediente', exact: true });
    await expect(print.getByRole('checkbox', { name: /^Acciones médicas/ })).toBeChecked();
    await print.getByRole('checkbox', { name: /^Acciones médicas/ }).uncheck();
    await expect(print.getByRole('button', { name: 'Imprimir selección' })).toBeDisabled();
    await print.getByRole('checkbox', { name: /^Acciones de enfermería/ }).check();
    await page.evaluate(() => {
      window.print = () => {};
    });
    await print.getByRole('button', { name: 'Imprimir selección' }).click();
    const root = page.locator('#clinical-print-root');
    await expect(root.locator('h2')).toHaveText(['Paciente Demo Aurora', 'Acciones de enfermería']);
    await expect(root).toContainText('118/76');
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await print.getByRole('checkbox', { name: /^Acciones médicas/ }).check();
    await print.getByRole('button', { name: 'Imprimir selección' }).click();
    await expect(root.locator('h2')).toHaveText([
      'Paciente Demo Aurora',
      'Acciones médicas',
      'Acciones de enfermería',
    ]);
    await expect(root).not.toContainText('Resumen · cotizaciones');
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await print.getByRole('button', { name: 'Seleccionar expediente completo' }).click();
    await print.getByRole('button', { name: 'Imprimir selección' }).click();
    await expect(root.locator('h2')).toHaveCount(5);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    expect(await print.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: `.local/clinical-nov07-print-${width}.png`, fullPage: true });
    await print.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(
      page
        .getByRole('navigation', { name: 'Registros médicos' })
        .getByRole('button', { name: 'Indicación médica', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate((fixtures) => {
      const key = 'analiza.en.casa.workspace.v3.quotes';
      const quotes = JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fixtures));
      quotes[0].items = [
        {
          id: 'qa-med',
          category: 'MEDICATIONS',
          name: 'Medicamento sintético para verificar horarios',
          quantity: 1,
          unitPrice: 0,
          discountAmount: 0,
        },
      ];
      localStorage.setItem(key, JSON.stringify(quotes));
    }, demoQuotes);
    await page.goto('/clinical/orders');
    await page.getByRole('button', { name: 'Acciones de enfermería', exact: true }).click();
    await page
      .locator('.clinical-action-grid')
      .getByRole('button', { name: 'Tarjeta de medicamentos', exact: true })
      .click();
    await page
      .locator('.clinical-patient-list')
      .getByRole('button', { name: 'Tarjeta de medicamentos', exact: true })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('combobox', { name: 'Hospitalización', exact: true })
      .selectOption('case-demo-001');
    await dialog.getByLabel(/^Hora 1/).fill('08:00');
    await dialog.getByRole('button', { name: 'Agregar hora' }).click();
    await dialog.getByLabel(/^Hora 2/).fill('16:00');
    await dialog.getByRole('button', { name: 'Agregar hora' }).click();
    await dialog.getByLabel(/^Hora 3/).fill('22:00');
    await dialog
      .getByLabel(/^Dilución/)
      .fill('Indicación capturada por el equipo, ejemplo sintético');
    await expect(dialog.getByLabel('Crónicos', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Artículo de inventario')).toHaveCount(0);
    expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    expect(
      await dialog
        .getByRole('button', { name: 'Agregar hora' })
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBe(true);
    await page.screenshot({ path: `.local/clinical-nov07-schedule-${width}.png`, fullPage: true });
    await dialog.getByRole('button', { name: /^Quitar hora 2/ }).click();
    await expect(dialog.getByLabel(/^Hora 2/)).toHaveValue('22:00');
  });
