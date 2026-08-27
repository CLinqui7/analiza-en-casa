import { test, expect } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const evidenceDir = resolve(projectRoot, "docs/parity/screenshots");

async function openCleanLogin(page) {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    for (const registration of await navigator.serviceWorker?.getRegistrations?.() || []) await registration.unregister();
  });
  await page.reload();
  await expect(page.locator("#login-form")).toBeVisible();
}

async function login(page, email, password = "Demo2026!") {
  await page.locator('#login-form input[name="email"]').fill(email);
  await page.locator('#login-form input[name="password"]').fill(password);
  await page.locator('#login-form button[type="submit"]').click();
}

test("CH01 valida credenciales y muestra dashboard, navegación y menú exactos", async ({ page }) => {
  await openCleanLogin(page);
  await expect(page.locator('#login-form input[name="email"]')).toHaveValue("");
  await expect(page.locator('#login-form input[name="password"]')).toHaveValue("");

  await login(page, "persona-inexistente@analiza.demo");
  await expect(page.locator(".toast-danger")).toContainText("No fue posible iniciar sesión");
  await expect(page.locator("#login-form")).toBeVisible();
  await page.locator('[data-action="recover-password"]').click();
  await expect(page.locator(".toast-success")).toContainText("Si la cuenta existe");

  await page.locator('#login-form input[name="password"]').fill("incorrecta");
  await page.locator('#login-form button[type="submit"]').click();
  await expect(page.locator(".toast-danger").last()).toContainText("No fue posible iniciar sesión");

  await login(page, "admin@analiza.demo");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  for (const label of ["Pacientes con alertas", "Pacientes activos", "Tratamientos actualizados", "Tratamientos por finalizar", "Planes de cuidado", "Incidentes"])
    await expect(page.locator("#content").getByText(label, { exact: true })).toBeVisible();
  for (const header of ["Acciones", "Paciente", "FC", "FR", "Oxígeno", "Sistólica", "Diastólica", "Temp", "Dolor", "Glicemia", "Fecha", "Recurso"])
    await expect(page.getByRole("columnheader", { name: header, exact: true })).toBeVisible();

  const shell = page.locator(".app-shell");
  await expect(shell).toHaveClass(/sidebar-collapsed/);
  await page.getByRole("button", { name: "Expandir o contraer menú" }).click();
  await expect(shell).not.toHaveClass(/sidebar-collapsed/);
  for (const group of ["Facturación", "Clínica", "Operaciones", "Inventario", "RRHH", "Items y Maestros"])
    await expect(page.locator(".nav-section > summary", { hasText: group })).toBeVisible();

  await page.locator('[data-action="toggle-user-menu"]').click();
  await expect(page.getByText("Organización activa", { exact: true })).toBeVisible();
  const myUserButton = page.locator('[data-action="open-my-user"]');
  await expect(myUserButton).toBeVisible();
  await myUserButton.click();
  await expect(page.getByRole("heading", { name: "Mi usuario", exact: true })).toBeVisible();
  await page.screenshot({ path: resolve(evidenceDir, "ch01-dashboard-admin-1440x900.png"), fullPage: true });
});

test("CH01 ofrece listado exacto, filtros, orden, paginación y carga masiva", async ({ page }) => {
  await openCleanLogin(page);
  await login(page, "admin@analiza.demo");
  await page.goto("/#/pacientes");
  await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible();
  for (const tab of ["Activos", "Inactivos", "Carga masiva"])
    await expect(page.getByRole("button", { name: new RegExp(`^${tab}`) })).toBeVisible();
  for (const header of ["Acciones", "Documento", "Nombre completo", "Edad", "Empresa", "Triage", "Notif. Botmaker/WhatsApp", "Estado"])
    await expect(page.getByRole("columnheader", { name: new RegExp(header) })).toBeVisible();
  await expect(page.locator('[data-ui-filter="patientPageSize"]')).toHaveValue("10");
  await page.getByRole("button", { name: "Ordenar por Nombre completo" }).click();
  await expect(page.getByRole("columnheader", { name: /Nombre completo/ })).toHaveAttribute("aria-sort", "descending");
  await page.locator('[data-ui-filter="patientPageSize"]').selectOption("5");
  await expect(page.locator('[data-ui-filter="patientPageSize"]')).toHaveValue("5");
  await expect(page.getByRole("button", { name: "2", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect(page.getByRole("button", { name: "2", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: /Inactivos/ }).click();
  await expect(page.getByRole("button", { name: /Inactivos/ })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Ordenar por Nombre completo" }).click();
  await expect(page.getByRole("button", { name: "Ordenar por Nombre completo" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Carga masiva/ }).click();
  await expect(page.getByText("CSV UTF-8.")).toBeVisible();
  await expect(page.getByText("No use información real.")).toBeVisible();
  await page.screenshot({ path: resolve(evidenceDir, "ch01-patients-bulk-1440x900.png"), fullPage: true });
});

test("CH01 mantiene auditor de sólo lectura y sin controles mutadores", async ({ page }) => {
  await openCleanLogin(page);
  await login(page, "auditoria@analiza.demo");
  await page.goto("/#/pacientes");
  await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nuevo", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Carga masiva/ })).toHaveCount(0);
  await expect(page.locator('[data-action="edit-patient"]')).toHaveCount(0);
  await page.goto("/#/configuracion");
  await expect(page.locator('[data-action="save-settings"]')).toHaveCount(0);
  await expect(page.locator('[data-action="reset-demo"]')).toHaveCount(0);
  await expect(page.locator('#settings-form select[name="dataMode"]')).toBeDisabled();
  await expect(page.locator('#settings-form input[name="supabaseUrl"]')).toHaveAttribute("readonly", "");
  await expect(page.getByText("Vista de sólo lectura para este rol.", { exact: false })).toBeVisible();
  await page.screenshot({ path: resolve(evidenceDir, "ch01-auditor-read-only-1440x900.png"), fullPage: true });
});

test("CH01 no genera desbordamiento horizontal en móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCleanLogin(page);
  await login(page, "admin@analiza.demo");
  for (const route of ["/#/dashboard", "/#/pacientes"]) {
    await page.goto(route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
  await page.screenshot({ path: resolve(evidenceDir, "ch01-patients-mobile-390x844.png"), fullPage: true });
});

test("CH01 HTML autónomo verifica el portal con OTP sintético sin llamadas de red", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  const standaloneUrl = `${pathToFileURL(resolve(projectRoot, "standalone/Analiza_en_Casa_Demo_QA.html")).href}#/portal/demo-qt-2026-0148`;
  await page.goto(standaloneUrl);
  await expect(page.getByRole("heading", { name: "Verifica el acceso" })).toBeVisible();
  await page.getByRole("button", { name: "Enviar código de verificación" }).click();
  await expect(page.getByText(/código demo 202626/)).toBeVisible();
  await page.locator('input[name="verificationCode"]').fill("202626");
  await page.getByRole("button", { name: "Continuar de forma segura" }).click();
  await expect(page.getByRole("heading", { name: "Estado de la cotización" })).toBeVisible();
  expect(requests.filter((url) => url.includes("/api/portal"))).toEqual([]);
  await page.screenshot({ path: resolve(evidenceDir, "ch01-standalone-portal-1440x900.png"), fullPage: true });
});
