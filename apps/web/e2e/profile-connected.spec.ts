import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test.skip(
  process.env.NEXT_PUBLIC_DATA_MODE !== 'postgresql',
  'Run with the server-data-mode browser fixture',
);

test('a connected user can edit their own name and photo, then change password and reauthenticate', async ({
  page,
}) => {
  let profile = {
    email: 'synthetic@example.test',
    displayName: 'Synthetic Nurse',
    avatarVersion: 0,
  };
  let signedIn = true;
  const png = await sharp({ create: { width: 1, height: 1, channels: 4, background: '#167480' } })
    .png()
    .toBuffer();
  const mutations: string[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const json = (value: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (path === '/api/auth/session')
      return json(
        signedIn
          ? { userId: 'synthetic-user', role: 'NURSE', dashboardAccess: false }
          : { error: 'No autorizado' },
        signedIn ? 200 : 401,
      );
    if (path === '/api/auth/csrf') return json({ csrfToken: 'synthetic-csrf' });
    if (path === '/api/profile' && method === 'GET') return json(profile);
    if (path === '/api/profile' && method === 'PATCH') {
      expect(request.headers()['x-analiza-csrf']).toBe('synthetic-csrf');
      profile = { ...profile, displayName: request.postDataJSON().displayName as string };
      mutations.push('name');
      return json(profile);
    }
    if (path === '/api/profile/avatar' && method === 'PUT') {
      expect(request.headers()['x-analiza-csrf']).toBe('synthetic-csrf');
      profile = { ...profile, avatarVersion: profile.avatarVersion + 1 };
      mutations.push('avatar');
      return json(profile);
    }
    if (path === '/api/profile/avatar' && method === 'GET')
      return route.fulfill({ status: 200, contentType: 'image/png', body: png });
    if (path === '/api/profile/password' && method === 'POST') {
      expect(request.headers()['x-analiza-csrf']).toBe('synthetic-csrf');
      expect(request.postDataJSON()).toEqual({
        currentPassword: 'synthetic-old-password',
        newPassword: 'synthetic-new-password',
      });
      mutations.push('password');
      signedIn = false;
      return json({ reauthenticate: true });
    }
    if (path === '/api/operations/access') return json({ commercialAccess: null });
    return json({ error: 'Synthetic fixture has no workspace data' }, 503);
  });

  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Un espacio que se siente tuyo' })).toBeVisible();
  await expect(page.getByText('synthetic@example.test')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByLabel('Nombre', { exact: true }).fill('Synthetic Nurse Updated');
  await page.getByRole('button', { name: 'Guardar nombre' }).click();
  await expect(page.getByRole('heading', { name: 'Synthetic Nurse Updated' })).toBeVisible();
  await page
    .locator('#profile-photo')
    .setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Guardar foto' }).click();
  await expect(page.getByRole('img', { name: 'Mi foto de perfil' })).toBeVisible();
  await page.getByLabel('Contraseña actual').fill('synthetic-old-password');
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('synthetic-new-password');
  await page.getByLabel('Confirmar nueva contraseña').fill('synthetic-new-password');
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(page).toHaveURL(/\/login\?password=updated/);
  await expect(
    page.getByText('Contraseña actualizada. Inicia sesión con tu nueva contraseña.'),
  ).toBeVisible();
  expect(mutations).toEqual(['name', 'avatar', 'password']);
});
