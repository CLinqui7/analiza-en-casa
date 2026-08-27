import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppStore, DEMO_PASSWORD } from "../app/store.js";
import { safeStorage } from "../app/domain.js";
import { mapSupabaseBootstrap } from "../app/supabase-adapter.js";

const migrationPath = new URL("../supabase/migrations/202608270003_ch07_insurance_send_integrity.sql", import.meta.url);
const adapterPath = new URL("../app/supabase-adapter.js", import.meta.url);
const storePath = new URL("../app/store.js", import.meta.url);
const viewsPath = new URL("../app/views.js", import.meta.url);

async function isolatedStore() {
  safeStorage.clear();
  const store = await createAppStore({ dataMode: "mock", notificationsMode: "mock" });
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  return store;
}

function quoteInput() {
  return {
    caseId: "HOS-2026-0190",
    items: [{
      catalogItemId: "CAT-SRV-001",
      category: "SERVICES",
      name: "Enfermería domiciliar 12 horas",
      quantity: 1,
      unitPrice: 180,
      discountAmount: 0
    }],
    discount: { type: "PERCENT", value: 0, reason: "" },
    insurerAmount: 0,
    invoiceDate: "2026-08-27",
    discountGroupId: "REGULAR",
    referredBy: "Referencia sintética",
    comments: "Cotización sintética CH07."
  };
}

test("CH07 confirma el envío antes de bloquear la versión y crea una sola notificación segura", async () => {
  const store = await isolatedStore();
  const quote = store.createQuote(quoteInput());
  const financialSnapshot = {
    total: quote.total,
    insurerAmount: quote.insurerAmount,
    patientAmount: quote.patientAmount,
    items: structuredClone(quote.items)
  };

  const sent = store.sendQuote(quote.id, "WHATSAPP");
  assert.equal(sent.immutable, true);
  assert.equal(sent.status, "SENT_TO_PATIENT");
  assert.ok(sent.sentAt);
  assert.deepEqual({
    total: sent.total,
    insurerAmount: sent.insurerAmount,
    patientAmount: sent.patientAmount,
    items: sent.items
  }, financialSnapshot);
  const delivery = store.getState().notifications.filter((item) => item.idempotencyKey === `NOT:QUOTE_READY:${quote.id}:WHATSAPP`);
  assert.equal(delivery.length, 1);
  assert.equal(delivery[0].templateCode, "QUOTE_READY");
  assert.match(delivery[0].target, /[•*]/);
  assert.equal(store.sendQuote(quote.id, "WHATSAPP").id, sent.id);
  assert.equal(store.getState().notifications.filter((item) => item.idempotencyKey === delivery[0].idempotencyKey).length, 1);
});

test("CH07 registra monto y reclamo en el expediente de seguro sin reescribir la versión enviada", async () => {
  const store = await isolatedStore();
  const quote = store.getState().quotes.find((candidate) => candidate.status === "INSURER_REVIEW");
  assert.ok(quote, "se requiere una cotización sintética en revisión");
  const before = {
    total: quote.total,
    insurerAmount: quote.insurerAmount,
    patientAmount: quote.patientAmount,
    items: structuredClone(quote.items)
  };

  const updated = store.updateQuoteStatus(
    quote.id,
    "INFO_REQUIRED",
    "La aseguradora solicitó documentación administrativa sintética.",
    125,
    "SYN-CH07-001",
    "QSE-CH07-001"
  );
  assert.equal(updated.status, "INFO_REQUIRED");
  assert.deepEqual({
    total: updated.total,
    insurerAmount: updated.insurerAmount,
    patientAmount: updated.patientAmount,
    items: updated.items
  }, before);
  const request = store.getState().insuranceRequests.find((candidate) => candidate.quoteId === quote.id);
  assert.equal(request.status, "INFO_REQUIRED");
  assert.equal(request.approvedAmount, 125);
  assert.equal(request.claimNumber, "SYN-CH07-001");
  assert.equal(request.events.at(-1).idempotencyKey, "QSE-CH07-001");
  assert.equal(store.getState().notifications.filter((item) => item.idempotencyKey === "NOT:QUOTE_STATUS:QSE-CH07-001").length, 1);
  assert.equal(store.updateQuoteStatus(
    quote.id,
    "INFO_REQUIRED",
    "La aseguradora solicitó documentación administrativa sintética.",
    125,
    "SYN-CH07-001",
    "QSE-CH07-001"
  ).id, quote.id);
  assert.equal(request.events.filter((event) => event.idempotencyKey === "QSE-CH07-001").length, 1);
  assert.throws(() => store.updateQuoteStatus(
    quote.id,
    "APPROVED",
    "Intento distinto.",
    125,
    "SYN-CH07-001",
    "QSE-CH07-001"
  ), /otra operación/i);
});

test("CH07 persiste envío y transición de seguro mediante RPC transaccionales cerradas", async () => {
  const [migration, adapter, store, views] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(adapterPath, "utf8"),
    readFile(storePath, "utf8"),
    readFile(viewsPath, "utf8")
  ]);

  for (const marker of [
    "create or replace function public.send_quote_version_and_queue",
    "create or replace function public.transition_quote_insurance_status",
    "pg_advisory_xact_lock",
    "insurance_request_events_org_idempotency_uidx",
    "insurance_requests_rpc_only",
    "insurance_request_events_rpc_only",
    "public.quote_transition_allowed",
    "public.queue_notification",
    "current_organization_id",
    "TRANSITION_QUOTE_INSURANCE_STATUS",
    "set search_path = pg_catalog, public",
    "revoke all on function public.transition_quote_insurance_status"
  ]) assert.ok(migration.includes(marker), `falta ${marker}`);
  assert.match(migration, /insurance_requests_rpc_only[\s\S]*using \(false\) with check \(false\)/);
  assert.match(migration, /insurance_request_events_rpc_only[\s\S]*using \(false\) with check \(false\)/);
  assert.match(adapter, /client\.rpc\("send_quote_version_and_queue"/);
  assert.match(adapter, /client\.rpc\("transition_quote_insurance_status"/);
  assert.match(store, /requiredSync\("SEND_QUOTE_VERSION"/);
  assert.match(store, /requiredSync\("UPDATE_QUOTE_STATUS"/);
  for (const label of [
    "Duplicar", "Versiones", "Imprimir", "Excel", "Detalle de servicio", "Cotización",
    "Factura", "Cotización internacional", "Factura internacional", "Enviar", "E-mail",
    "Whatsapp", "Envíos al seguro", "Historial de envíos", "Eliminar"
  ]) assert.ok(views.includes(label), `falta acción visible ${label}`);
  assert.match(views, /patient\?\.fullName, patient\?\.document/);
  assert.match(views, /interactive-badge/);
  assert.doesNotMatch(migration, /grant execute on function[\s\S]*?to public/i);
});

test("CH07 reconstruye cotizaciones y expediente de seguro al recargar desde Supabase", () => {
  const mapped = mapSupabaseBootstrap({
    patients: [{ id: "PAT", organization_id: "ORG", document_number: "00000000-0", first_name: "Paciente", last_name: "Sintético" }],
    cases: [{ id: "HOS", organization_id: "ORG", patient_id: "PAT", insurer_id: "INS", account_type: "SEGURO", start_date: "2026-08-27" }],
    quotes: [{
      id: "QUOTE", organization_id: "ORG", code: "COT-1", hospitalization_id: "HOS", patient_id: "PAT",
      status: "INSURER_REVIEW", current_version: 2, currency: "USD",
      quote_versions: [{
        id: "QTV", version: 2, status_snapshot: "INSURER_REVIEW", subtotal: "180.00", discount_amount: "0",
        total: "180.00", insurer_amount: "100.00", patient_amount: "80.00", immutable: true,
        quote_items: [{ id: "QTI", catalog_item_id: "CAT", category: "SERVICES", description: "Servicio sintético", quantity: "1", unit_price: "180", discount_amount: "0" }]
      }]
    }],
    insuranceRequests: [{
      id: "PRE", quote_id: "QUOTE", status: "INSURER_REVIEW", approved_amount: "100", requested_amount: "180",
      insurance_request_events: [{ id: "EV", status: "INSURER_REVIEW", note: "Revisión sintética", created_at: "2026-08-27T12:00:00Z" }]
    }]
  });
  assert.equal(mapped.patients[0].fullName, "Paciente Sintético");
  assert.equal(mapped.cases[0].patientId, "PAT");
  assert.equal(mapped.quotes[0].id, "QTV");
  assert.equal(mapped.quotes[0].items[0].unitPrice, 180);
  assert.equal(mapped.insuranceRequests[0].quoteId, "QTV");
  assert.equal(mapped.insuranceRequests[0].rootQuoteId, "QUOTE");
  assert.equal(mapped.insuranceRequests[0].events[0].date, "2026-08-27T12:00:00Z");
});
