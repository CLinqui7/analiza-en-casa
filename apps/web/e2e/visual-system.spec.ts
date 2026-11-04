import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill('webmaster@demo.local');
  await page.getByLabel('Clave', { exact: true }).fill('demo-webmaster');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

// test-id: playwright:visual-dropdown-keyboard
test('searchable catalogs keep the active option visible and accept custom entries by keyboard', async ({
  page,
}) => {
  await page.goto('/patients');
  await page.locator('[data-action-id="PATIENT-CREATE"]').click();
  const dialog = page.getByRole('dialog');
  const nationality = dialog.getByRole('combobox', { name: 'Nacionalidad', exact: true });
  await nationality.focus();
  await nationality.press('End');
  const active = await nationality.getAttribute('aria-activedescendant');
  expect(active).toBeTruthy();
  const option = page.locator(`[id="${active}"]`);
  const text = await option.innerText();
  const position = await option.evaluate((el) => {
    const row = el.getBoundingClientRect(),
      list = el.parentElement!.getBoundingClientRect();
    return row.top >= list.top && row.bottom <= list.bottom + 1;
  });
  expect(position).toBe(true);
  await nationality.press('Enter');
  await expect(nationality).toHaveAttribute('aria-expanded', 'false');
  await expect(nationality).toHaveAttribute('placeholder', text);
  await nationality.focus();
  await nationality.press('ArrowDown');
  await nationality.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(nationality).toHaveAttribute('aria-expanded', 'false');
  await dialog.getByRole('button', { name: 'Cerrar diálogo', exact: true }).click();
  await page.goto('/doctors');
  await page.getByRole('button', { name: 'Nuevo médico', exact: true }).click();
  const company = page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Especialidad o profesión', exact: true });
  await company.fill('Especialidad sintética visual QA');
  await company.press('End');
  await expect(
    page.locator(`[id="${await company.getAttribute('aria-activedescendant')}"]`),
  ).toContainText('Usar');
  await company.press('Enter');
  await expect(company).toHaveAttribute('placeholder', 'Especialidad sintética visual QA');
  await company.press('Tab');
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

// test-id: playwright:visual-action-menu
test('action menus support arrows, Escape, outside click and return focus after a dialog', async ({
  page,
}) => {
  await page.goto('/patients');
  const menu = page.locator('.patient-more-actions');
  await menu.locator('summary').focus();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('button', { name: 'Actualizar lista' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu.getByRole('button', { name: 'Exportar CSV' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open');
  await expect(menu.locator('summary')).toBeFocused();
  await menu.locator('summary').click();
  await page.getByRole('heading', { level: 1 }).click();
  await expect(menu).not.toHaveAttribute('open');
  await page.goto('/clinical/orders');
  const rowMenu = page.locator('.clinical-patient-list details').first();
  await rowMenu.locator('summary').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(rowMenu.locator('summary')).toBeFocused();
  await expect(rowMenu).not.toHaveAttribute('open');
});

// test-id: playwright:visual-controls-motion
test('shared controls retain readable dimensions, font and reduced-motion behavior', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/catalogs');
  for (const name of ['Diagnósticos y escalas', 'Descuentos configurados por el equipo']) {
    const link = page.getByRole('main').getByRole('link', { name, exact: true });
    await expect(link).toBeVisible();
    const style = await link.evaluate((el) => {
      const css = getComputedStyle(el);
      return {
        decoration: css.textDecorationLine,
        border: parseFloat(css.borderTopWidth),
        font: css.fontFamily,
        height: el.getBoundingClientRect().height,
        animation: parseFloat(css.animationDuration),
        transition: parseFloat(css.transitionDuration),
      };
    });
    expect(style.decoration).toBe('none');
    expect(style.border).toBeGreaterThanOrEqual(1);
    expect(style.height).toBeGreaterThanOrEqual(36);
    expect(style.font).toContain('Analiza Inter');
    expect(style.animation).toBeLessThanOrEqual(0.001);
    expect(style.transition).toBeLessThanOrEqual(0.001);
  }
  await page.goto('/inventory');
  await expect(
    page.getByRole('main').getByRole('link', { name: 'Movimientos', exact: true }),
  ).toHaveCSS('text-decoration-line', 'none');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/patients');
  await page.locator('[data-action-id="PATIENT-CREATE"]').click();
  const dialog = page.getByRole('dialog');
  const input = dialog.getByLabel(/^Nombre completo/);
  await expect(input).toHaveCSS('font-size', '16px');
  expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  const clipped = await dialog
    .locator('button:visible')
    .evaluateAll((buttons) =>
      buttons
        .filter(
          (el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
        )
        .map((el) => el.textContent),
    );
  expect(clipped).toEqual([]);
});

test('each directory highlights only its most specific navigation destination', async ({
  page,
}) => {
  for (const path of [
    '/catalogs/clinical',
    '/catalogs/discounts',
    '/catalogs/services',
    '/inventory/movements',
    '/inventory/kardex',
    '/inventory/home-deliveries',
  ]) {
    await page.goto(path);
    await expect(page.locator('.sidebar a[aria-current="page"]')).toHaveCount(1);
  }
});
