import { expect, test } from '@playwright/test';

// test-id: playwright:ch07-hospitalization-quote-tracking

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login?next=%2Fhospitalizations');
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/hospitalizations$/);
}

test('CH07 hospital quote tracking filters, searches and paginates without sending insurance work', async ({
  page,
}) => {
  await login(page);
  await page.evaluate(() => {
    const key = 'analiza.en.casa.workspace.v3.quotes';
    const quotes = JSON.parse(localStorage.getItem(key) ?? '[]');
    const base = quotes[0] ?? {
      patientId: 'patient-demo-001',
      caseId: 'case-ch07',
      total: 0,
      patientAmount: 0,
      insurerAmount: 0,
      items: [],
      metadata: {},
    };
    const fixtures = Array.from({ length: 26 }, (_, index) => index + 1).map((number) => ({
      ...base,
      id: `quote-ch07-${number}`,
      createdAt: `2026-09-${String(number).padStart(2, '0')}T12:00:00.000Z`,
      status: number === 26 ? 'SENT' : 'DRAFT',
    }));
    localStorage.setItem(key, JSON.stringify([...quotes, ...fixtures]));
  });
  await page.reload();
  await page.getByRole('tab', { name: 'Cotizaciones' }).click();

  for (const header of [
    'Paciente',
    'DUI/NIT',
    'Nro.',
    'Estado',
    'Envío preautorización',
    'Respuesta seguro',
    'Envío de reclamo',
    'Creación',
    'Total',
  ])
    await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
  await expect(page.getByText('No enviado').first()).toBeVisible();
  await expect(page.getByText('No aplica').first()).toBeVisible();
  await expect(page.locator('tbody').getByText('Pendiente').first()).toBeVisible();

  await page.getByLabel('Estado').selectOption('SENT');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.getByRole('link', { name: 'quote-ch07-26' })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);

  await page.getByLabel('Fecha de creación').fill('2000-01-01');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.getByText('Sin cotizaciones', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
  await expect(page.getByLabel('Estado')).toHaveValue('');
  await expect(page.getByLabel('Fecha de creación')).toHaveValue('');

  await page.getByLabel('Registros').selectOption('5');
  await expect(page.locator('tbody tr')).toHaveCount(5);
  const next = page.getByRole('button', { name: 'Siguiente', exact: true });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByRole('link', { name: 'quote-ch07-6' })).toBeVisible();
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();
  await page.getByLabel('Buscar cotización').fill('quote-ch07-26');
  await expect(page.getByRole('link', { name: 'quote-ch07-26' })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(
    page.getByText('no se crean preautorizaciones, envíos ni reclamos', { exact: false }),
  ).toBeVisible();
});
