import { expect, test } from '@playwright/test';
import { readdirSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoQuotes } from '../src/lib/demo-data';

const workspace = fileURLToPath(new URL('../src/app/(workspace)', import.meta.url));
function routes(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() && !entry.name.startsWith('[')
      ? routes(resolve(dir, entry.name), `${prefix}/${entry.name}`)
      : entry.name === 'page.tsx'
        ? [prefix]
        : [],
  );
}
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill('webmaster@demo.local');
  await page.getByLabel('Clave').fill('demo-webmaster');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('category discount survives recovery and saving with only the selected categories', async ({
  page,
}, info) => {
  await page.evaluate(() =>
    localStorage.setItem(
      'analiza.en.casa.workspace.v3.doctors',
      JSON.stringify([
        {
          id: 'doctor-discount-qa',
          fullName: 'Médico QA descuento',
          specialty: 'General',
          attachments: [],
        },
      ]),
    ),
  );
  await page.goto('/quotes?create=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Médico tratante principal').selectOption('doctor-discount-qa');
  await dialog.getByRole('tab', { name: 'Honorarios' }).click();
  await dialog.getByLabel('Servicio de honorario').selectOption({ index: 1 });
  await dialog.getByLabel('Honorario médico').selectOption('35');
  await dialog.getByLabel('Cantidad').fill('2');
  await dialog.getByRole('button', { name: 'Agregar línea' }).click();
  await dialog.getByLabel('Porcentaje único').fill('10');
  await dialog.getByRole('checkbox', { name: /Honorarios/ }).check();
  await expect(dialog.locator('.discount-preview')).toContainText('USD 7.00');
  await expect(dialog.locator('.discount-preview')).toContainText('USD 63.00');
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.values(sessionStorage).some((value) => value.includes('CATEGORY_PERCENTAGES')),
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(dialog.getByRole('checkbox', { name: /Honorarios/ })).toBeChecked();
  await expect(dialog.getByLabel('Porcentaje único')).toHaveValue('10');
  await dialog.getByRole('checkbox', { name: /Honorarios/ }).uncheck();
  await dialog.getByRole('checkbox', { name: /Medicamentos/ }).check();
  await expect(dialog.locator('.discount-preview')).toContainText('USD 0.00');
  await dialog.getByRole('checkbox', { name: /Honorarios/ }).check();
  await dialog.getByLabel('Porcentaje único').fill('20');
  await expect(dialog.locator('.discount-preview')).toContainText('USD 14.00');
  await dialog.locator('.discount-preview').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('discount.png') });
  await dialog.locator('[data-action-id="QUOTE-PATIENT-SELECT"]').selectOption({ index: 1 });
  await dialog.getByLabel('Ingreso clínico').selectOption('HOME_OUTPATIENT');
  await dialog
    .getByLabel('Diagnóstico', { exact: true })
    .fill('Verificación sintética de descuento');
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('analiza.en.casa.workspace.v3.quotes') ?? '[]').find(
      (quote: { diagnosisSummary: string }) =>
        quote.diagnosisSummary === 'Verificación sintética de descuento',
    ),
  );
  expect(saved.total).toBe(56);
  expect(saved.discount.categories).toEqual({ FEES: 20, MEDICATIONS: 20 });
});

test('attention dates keep compact buttons and a single Save on desktop and mobile', async ({
  page,
}, info) => {
  await page.evaluate(() =>
    localStorage.setItem(
      'analiza.en.casa.workspace.v3.nursingResources',
      JSON.stringify([
        {
          id: 'nurse-ui-qa',
          userId: 'nurse-ui-user',
          displayName: 'Enfermería QA',
          territory: 'Zona QA',
          shift: 'MORNING',
          availability: 'AVAILABLE',
          capacity: 3,
          boardRegistrationNumber: 'REG-QA',
        },
      ]),
    ),
  );
  await page.goto('/clinical/hospitalizations');
  await page.getByRole('button', { name: 'Atención' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[data-action-id="CLINICAL-SCHEDULE-NURSE"]').selectOption('nurse-ui-qa');
  const add = dialog.getByRole('button', { name: 'Agregar fecha' });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (let index = 0; index < 3; index++) await add.click();
    const dimensions = await add.boundingBox();
    expect(dimensions?.height).toBeLessThanOrEqual(60);
    expect(dimensions?.width).toBeLessThanOrEqual(240);
    expect(
      await dialog.locator('.dialog-content').evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(1);
    await expect(dialog.getByRole('button', { name: 'Guardar', exact: true })).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: /Puntual/ })).toHaveCount(0);
    await add.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`attention-${width}.png`) });
  }
});

test('check payments request a reservation number', async ({ page }) => {
  await page.evaluate((quotes) => {
    const key = 'analiza.en.casa.workspace.v3.quotes';
    localStorage.setItem(
      key,
      JSON.stringify(quotes.map((quote: object) => ({ ...quote, status: 'SENT' }))),
    );
  }, demoQuotes);
  await page.goto('/receivables');
  await page.getByRole('button', { name: 'Aplicar pago', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Aplicar pago' });
  await dialog.getByLabel('Medio de pago').selectOption('CHECK');
  await expect(dialog.getByLabel('Número de reserva')).toBeVisible();
  await expect(dialog.getByLabel('Número de cheque')).toHaveCount(0);
});

test('medical visitors have a dedicated page and explain when a server connection is required', async ({
  page,
}) => {
  for (const path of ['/catalogs/services', '/catalogs/operational']) {
    await page.goto(path);
    await expect(page.locator('.sidebar a[aria-current="page"]')).toHaveCount(1);
  }
  await page.goto('/catalogs/medical-visitors');
  await expect(page.getByRole('heading', { name: 'Visitadores médicos', level: 1 })).toBeVisible();
  await expect(page.locator('.sidebar a[aria-current="page"]')).toHaveCount(1);
  await page.getByRole('button', { name: '+ Agregar visitador' }).click();
  await page.getByLabel('Nombre / descripción').fill('Visitadora QA sintética');
  await page.getByRole('button', { name: 'Guardar visitador' }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Esta operación necesita conexión segura con el servidor.',
  );
  await expect(page.getByLabel('Nombre / descripción')).toHaveValue('Visitadora QA sintética');
});

for (const width of [1440, 390]) {
  test(`all workspace pages fit the viewport at ${width}px`, async ({ page }, info) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const paths = [
      ...routes(workspace),
      '/patients/patient-demo-001',
      '/hospitalizations/case-demo-001',
    ];
    const screenshots = resolve(info.outputDir, 'pages');
    mkdirSync(screenshots, { recursive: true });
    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator('.main-content')).toBeVisible();
      await page
        .locator('.main-content h1')
        .first()
        .waitFor({ timeout: 10000 })
        .catch(() => undefined);
      await page.screenshot({
        path: resolve(screenshots, `${path.replaceAll('/', '_') || 'home'}.png`),
      });
      const layout = await page.evaluate(() => {
        const main = document.querySelector('.main-content') as HTMLElement;
        return {
          page: document.documentElement.scrollWidth - innerWidth,
          main: main.scrollWidth - main.clientWidth,
        };
      });
      expect.soft(layout.page, `${path}: document overflow`).toBeLessThanOrEqual(1);
      expect.soft(layout.main, `${path}: content overflow`).toBeLessThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  });
}
