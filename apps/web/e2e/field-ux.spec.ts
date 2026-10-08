import { expect, test } from '@playwright/test';

// test-id: playwright:contextual-help-all-field-routes
test('every new field route offers a guided, keyboard-accessible help flow', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  for (const route of [
    '/dashboard',
    '/inventory/home-deliveries',
    '/reports/visits-goals',
    '/sales',
  ]) {
    await page.goto(route);
    await page.getByRole('button', { name: 'Ayuda de esta pantalla' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Paso 1 / 3')).toBeVisible();
    await dialog.getByRole('button', { name: 'Siguiente' }).click();
    await expect(dialog.getByText('Paso 2 / 3')).toBeVisible();
    await dialog.getByRole('button', { name: 'Anterior' }).click();
    await expect(dialog.getByText('Paso 1 / 3')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
});

// test-id: playwright:field-routes-mobile-no-overflow
test('new field routes keep the main viewport within mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  for (const route of ['/inventory/home-deliveries', '/reports/visits-goals', '/sales']) {
    await page.goto(route);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${route} overflow`).toBeLessThanOrEqual(1);
  }
});
