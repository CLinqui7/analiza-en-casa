import { expect, test } from '@playwright/test';

test('imported practices remain visible and survive primary profile edits at desktop and mobile widths', async ({
  page,
}) => {
  // test-id: playwright:doctor-directory-practices
  await page.goto('/login?next=/doctors');
  await page.getByLabel('Usuario o correo').fill('admin@demo.local');
  await page.getByLabel('Clave').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/doctors$/);
  await page.evaluate(() => {
    const doctors = Array.from({ length: 700 }, (_, i) => ({
      id: `directory-qa-${i}`,
      fullName: `Profesional sintético ${i}`,
      specialty: 'Especialidad sintética',
      attachments: [],
      practiceLocations: [
        {
          id: 'practice-a',
          clinicName: 'Clínica principal QA',
          address: 'Dirección sintética',
          phone: '7777-0000',
          email: 'qa@example.test',
          city: 'Ciudad QA',
          department: 'Departamento QA',
        },
        {
          id: 'practice-b',
          clinicName: 'Clínica adicional QA',
          address: 'Una dirección extensa de prueba '.repeat(12),
          landlinePhone: '2222-3333',
          email: 'contacto-adicional@example.test',
        },
      ],
    }));
    localStorage.setItem('analiza.en.casa.workspace.v3.doctors', JSON.stringify(doctors));
  });
  await page.reload();
  await page.getByLabel(/Buscar médico por/).fill('Profesional sintético 699');
  await page.getByRole('button', { name: 'Editar médico' }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar médico' });
  await dialog.getByText('Clínicas y contactos del directorio (2)', { exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Clínica adicional QA' })).toBeVisible();
  await expect(
    dialog.getByText('Correo: contacto-adicional@example.test', { exact: true }),
  ).toBeVisible();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 2)).toBe(true);
    if (process.env.ANALIZA_CAPTURE_DOCTOR_DIRECTORY === '1')
      await page.screenshot({
        path: `docs/imports/evidence/doctors-directory-${width}.png`,
        animations: 'disabled',
      });
  }
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(dialog.getByText('Ingrese el teléfono fijo.', { exact: true })).toBeVisible();
  await dialog.getByLabel('Teléfono fijo (obligatorio)').fill('2222-4444');
  await dialog.getByLabel(/Relación del médico/).selectOption('RECURRENT');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page.getByLabel(/Buscar médico por/).fill('Profesional sintético 699');
  await page.getByRole('button', { name: 'Editar médico' }).click();
  await expect(dialog.getByLabel('Teléfono fijo (obligatorio)')).toHaveValue('2222-4444');
  await dialog.getByText('Clínicas y contactos del directorio (2)', { exact: true }).click();
  await expect(
    dialog.getByText('Correo: contacto-adicional@example.test', { exact: true }),
  ).toBeVisible();
});
