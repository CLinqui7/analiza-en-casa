import { expect, test } from '@playwright/test';

// test-id: playwright:clinical-observations-navigation
// test-id: playwright:clinical-observations-responsive
for (const width of [1440, 390])
  test(`clinical observations navigation and forms at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/login?next=/clinical/orders');
    await page.getByLabel('Usuario o correo').fill('admin@demo.local');
    await page.getByLabel('Clave').fill('demo-admin');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/clinical\/orders$/);
    const sidebar = page.locator('.sidebar');
    await expect(
      sidebar.getByRole('link', { name: 'Administración de medicamentos', exact: true }),
    ).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: 'Planes de cuidado', exact: true })).toHaveCount(
      0,
    );
    await page.getByRole('button', { name: 'Acciones de enfermería', exact: true }).click();
    for (const label of [
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
        .getByRole('button', { name: label, exact: true })
        .click();
      const row = page.locator('.clinical-patient-list > div').first();
      await row.locator('summary').click();
      await expect(row.locator('details[open]')).toContainText('Todavía no hay registros');
      await row.locator('summary').click();
      await row.getByRole('button', { name: label, exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(
        dialog.getByLabel('Filtrar hospitalizaciones por paciente, DUI o código'),
      ).toHaveCount(0);
      if (label === 'Tarjeta de medicamentos') {
        await expect(dialog.getByLabel('Indicaciones, dosis', { exact: false })).toHaveCount(0);
        await expect(dialog.getByLabel('Artículo de inventario')).toHaveCount(0);
      }
      if (label === 'Plan de cuidado') {
        await dialog
          .getByRole('combobox', { name: 'Hospitalización', exact: true })
          .selectOption('case-demo-001');
        await dialog.getByRole('checkbox', { name: 'Dieta', exact: true }).check();
        await dialog.getByRole('checkbox', { name: 'Cuidado de enfermería', exact: true }).check();
        await expect(dialog.getByRole('checkbox', { name: 'Dieta', exact: true })).toBeChecked();
        await expect(
          dialog.getByRole('checkbox', { name: 'Cuidado de enfermería', exact: true }),
        ).toBeChecked();
      }
      expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    }
    await page.goto('/clinical?patient=patient-demo-001');
    await expect(page.getByRole('link', { name: 'Registrar atención', exact: true })).toHaveCount(
      0,
    );
    await page.getByRole('button', { name: '02 · Acciones médicas', exact: true }).click();
    await expect(
      page.getByRole('navigation', { name: 'Registros médicos' }).getByRole('button'),
    ).toHaveCount(5);
    await page.getByRole('button', { name: '04 · Visitas', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: 'JVPE', exact: true })).toHaveCount(2);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
  });
