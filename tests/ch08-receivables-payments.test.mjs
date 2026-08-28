import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppStore } from "../app/store.js";
import { DEMO_PASSWORD } from "./helpers/demo-auth.mjs";
import { safeStorage } from "../app/domain.js";
import { mapSupabaseBootstrap } from "../app/supabase-adapter.js";

const storePath = new URL("../app/store.js", import.meta.url);
const adapterPath = new URL("../app/supabase-adapter.js", import.meta.url);
const viewsPath = new URL("../app/views.js", import.meta.url);
const mainPath = new URL("../app/main.js", import.meta.url);
const migrationPath = new URL("../supabase/migrations/202608270004_ch08_receivables_execution_integrity.sql", import.meta.url);

async function isolatedStore() {
  safeStorage.clear();
  const store = await createAppStore({ dataMode: "mock", notificationsMode: "mock" });
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  return store;
}

test("CH08 crea un solo perfil administrativo auditable sin inferir una transición financiera", async () => {
  const store = await isolatedStore();
  const quote = store.getState().quotes.find((candidate) => candidate.caseId && candidate.patientId);
  const beforeStatus = quote.status;
  const input = {
    quoteId: quote.id,
    healthManager: "Gestor sintético",
    referredBy: "Referencia sintética",
    revenueType: "Catálogo pendiente",
    serviceType: "Tipo configurable",
    startDate: "2026-08-27",
    durationDays: 5,
    paymentForm: "Forma configurable",
    requestType: "Solicitud configurable",
    majorCategory: "Categoría configurable",
    serviceSubcategory: "Subcategoría configurable",
    sourceHospital: "Hospital sintético",
    patientType: "Particular",
    moduleType: "Módulo configurable",
    additionalOptions: "Ninguno",
    idempotencyKey: "CH08-EXEC-1"
  };
  const profile = store.startAdministrativeExecution(input);
  assert.equal(profile.caseId, quote.caseId);
  assert.equal(profile.durationDays, 5);
  assert.equal(store.startAdministrativeExecution(input).id, profile.id);
  assert.equal(store.getState().administrativeExecutionProfiles.filter((item) => item.idempotencyKey === input.idempotencyKey).length, 1);
  assert.equal(store.getState().quotes.find((candidate) => candidate.id === quote.id).status, beforeStatus);
  assert.ok(store.getState().auditLogs.some((entry) => entry.action === "START_ADMINISTRATIVE_EXECUTION"));
  assert.throws(() => store.startAdministrativeExecution({ ...input, idempotencyKey: "CH08-EXEC-2", durationDays: 0 }), /obligatorios|válidos/i);
});

test("CH08 conserva pagos y asignaciones al reconstruir Supabase", () => {
  const mapped = mapSupabaseBootstrap({
    quotes: [{ id: "ROOT", organization_id: "ORG", code: "COT-1", hospitalization_id: "HOS", patient_id: "PAT", status: "PATIENT_PAYMENT", current_version: 2, currency: "USD", quote_versions: [{ id: "VER", version: 2, subtotal: "100", discount_amount: "0", total: "100", insurer_amount: "0", patient_amount: "100", quote_items: [] }] }],
    payments: [{ id: "PAY", organization_id: "ORG", quote_id: "ROOT", quote_version_id: "VER", hospitalization_id: "HOS", patient_id: "PAT", amount: "25.50", currency: "USD", method: "TRANSFER", payer: "Pagador sintético", external_reference: "REF-1", receipt_code: "REC-1", status: "APPLIED", paid_at: "2026-08-27T12:00:00Z", payment_allocations: [{ id: "ALLOC", quote_id: "ROOT", quote_version_id: "VER", amount: "25.50", currency: "USD", status: "APPLIED" }], payment_receipts: [{ receipt_code: "REC-1", status: "ISSUED" }] }],
    administrativeExecutionProfiles: [{ id: "PI", organization_id: "ORG", hospitalization_id: "HOS", quote_id: "ROOT", quote_version_id: "VER", patient_id: "PAT", duration_days: 5, status: "ACTIVE" }]
  });
  assert.equal(mapped.payments[0].quoteId, "VER");
  assert.equal(mapped.payments[0].rootQuoteId, "ROOT");
  assert.equal(mapped.payments[0].amount, 25.5);
  assert.equal(mapped.payments[0].allocations[0].amount, 25.5);
  assert.equal(mapped.payments[0].receipt, "REC-1");
  assert.equal(mapped.administrativeExecutionProfiles[0].caseId, "HOS");
});

test("CH08 usa confirmación remota y RPC cerradas para pagos, reversión y ejecución", async () => {
  const [store, adapter, migration] = await Promise.all([readFile(storePath, "utf8"), readFile(adapterPath, "utf8"), readFile(migrationPath, "utf8")]);
  assert.match(store, /requiredSync\("CREATE_PAYMENT"/);
  assert.match(store, /requiredSync\("REVERSE_PAYMENT"/);
  assert.match(store, /requiredSync\("START_ADMINISTRATIVE_EXECUTION"/);
  assert.doesNotMatch(store, /function createPayment[\s\S]*?safeSync\("CREATE_PAYMENT"/);
  assert.match(adapter, /p_quote_id: payload\.payment\.rootQuoteId/);
  assert.match(adapter, /payment_allocations\(\*\), payment_receipts\(\*\)/);
  assert.match(adapter, /client\.rpc\("start_administrative_execution"/);
  for (const marker of [
    "create table if not exists public.administrative_execution_profiles",
    "administrative_execution_profiles_rpc_only",
    "create or replace function public.start_administrative_execution",
    "pg_advisory_xact_lock",
    "START_ADMINISTRATIVE_EXECUTION",
    "current_organization_id",
    "set search_path = pg_catalog, public",
    "revoke all on function public.start_administrative_execution"
  ]) assert.ok(migration.includes(marker), `falta ${marker}`);
  assert.match(migration, /administrative_execution_profiles_rpc_only[\s\S]*using \(false\) with check \(false\)/);
  assert.doesNotMatch(migration, /grant execute on function[\s\S]*?to public/i);
});

test("CH08 expone las superficies observadas y reemplaza eliminación por reversión segura", async () => {
  const [views, main] = await Promise.all([readFile(viewsPath, "utf8"), readFile(mainPath, "utf8")]);
  for (const label of [
    "Cuentas", "Pagos", "Excel con filtros", "Reporte", "Excel", "Ver cotizaciones",
    "Estados de cuenta", "Ver pagos", "Archivar", "Registro XPO", "Editar pago",
    "Imprimir", "Eliminar pagos", "Poner en ejecución"
  ]) assert.ok(views.includes(label), `falta ${label}`);
  for (const label of [
    "Perfil administrativo de ejecución", "Días de duración", "Forma de pago", "Tipo de solicitud",
    "Categoría mayor", "Subcategoría de servicios", "Hospital del que proviene", "Tipo de paciente",
    "Tipo de módulo", "Adicionales", "Estados Particulares", "Estados Mixtos", "Vista previa",
    "Cotizaciones", "Documentos", "Resumen del pago", "Total pendientes", "Guardar cambios"
  ]) assert.ok(main.includes(label), `falta ${label}`);
  assert.match(main, /save-reverse-payment/);
  assert.match(main, /store\.reversePayment/);
  assert.match(main, /await runSafely\(\(\)=>store\.createPayment/);
  assert.match(views, /Los pagos no se eliminan; use una reversión auditada/);
});
