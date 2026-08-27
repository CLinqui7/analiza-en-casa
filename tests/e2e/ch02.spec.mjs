import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const evidenceDir = resolve(projectRoot, "docs/parity/screenshots");

async function login(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#login-form input[name="email"]').fill("admin@analiza.demo");
  await page.locator('#login-form input[name="password"]').fill("Demo2026!");
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
}

test("CH02 reproduce el formulario por secciones y seguro condicional sin consentimiento implícito", async ({ page }) => {
  await login(page);
  await page.goto("/#/pacientes");
  await page.getByRole("button", { name: "Nuevo", exact: true }).click();
  await expect(page).toHaveURL(/#\/pacientes\/nuevo$/);
  await expect(page.getByRole("heading", { name: "Paciente nuevo", exact: true })).toBeVisible();
  for (const section of ["Datos del paciente", "Información de seguro", "Información de contactos", "Información de dirección"])
    await expect(page.getByRole("heading", { name: section, exact: true })).toBeVisible();
  await expect(page.locator('input[name="notifyWhatsApp"]')).not.toBeChecked();
  await expect(page.locator('select[name="insurerId"]')).toHaveValue("REGULAR");
  await expect(page.locator(".patient-insurance-fields").first()).toBeHidden();

  await page.locator('select[name="insurerId"]').selectOption("INS-001");
  await expect(page.locator(".patient-insurance-fields").first()).toBeVisible();
  await page.locator('input[name="document"]').fill("99999999-9");
  await page.locator('input[name="fullName"]').fill("Paciente Sintética CH02");
  await page.locator('input[name="birthDate"]').fill("1990-01-01");
  await page.locator('input[name="isPolicyHolder"][value="true"]').check();
  await expect(page.locator('input[name="insuredDocument"]')).toHaveValue("99999999-9");
  await expect(page.locator('input[name="insuredName"]')).toHaveValue("Paciente Sintética CH02");
  await expect(page.getByRole("button", { name: "Agregar", exact: true })).toBeDisabled();
  await page.locator('select[name="insurerId"]').selectOption("REGULAR");
  await expect(page.locator(".patient-insurance-fields").first()).toBeHidden();
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator(".toast button").click().catch(() => {});
  await page.screenshot({ path: resolve(evidenceDir, "ch02-patient-form-1440x900.png"), fullPage: true });
});

test("CH02 guarda, persiste y edita un paciente sintético", async ({ page }) => {
  await login(page);
  await page.goto("/#/pacientes/nuevo");
  await page.locator('input[name="document"]').fill("99999999-8");
  await page.locator('input[name="fullName"]').fill("Paciente Sintética Persistente");
  await page.locator('input[name="birthDate"]').fill("1990-01-01");
  await page.locator('input[name="sex"][value="F"]').check();
  await page.locator('input[name="phone"]').fill("+503 7000-0000");
  await page.locator('input[name="company"]').fill("Empresa Demo");
  await page.locator('input[name="address"]').fill("Dirección sintética");
  await page.locator('input[name="addressComments"]').fill("Referencia sintética");
  expect(await page.locator("#patient-form").evaluate((form) => ({
    valid: form.checkValidity(),
    invalid: [...form.elements].filter((control) => !control.checkValidity?.()).map((control) => control.name)
  }))).toEqual({ valid: true, invalid: [] });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Paciente Sintética Persistente", exact: true })).toBeVisible();
  const detailUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(detailUrl);
  await expect(page.getByRole("heading", { level: 1, name: "Paciente Sintética Persistente", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Editar paciente", exact: true }).click();
  await expect(page).toHaveURL(/\/editar$/);
  await page.locator('input[name="occupation"]').fill("Ocupación sintética");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Paciente actualizado.")).toBeVisible();
});

test("CH02 mantiene la página completa utilizable en móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/#/pacientes/nuevo");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("heading", { name: "Paciente nuevo", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator(".toast button").click().catch(() => {});
  await page.screenshot({ path: resolve(evidenceDir, "ch02-patient-form-mobile-390x844.png"), fullPage: true });
});
