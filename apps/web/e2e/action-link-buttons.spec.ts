import { expect, test, type Locator, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function expectVisibleButton(link: Locator) {
  await expect(link).toBeVisible();
  const appearance = await link.evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      borderRadius: Number.parseFloat(style.borderRadius),
      borderWidth: Number.parseFloat(style.borderTopWidth),
      display: style.display,
      height: box.height,
      textDecoration: style.textDecorationLine,
    };
  });

  expect(['flex', 'inline-flex', 'grid']).toContain(appearance.display);
  expect(appearance.borderWidth).toBeGreaterThanOrEqual(1);
  expect(appearance.borderRadius).toBeGreaterThanOrEqual(8);
  expect(appearance.height).toBeGreaterThanOrEqual(32);
  expect(appearance.textDecoration).toBe('none');
}

test('Consultar and the equivalent workspace actions are visible, functional buttons', async ({
  page,
}) => {
  await login(page);

  await page.goto('/quotes');
  const quoteAction = page.getByRole('link', { name: 'Consultar', exact: true }).first();
  await expectVisibleButton(quoteAction);
  await quoteAction.click();
  await expect(page).toHaveURL(/\/quotes\/[^/?#]+$/);

  await page.goto('/dashboard');
  await expectVisibleButton(page.getByRole('link', { name: 'Ver cotizaciones', exact: true }));

  await page.goto('/patients');
  await expectVisibleButton(page.getByRole('link', { name: /Detalle de / }).first());

  await page.goto('/hospitalizations');
  await expectVisibleButton(page.getByRole('link', { name: 'Gestionar', exact: true }).first());
});

// test-id: playwright:workspace-action-link-buttons
test('all released workspace screens avoid bare text links for task actions', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);

  const menuRoutes = await page
    .locator('.sidebar a[href]')
    .evaluateAll((links) =>
      Array.from(
        new Set(
          links
            .map((link) => link.getAttribute('href'))
            .filter((href): href is string => Boolean(href?.startsWith('/'))),
        ),
      ),
    );
  const routes = [
    ...menuRoutes,
    '/quotes/quote-demo-001',
    '/patients/patient-demo-001',
    '/hospitalizations/case-demo-001',
  ];
  const violations: string[] = [];

  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('.main-content')).toBeVisible();
    const routeViolations = await page.locator('.main-content a[href]').evaluateAll((links) => {
      const taskVerb =
        /^(abrir|consultar|ver|gestionar|editar|descargar|administrar|volver|revisar|ir al|nuevo)\b/i;
      return links.flatMap((link) => {
        const element = link as HTMLElement;
        const text = (element.innerText || element.getAttribute('aria-label') || '').trim();
        if (!taskVerb.test(text) || element.getClientRects().length === 0) return [];
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        const looksLikeButton =
          Number.parseFloat(style.borderTopWidth) >= 1 &&
          Number.parseFloat(style.borderRadius) >= 6 &&
          box.height >= 30 &&
          style.textDecorationLine === 'none';
        return looksLikeButton ? [] : [text];
      });
    });
    violations.push(...routeViolations.map((label) => `${route}: ${label}`));
  }

  expect(violations).toEqual([]);
});
