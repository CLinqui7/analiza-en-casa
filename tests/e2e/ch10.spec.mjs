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
  await expect(page.getByRole("heading", {name:"Dashboard", exact:true})).toBeVisible();
}

test("CH10 reproduce lista, selector bifurcado, orden por secciones y consulta paciente-céntrica", async ({page}) => {
  await login(page);
  await page.goto("/#/clinica/ordenes");
  await expect(page.getByRole("heading", {name:"Orden Médica", exact:true})).toBeVisible();
  for (const label of ["Activos", "Inactivos", "Tratamientos con cambios", "Actualizaciones"])
    await expect(page.getByRole("button", {name:new RegExp(`^${label}`)})).toBeVisible();
  await expect(page.locator('[data-input="medical-order-search"]')).toBeVisible();
  await expect(page.getByLabel("Paginación de Orden Médica")).toBeVisible();

  const newForCase = page.locator('button[data-action="open-clinical-creation-choice"][data-case-id]:not([data-case-id=""])').first();
  await newForCase.click();
  await expect(page.getByRole("dialog").getByRole("heading", {name:"¿Qué quieres crear?", exact:true})).toBeVisible();
  await page.getByRole("button", {name:"Orden Médica", exact:true}).click();
  const form = page.locator("#medical-order-form");
  await expect(form).toBeVisible();
  await form.locator('[name="diagnosis"]').fill("Diagnóstico sintético CH10 E2E");
  await form.locator('[name="content-diet"]').fill("Dieta sintética documentada para QA");
  await form.locator('[name="content-nursingCare"]').fill("Cuidados sintéticos documentados para QA");
  await page.getByRole("button", {name:"Guardar borrador", exact:true}).click();
  await expect(page.getByText("Orden médica guardada como borrador.", {exact:true})).toBeVisible();
  await expect(page.getByRole("heading", {name:"Orden Médica", exact:true})).toBeVisible();

  await page.locator('button[data-action="view-patient-orders"]').first().click();
  await expect(page.getByRole("dialog").getByRole("heading", {name:"Órdenes", exact:true})).toBeVisible();
  for (const label of ["Órdenes médicas", "Tarjetas de medicamentos", "Historial de tratamientos"])
    await expect(page.getByRole("dialog").getByText(new RegExp(`^${label}`)).first()).toBeVisible();
  await page.screenshot({path:resolve(evidenceDir,"ch10-medical-orders-1440x900.png"),fullPage:true});
});

test("CH10 crea tarjeta estructurada, calcula fecha sugerida y expone tres salidas sin overflow móvil", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await login(page);
  await page.goto("/#/clinica/ordenes");
  await page.locator('button[data-action="open-clinical-creation-choice"][data-case-id]:not([data-case-id=""])').first().click();
  await page.getByRole("button", {name:"Tarjeta de medicamentos", exact:true}).click();
  const cardForm = page.locator("#medication-card-form");
  await expect(cardForm).toBeVisible();
  await cardForm.locator('[name="diagnosis"]').fill("Diagnóstico sintético CH10 tarjeta");
  await page.getByRole("button", {name:"+ Agregar tratamiento", exact:true}).click();

  const treatment = page.locator("#treatment-draft-form");
  await treatment.locator('[name="medication"]').fill("Medicamento sintético CH10 E2E");
  await treatment.locator('[name="doctorId"]').selectOption({index:1});
  await treatment.locator('[name="route"]').selectOption({label:"VO"});
  await treatment.locator('[name="dose"]').fill("Dato QA");
  await treatment.locator('[name="frequency"]').selectOption({label:"Cada 8 horas"});
  await treatment.locator('[name="startDate"]').fill("2026-08-27");
  await treatment.locator('[name="durationDays"]').fill("3");
  await treatment.locator('[name="durationDays"]').dispatchEvent("change");
  await expect(treatment.locator('[name="endDate"]')).toHaveValue("2026-08-29");
  await treatment.locator('[name="schedule"]').fill("08:00, 16:00, PRN");
  await treatment.locator('[name="indications"]').fill("Indicación sintética documentada");
  await treatment.locator('[name="showDilutions"]').check();
  await treatment.locator('[name="dilutions"]').fill("Dilución sintética documentada");
  await page.getByRole("button", {name:"Guardar tratamiento", exact:true}).click();
  await expect(page.getByText("Medicamento sintético CH10 E2E", {exact:true})).toBeVisible();
  await page.getByRole("button", {name:"Guardar tarjeta", exact:true}).click();
  await expect(page.getByText("Tarjeta de medicamentos creada como borrador.", {exact:true})).toBeVisible();
  await expect(page.getByRole("heading", {name:"Tarjeta de medicamentos", exact:true})).toBeVisible();
  for (const label of ["Tarjeta completa", "Tarjeta simple", "Conteo presencial"])
    await expect(page.getByRole("button", {name:label, exact:true}).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:resolve(evidenceDir,"ch10-medication-card-390x844.png"),fullPage:true});
});
