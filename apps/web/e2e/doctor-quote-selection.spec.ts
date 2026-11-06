import { expect, test } from '@playwright/test';

test('700 historical doctors support normalized searches, distinct choices and saved quote selection', async ({
  page,
}) => {
  // test-id: playwright:doctor-quote-selection
  await page.goto('/login?next=/doctors');
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/doctors$/);
  await page.evaluate(() => {
    const doctors = Array.from({ length: 697 }, (_, i) => ({
      id: `doctor-volume-${i}`,
      fullName: `Profesional sintético ${i}`,
      specialty: 'Especialidad QA',
      attachments: [],
    }));
    localStorage.setItem(
      'analiza.en.casa.workspace.v3.doctors',
      JSON.stringify([
        ...doctors,
        {
          id: 'doctor-accent-a',
          fullName: 'Ángela Núñez',
          specialty: 'Cardiología QA',
          jvpm: '000145',
          phone: '7777-0101',
          attachments: [],
        },
        {
          id: 'doctor-accent-b',
          fullName: 'Ángela Núñez',
          specialty: 'Especialidad QA',
          jvpm: '000146',
          attachments: [],
        },
        {
          id: 'doctor-secondary',
          fullName: 'Óscar Pérez',
          specialty: 'Medicina QA',
          conadem: 'CN-0045',
          attachments: [],
          practiceLocations: [
            {
              id: 'practice-qa',
              clinicName: 'Clínica Corazón QA',
              city: 'Ciudad QA',
              phone: '7777-0202',
            },
          ],
        },
      ]),
    );
  });
  await page.reload();
  await page.getByLabel(/Buscar médico por/).fill('  nunez  angela  ');
  await expect(page.getByRole('button', { name: 'Editar médico', exact: true })).toHaveCount(2);
  await expect(page.getByText('Celular: 7777-0101', { exact: true })).toBeVisible();
  await page.goto('/quotes?create=1');
  const dialog = page.getByRole('dialog', { name: 'Nueva cotización' });
  const search = dialog.locator('[data-action-id="QUOTE-DOCTOR-SEARCH"]');
  const primary = dialog.locator('[data-action-id="QUOTE-PRIMARY-DOCTOR"]');
  const secondary = dialog.locator('[data-action-id="QUOTE-SECONDARY-DOCTOR"]');
  await search.fill('nunez angela');
  await expect(primary.locator('option')).toHaveCount(3);
  await expect(primary.locator('option[value="doctor-accent-a"]')).toContainText('000145');
  await primary.selectOption('doctor-accent-a');
  await search.fill('corazon');
  await secondary.selectOption('doctor-secondary');
  await expect(primary).toHaveValue('doctor-accent-a');
  for (const query of ['cn-0045', 'oscar perez', 'medicina qa']) {
    await search.fill(query);
    await expect(secondary.locator('option[value="doctor-secondary"]')).toBeAttached();
  }
  await search.fill('sin coincidencia inexistente');
  await expect(primary).toHaveValue('doctor-accent-a');
  await expect(secondary).toHaveValue('doctor-secondary');
  await search.fill('');
  await expect(primary.locator('option')).toHaveCount(701);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 2)).toBe(true);
    const selectedName = dialog.locator('#quote-primary-doctor-summary');
    await expect(selectedName).toHaveText('Ángela Núñez · JVPM 000145 · Cardiología QA');
    await expect(primary).toHaveAccessibleDescription(
      'Ángela Núñez · JVPM 000145 · Cardiología QA',
    );
    expect(await selectedName.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  await dialog.locator('[data-action-id="QUOTE-PATIENT-SELECT"]').selectOption('patient-demo-001');
  // Selecting the patient can populate its doctors; explicitly choose this quote's doctors afterwards.
  await primary.selectOption('doctor-accent-a');
  await secondary.selectOption('doctor-secondary');
  await dialog.getByLabel('Ingreso clínico').selectOption('HOME_OUTPATIENT');
  await dialog.getByLabel('Diagnóstico', { exact: true }).selectOption({ index: 1 });
  await dialog.getByLabel('Responsable administrativo').fill('QA directorio histórico');
  await dialog.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByText('Borrador de cotización persistido.', { exact: true })).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('analiza.en.casa.workspace.v3.quotes') ?? '[]').find(
      (q: { manager?: string }) => q.manager === 'QA directorio histórico',
    ),
  );
  expect(saved.primaryDoctorId).toBe('doctor-accent-a');
  expect(saved.secondaryDoctorId).toBe('doctor-secondary');
  // Leave the explicit ?create=1 URL before reloading the saved quote.
  await page.goto(`/quotes/${saved.id}`);
  await page.reload();
  await page.getByRole('button', { name: 'Editar borrador', exact: true }).click();
  const edit = page.getByRole('dialog', { name: /Editar borrador/ });
  await expect(edit.locator('[data-action-id="QUOTE-PRIMARY-DOCTOR"]')).toHaveValue(
    'doctor-accent-a',
  );
  await expect(edit.locator('[data-action-id="QUOTE-SECONDARY-DOCTOR"]')).toHaveValue(
    'doctor-secondary',
  );
});
