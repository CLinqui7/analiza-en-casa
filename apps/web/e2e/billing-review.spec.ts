import { expect, test, type Page } from '@playwright/test';
import { demoQuotes, demoPatients } from '../src/lib/demo-data';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
test('populated insurance cards keep all text and controls inside at six widths', async ({
  page,
}, info) => {
  await login(page);
  await page.evaluate(
    ({ quote, patient }) => {
      const prefix = 'analiza.en.casa.workspace.v3.';
      const longName =
        'Paciente sintético con nombre extenso para verificación de distribución y lectura';
      const quotes = Array.from({ length: 7 }, (_, i) => ({
        ...quote,
        id: `00000000-0000-4000-8000-00000000000${i}`,
        accountType: 'SEGURO',
        insurer: 'Aseguradora sintética con denominación extensa',
        patientId: patient.id,
      }));
      localStorage.setItem(
        prefix + 'patients',
        JSON.stringify([{ ...patient, fullName: longName }]),
      );
      localStorage.setItem(prefix + 'quotes', JSON.stringify(quotes));
      localStorage.setItem(
        prefix + 'insuranceRequests',
        JSON.stringify(
          [
            'SENT_TO_INSURER',
            'INSURER_REVIEW',
            'INFO_REQUIRED',
            'PARTIALLY_APPROVED',
            'APPROVED',
            'REJECTED',
          ].map((status, i) => ({
            id: 'request-' + i,
            quoteId: quotes[i].id,
            patientId: patient.id,
            insurer: quotes[i].insurer,
            status,
            createdAt: '2026-11-04T08:00:00Z',
            updatedAt: '2026-11-04T08:00:00Z',
            lastNote: 'Observación sintética ' + 'ReferenciaSinEspacios'.repeat(10),
          })),
        ),
      );
    },
    { quote: demoQuotes[0], patient: demoPatients[0] },
  );
  await page.goto('/insurance');
  await expect(page.locator('.insurance-card')).toHaveCount(6);
  await expect(page.locator('.insurance-pending-card')).toHaveCount(1);
  for (const width of [1600, 1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.evaluate(() => {
      const cards = [
        ...document.querySelectorAll<HTMLElement>('.insurance-card,.insurance-pending-card'),
      ];
      return {
        page: document.documentElement.scrollWidth > innerWidth + 1,
        cards: cards.filter(
          (card) =>
            card.scrollWidth > card.clientWidth + 1 ||
            [...card.querySelectorAll('a,button')].some(
              (child) =>
                child.getBoundingClientRect().right > card.getBoundingClientRect().right + 1,
            ),
        ).length,
      };
    });
    expect(overflow, `width ${width}`).toEqual({ page: false, cards: 0 });
    if (width === 1440 || width === 390)
      await page.screenshot({ path: info.outputPath(`insurance-${width}.png`), fullPage: true });
  }
});

test('quote revision, receivables, reservation payment, reversal and report reconcile', async ({
  page,
}) => {
  await login(page);
  await page.evaluate((base) => {
    const root = {
      ...base,
      id: 'billing-original',
      rootQuoteId: 'billing-original',
      originalQuoteId: 'billing-original',
      status: 'SENT',
      immutable: true,
      total: 100,
      subtotal: 100,
      patientAmount: 100,
      items: [
        {
          id: 'qa-line',
          category: 'SERVICES',
          name: 'Servicio sintético',
          quantity: 5,
          unitPrice: 20,
          discountAmount: 0,
        },
      ],
    };
    const latest = {
      ...root,
      id: 'billing-revision',
      version: 2,
      total: 120,
      subtotal: 120,
      patientAmount: 120,
      items: root.items.map((item) => ({ ...item, quantity: 6 })),
    };
    localStorage.setItem('analiza.en.casa.workspace.v3.quotes', JSON.stringify([root, latest]));
    localStorage.setItem(
      'analiza.en.casa.workspace.v3.payments',
      JSON.stringify([
        {
          id: 'payment-original',
          quoteId: root.id,
          amount: 40,
          status: 'APPLIED',
          paymentMethod: 'CASH',
          idempotencyKey: 'original-key',
          createdAt: '2026-11-04T08:00:00Z',
        },
      ]),
    );
  }, demoQuotes[0]);
  for (const id of ['billing-original', 'billing-revision']) {
    await page.goto('/quotes/' + id);
    await expect(
      page.locator('dt', { hasText: /^Pagado en la cuenta$/ }).locator('+ dd'),
    ).toContainText('40.00');
    await expect(
      page.locator('dt', { hasText: /^Saldo actual de cuenta$/ }).locator('+ dd'),
    ).toContainText('80.00');
    await expect(
      page.getByText('El total corresponde a esta versión.', { exact: false }),
    ).toContainText('(v2)');
  }
  await page.goto('/receivables');
  const row = page.getByRole('row').filter({ has: page.locator('strong[title="billing-revision"]') });
  await expect(row).toContainText('80.00');
  await row.getByRole('button', { name: 'Registrar pago' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Monto').fill('0.014');
  await dialog.getByRole('button', { name: 'Aplicar pago' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Monto').fill('10.29');
  await dialog.getByLabel('Medio de pago').selectOption('CHECK');
  await dialog.getByLabel('Número de reserva').fill('RES-SINTETICA');
  await dialog.getByRole('button', { name: 'Aplicar pago' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText('69.71');
  await page.reload();
  await expect(row).toContainText('69.71');
  const paymentRow = page.getByRole('row').filter({ hasText: 'RES-SINTETICA' });
  const download = page.waitForEvent('download');
  await paymentRow.getByRole('button', { name: /Comprobante/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await paymentRow.getByRole('button', { name: /Reversar/ }).click();
  await page.getByRole('dialog').getByLabel('Motivo').fill('Verificación sintética');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Confirmar/ })
    .click();
  await expect(row).toContainText('80.00');
  await page.goto('/payments');
  await expect(page.getByRole('row').filter({ hasText: 'RES-SINTETICA' })).toContainText(
    'Reversado',
  );
});

test('logout has one label and doctor page omits internal storage instructions', async ({
  page,
}) => {
  await login(page);
  await page.goto('/doctors');
  await expect(page.getByText('En Mongo, guarde primero el médico.', { exact: false })).toHaveCount(
    0,
  );
  const logout = page.locator('.account-logout-quick');
  await expect(logout).toHaveText('Cerrar sesión');
  await logout.click();
  await expect(page).toHaveURL(/\/login/);
});
