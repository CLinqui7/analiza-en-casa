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

test("CH09 lista hospitalizaciones clínicas y guarda un perfil en borrador append-only", async ({ page }) => {
  await login(page);
  await page.goto("/#/clinica/hospitalizaciones");
  await expect(page.getByRole("heading", {name: "Hospitalización clínica", exact: true})).toBeVisible();
  for (const selector of ['[data-ui-filter="clinicalStatus"]', 'input[value="Personal autorizado"]', '[data-ui-filter="clinicalServiceType"]', '[data-ui-filter="clinicalAttentionType"]'])
    await expect(page.locator(selector)).toBeVisible();
  await page.getByLabel(/Acciones clínicas de/).first().click();
  for (const label of ["Perfil clínico", "Relevos", "Reingresos", "Reinfecciones", "Ulceraciones", "Near miss"])
    await expect(page.getByText(label, {exact: true}).first()).toBeVisible();
  await page.getByRole("button", {name: "Perfil clínico", exact: true}).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", {name: "Perfiles Clínicos", exact: true})).toBeVisible();
  await page.getByRole("button", {name: "+ Nuevo perfil clínico", exact: true}).click();
  await expect(page.getByRole("dialog").getByRole("heading", {name: "Detalles de Hospitalización", exact: true})).toBeVisible();
  const form = page.locator("#clinical-profile-form");
  await form.locator('[name="startDate"]').fill("2026-06-01");
  await form.locator('[name="endDate"]').fill("2026-06-15");
  await form.locator('[name="diagnosisCode"]').fill("SYN-CH09-E2E");
  await form.locator('[name="diagnosisLabel"]').fill("Descripción clínica sintética de navegador");
  await form.locator('[name="diagnosisGroup"]').fill("Grupo configurable QA");
  await form.locator('[name="triage"]').fill("Clasificación documentada QA");
  await form.locator('[name="profileGroup"]').fill("Grupo perfil QA");
  await form.locator('[name="profileSubgroup"]').fill("Subgrupo perfil QA");
  await form.locator('[name="patientType"]').fill("Tipo configurable QA");
  await form.locator('[name="serviceType"]').fill("Servicio configurable QA");
  await form.locator('[name="deviceType"]').fill("Dispositivo sintético QA");
  await form.locator('[name="deviceDate"]').fill("2026-06-02");
  await form.locator('[name="shiftStartDate"]').fill("2026-06-01");
  await form.locator('[name="shiftEndDate"]').fill("2026-06-15");
  await page.getByRole("button", {name: "Guardar borrador", exact: true}).click();
  await expect(page.getByText("Perfil clínico guardado como borrador append-only.", {exact: true})).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("heading", {name: "Perfiles Clínicos", exact: true})).toBeVisible();
  await expect(page.getByRole("dialog").getByText("DRAFT", {exact: true})).toBeVisible();
  await page.getByRole("dialog").locator('.modal-footer [data-action="close-modal"]').click();
  await page.screenshot({path: resolve(evidenceDir, "ch09-clinical-profile-1440x900.png"), fullPage: true});
});

test("CH09 carga rango, seis secciones y configuración ordenable del reporte", async ({ page }) => {
  await page.setViewportSize({width: 390, height: 844});
  await login(page);
  await page.goto("/#/clinica/reportes");
  await expect(page.getByRole("heading", {name: "Reporte de salud", exact: true})).toBeVisible();
  await expect(page.getByLabel("Paginación de reportes")).toBeVisible();
  await page.getByRole("link", {name: /^HOS-/}).first().click();
  await expect(page.getByRole("heading", {name: /Reporte de salud del/})).toBeVisible();
  for (const label of ["Información Principal", "Evaluación Clínica", "Atención Médica", "Tratamientos y Órdenes", "Eventos Clínicos", "Evidencia y Documentos"])
    await expect(page.getByRole("button", {name: label, exact: true})).toBeVisible();
  await page.getByRole("button", {name: "Evaluación Clínica", exact: true}).click();
  await expect(page.getByRole("navigation", {name: "Secciones de evaluación clínica"})).toBeVisible();
  await page.getByRole("button", {name: "Cambiar rango de fechas", exact: true}).click();
  await page.locator('#health-report-range-form input[name="start"]').fill("2026-06-01");
  await page.locator('#health-report-range-form input[name="end"]').fill("2026-06-15");
  await page.getByRole("button", {name: "Cargar", exact: true}).click();
  await expect(page.getByRole("heading", {name: /01 jun 2026 al 15 jun 2026/i})).toBeVisible();
  await page.getByRole("button", {name: "Imprimir", exact: true}).click();
  const configDialog = page.getByRole("dialog");
  await expect(configDialog.getByRole("heading", {name: "Configuration report", exact: true})).toBeVisible();
  await expect(configDialog.getByText("Include attached documents", {exact: false})).toBeVisible();
  await expect(configDialog.getByText(/Tabla de Signos Vitales/, {exact: false})).toBeVisible();
  await configDialog.getByRole("button", {name: /Bajar Tabla de Signos Vitales/}).click();
  await expect(configDialog.getByText("3. Tabla de Signos Vitales", {exact: true})).toBeVisible();
  await configDialog.locator('.modal-footer [data-action="close-modal"]').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path: resolve(evidenceDir, "ch09-health-report-390x844.png"), fullPage: true});
});
