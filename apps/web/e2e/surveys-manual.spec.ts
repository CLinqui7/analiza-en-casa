import { expect, test } from '@playwright/test';

test('unlisted doctor form requires a self-reported name and consumes its link', async ({
  page,
}) => {
  const token = 'A'.repeat(43);
  let submitted: Record<string, unknown> | null = null;
  await page.route('**/api/surveys/public', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (body.action === 'LOOKUP') {
      await route.fulfill({
        json: {
          kind: 'DOCTOR',
          questions: [{ text: '¿Cómo califica la atención?', options: ['Buena', 'Mala'] }],
        },
      });
      return;
    }
    submitted = body;
    await route.fulfill({ json: { accepted: true } });
  });
  await page.goto(`/survey?o=qa-org#${token}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByLabel('Nombre del médico')).toBeVisible();
  await page.getByLabel('Nombre del médico').fill('Doctora QA');
  await page.getByLabel('Buena').check();
  await page.getByRole('button', { name: 'Enviar respuesta' }).click();
  await expect(page.getByRole('status')).toContainText('Su respuesta fue registrada');
  expect(submitted).toMatchObject({
    action: 'SUBMIT',
    organizationId: 'qa-org',
    token,
    respondentName: 'Doctora QA',
    answers: ['Buena'],
  });
  await expect(page).toHaveURL(/\/survey$/);
});
