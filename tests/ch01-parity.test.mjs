import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppStore, DEMO_PASSWORD, normalizeState } from "../app/store.js";
import { roleCan, safeStorage } from "../app/domain.js";

const mockConfig = {
  appName: "Analiza en Casa",
  appUrl: "http://localhost:4173",
  dataMode: "mock",
  supabaseUrl: "",
  supabasePublishableKey: "",
  notificationsMode: "mock"
};

test("CH01 normaliza almacenamiento parcial sin perder colecciones requeridas", () => {
  const normalized = normalizeState({
    meta: { schemaVersion: "synthetic-qa-v1" },
    session: { authenticated: true, userId: null, role: "ADMIN" },
    patients: null,
    cases: [{ id: "SYNTHETIC-CASE" }]
  });
  assert.ok(Array.isArray(normalized.patients));
  assert.ok(normalized.patients.length > 0);
  assert.deepEqual(normalized.cases, [{ id: "SYNTHETIC-CASE" }]);
  assert.equal(normalized.session.authenticated, false);
});

test("CH01 autenticación demo exige correo conocido y contraseña exacta", async () => {
  safeStorage.clear();
  const store = await createAppStore(mockConfig);
  await assert.rejects(
    store.authenticate("persona-inexistente@analiza.demo", DEMO_PASSWORD),
    /No fue posible iniciar sesión/
  );
  await assert.rejects(
    store.authenticate("admin@analiza.demo", "incorrecta"),
    /No fue posible iniciar sesión/
  );
  const session = await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  assert.equal(session.role, "ADMIN");
  assert.equal(store.currentUser().email, "admin@analiza.demo");
  await store.logout();
  assert.equal(store.currentUser(), null);
  assert.equal(store.getState().session.authenticated, false);
  safeStorage.clear();
});

test("CH01 importación masiva demo es validada, atómica y restringida por rol", async () => {
  safeStorage.clear();
  const store = await createAppStore(mockConfig);
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  const before = store.getState().patients.length;
  assert.throws(() => store.importPatients([
    { documentType: "DUI", document: "00000000-0", firstName: "Paciente", lastName: "Sintética" },
    { documentType: "DUI", document: "00000000-0", firstName: "Duplicada", lastName: "Sintética" }
  ]), /duplicado/);
  assert.equal(store.getState().patients.length, before);
  const imported = store.importPatients([
    { documentType: "DUI", document: "00000000-0", firstName: "Paciente", lastName: "Sintética", company: "Empresa Demo" }
  ]);
  assert.equal(imported.length, 1);
  assert.equal(store.getState().patients.length, before + 1);

  await store.logout();
  await store.authenticate("auditoria@analiza.demo", DEMO_PASSWORD);
  assert.equal(roleCan("AUDITOR", "patients:write"), false);
  assert.equal(roleCan("NURSE", "patients:write"), false);
  assert.throws(() => store.importPatients([
    { documentType: "DUI", document: "00000000-1", firstName: "Paciente", lastName: "Restringida" }
  ]), /no tiene permiso/);
  safeStorage.clear();
});

test("CH01 conserva controles, textos y defensas de paridad observados", async () => {
  const [main, views] = await Promise.all([
    readFile(new URL("../app/main.js", import.meta.url), "utf8"),
    readFile(new URL("../app/views.js", import.meta.url), "utf8")
  ]);
  for (const label of [
    "Pacientes activos",
    "Tratamientos actualizados",
    "Tratamientos por finalizar",
    "Planes de cuidado",
    "Incidentes",
    "Pacientes con alertas"
  ]) assert.match(views, new RegExp(label));
  for (const label of [
    "Documento",
    "Nombre completo",
    "Edad",
    "Empresa",
    "Triage",
    "Notif. Botmaker/WhatsApp",
    "Estado"
  ]) assert.match(views, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(views, />Activos <span>/);
  assert.match(views, />Inactivos <span>/);
  assert.match(views, /Carga masiva/);
  assert.match(main, /STANDALONE_DEMO_OTP/);
  assert.match(main, /location\.protocol === "file:"/);
  assert.match(main, /"save-settings": "settings:write"/);
  assert.doesNotMatch(main, /users\[0\]/);
});
