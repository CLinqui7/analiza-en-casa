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
  await expect(page.getByRole("heading", {name:"Dashboard",exact:true})).toBeVisible();
}

async function prepareEvidenceScreenshot(page) {
  const closeButtons = page.locator(".toast button");
  while (await closeButtons.count()) await closeButtons.first().click();
  await page.evaluate(()=>window.scrollTo(0,0));
}

test("CH12 reproduce pagos por servicio y bloquea cambios financieros no aprobados", async ({page}) => {
  await login(page);
  await page.goto("/#/cuentas-por-pagar");
  await expect(page.getByRole("heading",{name:"Cuentas por pagar",exact:true})).toBeVisible();
  for (const label of ["Resumen","Pagos de Servicio","Generar planilla","Restricciones","Descargar","Limpiar Tabla"])
    await expect(page.getByRole(label === "Resumen" || label === "Pagos de Servicio" ? "button" : "button",{name:label,exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Facturas",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Reclamos",exact:true})).toBeVisible();

  await page.getByRole("button",{name:"Pagos de Servicio",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Pagos de Servicio",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Filtros",exact:true}).click();
  await expect(page.getByRole("region",{name:"Filtros de pagos"})).toBeVisible();
  await page.locator('[data-ui-filter="payablesDateFrom"]').fill("2026-08-01");
  await page.locator('[data-ui-filter="payablesDateTo"]').fill("2026-08-31");
  await page.locator('[data-ui-filter="payablesResourceId"]').selectOption({index:1});
  await page.getByRole("button",{name:"Aplicar",exact:true}).click();
  await expect(page.locator(".payables-table tbody tr").first()).toBeVisible();
  await page.locator('[data-input="payables-search"]').fill("Elena");
  await expect(page.locator(".payables-table tbody tr").first()).toContainText("Elena");

  await page.locator('[data-action="open-professional-payment"]').first().click();
  await expect(page.getByRole("dialog").getByRole("heading",{name:"Pago de servicios profesionales",exact:true})).toBeVisible();
  for (const name of ["date","hospitalization","resource","patient","rate","amount","status"])
    await expect(page.locator(`#professional-payment-form [name="${name}"]`)).toHaveAttribute("readonly","");
  await page.getByRole("dialog").getByRole("button",{name:"Agregar",exact:true}).click();
  await expect(page.getByRole("dialog").getByRole("heading",{name:"Agregar Concepto",exact:true})).toBeVisible();
  await page.locator('#professional-concept-form [name="type"]').selectOption("DISCOUNT");
  await expect(page.locator('#professional-concept-form [name="reason"] option')).toContainText(["Seleccione","Retraso","Mal agendado","No asistió","Cambio del turno","Planilla","Paciente Hospitalizado","Paciente Falleció","NO CIERRE DE VISITA A TIEMPO","Transporte","Cumplimiento incorrecto"]);
  await page.locator('#professional-concept-form [name="reason"]').selectOption({label:"Retraso"});
  await page.locator('#professional-concept-form [name="amount"]').fill("10");
  await page.getByRole("dialog").getByRole("button",{name:"Agregar",exact:true}).click();
  await expect(page.getByText(/Operación financiera bloqueada/)).toBeVisible();

  await page.getByRole("dialog").getByRole("button",{name:"Cancelar",exact:true}).click();
  await page.getByRole("dialog").getByRole("button",{name:"Guardar",exact:true}).click();
  await expect(page.getByText(/Operación financiera bloqueada/).last()).toBeVisible();
  await page.getByRole("dialog").getByRole("button",{name:"Cancelar",exact:true}).click();
  await prepareEvidenceScreenshot(page);
  await page.screenshot({path:resolve(evidenceDir,"ch12-payables-1440x900.png"),fullPage:true});
});

test("CH12 conserva tablas utilizables sin overflow global en móvil", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await login(page);
  await page.goto("/#/cuentas-por-pagar");
  await page.getByRole("button",{name:"Pagos de Servicio",exact:true}).click();
  await expect(page.locator(".payables-table")).toBeVisible();
  expect(await page.locator(".table-wrap").filter({has:page.locator(".payables-table")}).evaluate((wrap)=>wrap.scrollWidth>wrap.clientWidth)).toBeTruthy();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("button",{name:"Editar Grupo",exact:true}).click();
  await expect(page.getByText(/Operación financiera bloqueada/)).toBeVisible();
  await prepareEvidenceScreenshot(page);
  await page.screenshot({path:resolve(evidenceDir,"ch12-payables-mobile-390x844.png"),fullPage:true});
});
