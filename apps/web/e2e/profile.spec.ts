import { expect, test } from '@playwright/test';

for (const [email, password, landing] of [
  ['admin@demo.local', 'demo-admin', '/dashboard'],
  ['nurse@demo.local', 'demo-nurse', '/patients'],
  ['analytics@demo.local', 'demo-analytics', '/analytics/logins'],
] as const) {
  test(`profile navigation is available to ${email}`, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Usuario o correo').fill(email);
    await page.getByLabel('Clave').fill(password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(new RegExp(`${landing.replaceAll('/', '\/')}\/?$`));
    await page.locator('.topbar-profile').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Editar mi perfil' }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(
      page.getByRole('heading', { name: 'Un espacio que se siente tuyo' }),
    ).toBeVisible();
    await expect(
      page.getByText('El modo de demostración no guarda fotos, nombres ni contraseñas reales.'),
    ).toBeVisible();
  });
}
