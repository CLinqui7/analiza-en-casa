import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page, email = 'admin@demo.local', password = 'demo-admin') {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('insurance records manual observations, searches, filters and preserves related modules', async ({ page }) => {
  await login(page);
  await page.goto('/insurance?quote=quote-demo-001');
  await expect(page.getByText('Visitar este enlace no crea una preautorización.')).toBeVisible();
  await page.getByRole('button', { name: 'Registrar actualización' }).first().click();
  const dialog = page.getByRole('dialog', { name: /Registrar actualización/ });
  await dialog.getByLabel('Observación / respuesta').fill('Respuesta administrativa sintética para QA.');
  await dialog.getByRole('button', { name: 'Registrar actualización' }).click();
  await expect(page.getByRole('status')).toContainText('No se modificaron cotización');
  await expect(page.locator('summary')).toContainText('Respuesta administrativa sintética para QA.');
  await page.reload();
  await expect(page.locator('summary')).toContainText('Respuesta administrativa sintética para QA.');

  const search = page.getByLabel('Buscar solicitudes');
  for (const term of ['Aurora', '1234-5678-9', '00000000', 'quote demo 001', 'aseguradora de demostracion']) {
    await search.fill(term); await expect(page.getByRole('link', { name: 'quote-demo-001' }).first()).toBeVisible();
  }
  await search.fill('sin resultado QA'); await expect(page.getByText('Sin resultados', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).click(); await expect(search).toHaveValue('');
  await page.getByLabel('Estado observado').first().selectOption('SENT_TO_INSURER'); await expect(page.getByRole('link', { name: 'quote-demo-001' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Restablecer filtro' }).click();

  await page.getByRole('button', { name: 'Registrar actualización' }).last().click();
  const update = page.getByRole('dialog', { name: /Registrar actualización/ });
  await update.getByLabel('Estado observado').selectOption('REJECTED');
  await update.getByLabel('Observación / respuesta').fill('Segunda observación sintética append-only.');
  await update.getByRole('button', { name: 'Registrar actualización' }).click();
  await page.getByText('Segunda observación sintética append-only.', { exact: true }).first().click();
  await expect(page.locator('li').filter({ hasText: 'Respuesta administrativa sintética para QA.' })).toBeVisible();
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('analiza.en.casa.workspace.v2') ?? '{}'));
  expect(snapshot.quotes.find((item: { id: string }) => item.id === 'quote-demo-001').status).toBe('DRAFT');
  expect(snapshot.hospitalizations[0].status).toBe('ACTIVE');
  expect(snapshot.payments).toEqual([]); expect(snapshot.shifts).toHaveLength(2);

  await page.getByRole('link', { name: 'quote-demo-001' }).first().click(); await expect(page).toHaveURL(/\/quotes\/quote-demo-001$/);
});

test('insurance cancellation, invalid quote, safe channels and role guards are enforced', async ({ browser }) => {
  const adminContext = await browser.newContext(); const admin = await adminContext.newPage();
  await login(admin); await admin.goto('/insurance?quote=quote-demo-001');
  await admin.getByRole('button', { name: 'Registrar actualización' }).first().click();
  await admin.getByRole('button', { name: 'Cancelar' }).click(); await admin.reload();
  await expect(admin.getByText('Sin solicitud registrada', { exact: true })).toBeVisible();
  await admin.goto('/insurance?quote=missing-quote'); await expect(admin.getByText('Cotización no disponible')).toBeVisible();
  await admin.getByRole('button', { name: 'WhatsApp' }).click(); await expect(admin.locator('.notice.success')).toContainText('proveedor/canal externo no configurado');
  await admin.getByRole('button', { name: 'Email' }).click(); await expect(admin.locator('.notice.success')).toContainText('proveedor/canal externo no configurado');
  await admin.getByRole('button', { name: 'Enviar al seguro' }).click(); await expect(admin.locator('.notice.success')).toContainText('proveedor/canal externo no configurado');
  await admin.getByRole('button', { name: 'Reclamo' }).click(); await expect(admin.locator('.notice.success')).toContainText('CH08-Q002');
  await adminContext.close();

  for (const role of [
    { email: 'finance@demo.local', password: 'demo-finance', write: true },
    { email: 'doctor@demo.local', password: 'demo-doctor', write: false },
    { email: 'auditor@demo.local', password: 'demo-auditor', write: false },
  ]) {
    const context = await browser.newContext(); const page = await context.newPage(); await login(page, role.email, role.password); await page.goto('/insurance?quote=quote-demo-001');
    await expect(page.locator('main[role="alert"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Registrar actualización' })).toHaveCount(role.write ? 2 : 0);
    await context.close();
  }
  for (const role of [{ email: 'nurse@demo.local', password: 'demo-nurse' }, { email: 'inventory@demo.local', password: 'demo-inventory' }]) {
    const context = await browser.newContext(); const page = await context.newPage(); await login(page, role.email, role.password); await page.goto('/insurance'); await expect(page.locator('main[role="alert"]')).toContainText('Acceso restringido'); await context.close();
  }
});

test('insurance fits a mobile viewport without horizontal overflow', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await context.newPage();
  await login(page); await page.goto('/insurance'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await context.close();
});
