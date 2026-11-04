import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixtures = JSON.parse(readFileSync(process.env.BILLING_QA_RESULT!, 'utf8'));
const secret = process.env.ANALIZA_QA_PASSWORD!;
if (!fixtures.quoteId?.startsWith('billing-qa-q-') || !secret)
  throw new Error('Run isolated billing PostgreSQL verification first.');
async function login(page: Page, path: string, role = 'admin') {
  await page.goto('/login?next=' + encodeURIComponent(path));
  await page.getByLabel('Usuario o correo').fill(`qa-${role}@example.test`);
  await page.getByLabel('Clave').fill(secret);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.locator('main h1')).toBeVisible({ timeout: 30000 });
}
async function api(page: Page, url: string, data?: unknown, csrf?: string) {
  return page.evaluate(
    async ({ url, data, csrf }) => {
      const r = await fetch(url, {
        method: data === undefined ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-analiza-csrf': csrf } : {}),
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
      return { status: r.status, body: await r.json() };
    },
    { url, data, csrf },
  );
}
// test-id: playwright:billing-connected-retry
test('a committed payment with lost response retries once even after closing the dialog', async ({
  page,
}) => {
  await login(page, '/receivables?quote=' + fixtures.quoteId);
  const row = page
    .getByRole('row')
    .filter({ has: page.getByTitle(fixtures.quoteId) })
    .first();
  await expect(row).toContainText('80.00');
  const attempts: unknown[] = [];
  await page.route('**/api/operations', async (route) => {
    if (
      route.request().method() !== 'POST' ||
      route.request().postDataJSON()?.command !== 'payment.apply'
    )
      return route.continue();
    attempts.push(route.request().postDataJSON());
    if (attempts.length === 1) {
      const committed = await route.fetch();
      expect(committed.status(), await committed.text()).toBe(200);
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Fallo sintético posterior al commit' }),
      });
    }
    return route.continue();
  });
  await row.getByRole('button', { name: 'Registrar pago' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Monto ingresado').fill('0.014');
  await dialog.getByRole('button', { name: 'Aplicar pago', exact: true }).click();
  await expect(
    dialog.getByText('Ingrese un importe con un máximo de dos decimales.'),
  ).toBeVisible();
  expect(attempts).toHaveLength(0);
  await dialog.getByLabel('Monto ingresado').fill('0.29');
  await dialog.getByLabel('Medio de pago').selectOption('CHECK');
  const reference = 'QA-RETRY-' + Date.now();
  await dialog.getByLabel('Número de reserva').fill(reference);
  await dialog.getByRole('button', { name: 'Aplicar pago', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('no se confirmó');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Aplicar pago', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Número de reserva')).toHaveValue(reference);
  await dialog.getByRole('button', { name: 'Aplicar pago', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
  await page.reload();
  await expect(row).toContainText('79.71');
  const snapshot = await api(page, '/api/operations');
  expect(snapshot.status).toBe(200);
  const recorded = snapshot.body.payments.filter(
    (p: { reference?: string }) => p.reference === reference,
  );
  expect(recorded).toHaveLength(1);
  expect(recorded[0].amount).toBe(0.29);
  await page.goto('/quotes/' + fixtures.originalQuoteId);
  await expect(
    page.locator('dt', { hasText: /^Saldo actual de cuenta$/ }).locator('+ dd'),
  ).toContainText('79.71');
  await expect(page.locator('dt', { hasText: /^Total$/ }).locator('+ dd')).toContainText('100.00');
  const csrf = (await api(page, '/api/auth/csrf')).body.csrfToken;
  expect(
    (
      await api(
        page,
        '/api/operations',
        { command: 'payment.void', paymentId: recorded[0].id, reason: 'Restaurar saldo tras QA' },
        csrf,
      )
    ).status,
  ).toBe(200);
});
// test-id: playwright:billing-connected-boundaries
test('financial HTTP commands require CSRF, valid cents and correct organization', async ({
  page,
}) => {
  await login(page, '/receivables');
  const payment = {
    id: crypto.randomUUID(),
    quoteId: fixtures.quoteId,
    amount: 0.001,
    paymentMethod: 'CASH',
    idempotencyKey: crypto.randomUUID(),
    status: 'APPLIED',
    createdAt: new Date().toISOString(),
  };
  expect((await api(page, '/api/operations', { command: 'payment.apply', payment })).status).toBe(
    403,
  );
  const csrf = (await api(page, '/api/auth/csrf')).body.csrfToken;
  expect(
    (await api(page, '/api/operations', { command: 'payment.apply', payment }, csrf)).status,
  ).toBe(400);
  expect(
    (
      await api(
        page,
        '/api/operations',
        { command: 'payment.apply', payment: { ...payment, amount: 1, quoteId: 'foreign-quote' } },
        csrf,
      )
    ).status,
  ).toBe(400);
  await page.goto('/doctors');
  await expect(page.getByText('En Mongo, guarde primero el médico.', { exact: false })).toHaveCount(
    0,
  );
  await expect(page.locator('.account-logout-quick')).toHaveText('Cerrar sesión');
});
