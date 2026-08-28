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

test("CH04 busca paciente, autocompleta datos y conserva factura obligatoria", async ({ page }) => {
  await login(page);
  await page.goto("/#/cotizaciones/nueva");
  const patientInput = page.locator('input[name="patientSearch"]');
  await expect(patientInput).toHaveAttribute("list", "quote-patient-options");
  const options = await page.locator("#quote-patient-options option").evaluateAll((nodes) => nodes.map((node) => node.value));
  expect(options.length).toBeGreaterThan(1);
  await patientInput.fill("Paciente inexistente");
  await patientInput.dispatchEvent("change");
  await expect(page.locator('input[name="patientSearch"]')).toHaveValue("");
  await expect(page.locator('input[name="patientDocument"]')).toHaveValue("");
  const refreshedPatientInput = page.locator('input[name="patientSearch"]');
  await refreshedPatientInput.fill(options[1]);
  await refreshedPatientInput.dispatchEvent("change");
  await expect(page.locator('input[name="patientDocument"]')).not.toHaveValue("");
  await expect(page.locator('input[name="patientPhone"]')).not.toHaveValue("");
  await expect(page.locator('input[name="patientEmail"]')).not.toHaveValue("");
  await expect(page.locator('input[name="invoiceDate"]')).not.toHaveValue("");
  await page.locator('button[data-action="open-quote-date-picker"]').click();
  await expect(page.getByRole("dialog", { name: "Seleccionar fecha" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Seleccionar", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.locator('select[name="discountGroupId"]')).toHaveValue("REGULAR");
  await expect(page.locator('textarea[name="comments"]')).toHaveAttribute("required", "");
});

test("CH04 permite referencias múltiples removibles y expone siete categorías", async ({ page }) => {
  await login(page);
  await page.goto("/#/cotizaciones/nueva");
  await page.locator('input[name="referralCandidate"]').fill("Referencia fuera de catálogo");
  await page.locator('input[name="referralCandidate"]').dispatchEvent("change");
  await expect(page.locator(".referral-tags span")).toHaveCount(0);
  await expect(page.locator(".toast-danger").filter({ hasText: "Seleccione una referencia autorizada" }).last()).toBeVisible();
  await page.locator(".toast button").last().click();
  await page.locator('button[data-action="open-quote-referral"]').click();
  await page.locator('#quote-referral-form input[name="label"]').fill("Referencia sintética A");
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.locator(".referral-tags")).toContainText("Referencia sintética A");
  await page.locator('button[data-action="open-quote-referral"]').click();
  await page.locator('#quote-referral-form input[name="label"]').fill("Referencia sintética B");
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.locator(".referral-tags span")).toHaveCount(2);
  await page.locator(".referral-tags button").first().click();
  await expect(page.locator(".referral-tags span")).toHaveCount(1);
  await page.locator('button[data-action="open-quote-referral"]').click();
  await expect(page.getByRole("dialog", { name: "Agregar referencia" })).toBeVisible();
  await page.locator('#quote-referral-form input[name="label"]').fill("Referencia sintética C");
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.locator(".referral-tags")).toContainText("Referencia sintética C");
  for (const category of ["Servicios", "Estudios Dx", "Medicamentos", "Insumos", "Equipos", "Honorarios", "Extras"])
    await expect(page.getByRole("button", { name: category, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Estudios Dx", exact: true }).click();
  await expect(page.getByRole("button", { name: "Estudios Dx", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Solo disponibles en inventario", { exact: true })).toBeVisible();
  await expect(page.getByText("* Socio de negocios", { exact: true })).toBeVisible();
  await page.locator(".toast").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: resolve(evidenceDir, "ch04-quote-general-1440x900.png"), fullPage: true });
});

test("CH04 mantiene la página de cotización sin desbordamiento global en móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/#/cotizaciones/nueva");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("heading", { level: 1, name: "Nueva cotización", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Extras", exact: true })).toBeVisible();
  await page.locator(".toast button").click().catch(() => {});
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: resolve(evidenceDir, "ch04-quote-general-mobile-390x844.png"), fullPage: true });
});
