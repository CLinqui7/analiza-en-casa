import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppStore, DEMO_PASSWORD } from "../app/store.js";
import { safeStorage } from "../app/domain.js";
import { validateNotificationRequest } from "../api/_notification-contract.js";
import notificationHandler from "../api/notifications.js";

const migrationPath = new URL("../supabase/migrations/202608260006_p0_notifications_payments_inventory.sql", import.meta.url);
const adapterPath = new URL("../app/supabase-adapter.js", import.meta.url);

function responseRecorder() {
  return {
    statusCode: null, body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

async function isolatedStore() {
  safeStorage.clear();
  const store = await createAppStore({ dataMode: "mock", notificationsMode: "mock" });
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  return store;
}

test("P0 notifications: template-only requests reject client destinations and queue with a user token", async () => {
  assert.equal(validateNotificationRequest({
    channel: "EMAIL", templateCode: "QUOTE_READY", recipientType: "PATIENT", recipientId: "patient-id",
    relatedEntityType: "QUOTE", relatedEntityId: "quote-id", idempotencyKey: "notification-key", destination: "unsafe@example.invalid"
  }).ok, false);
  const request = validateNotificationRequest({
    channel: "EMAIL", templateCode: "QUOTE_READY", recipientType: "PATIENT", recipientId: "patient-id",
    relatedEntityType: "QUOTE", relatedEntityId: "quote-id", idempotencyKey: "notification-key"
  });
  assert.equal(request.ok, true);

  const priorFetch = globalThis.fetch;
  const priorUrl = process.env.SUPABASE_URL;
  const priorKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = "https://example.invalid";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-only";
  let outgoing;
  globalThis.fetch = async (url, init) => {
    outgoing = { url, init };
    return { ok: true, json: async () => ({ id: "NOT-1", status: "QUEUED" }) };
  };
  try {
    const response = responseRecorder();
    await notificationHandler({ method: "POST", headers: { authorization: "Bearer user-session-token" }, body: {
      channel: "EMAIL", templateCode: "QUOTE_READY", recipientType: "PATIENT", recipientId: "patient-id",
      relatedEntityType: "QUOTE", relatedEntityId: "quote-id", idempotencyKey: "notification-key"
    } }, response);
    assert.equal(response.statusCode, 202);
    assert.equal(response.body.status, "QUEUED");
    assert.match(outgoing.url, /queue_notification$/);
    assert.equal(outgoing.init.headers.Authorization, "Bearer user-session-token");
    assert.doesNotMatch(JSON.stringify(outgoing), /service.role|destination|secureUrl|diagnosis/i);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = priorUrl;
    if (priorKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = priorKey;
  }
});

test("P0 payments: exact application, idempotent references, receipt allocation and audited reversal", async () => {
  const store = await isolatedStore();
  const quote = store.getState().quotes.find((candidate) => candidate.patientAmount > 50);
  const amount = Math.min(25, quote.patientAmount);
  const payment = store.createPayment({ quoteId: quote.id, amount, method: "TRANSFER", payer: "Pagador sintético", reference: "P0-PAY-REF" });
  assert.equal(payment.currency, "USD");
  assert.equal(payment.allocations[0].amount, amount);
  assert.match(payment.receipt, /^REC-/);
  assert.equal(store.getState().notifications[0].templateCode, "PAYMENT_RECEIVED");
  assert.throws(() => store.createPayment({ quoteId: quote.id, amount: 1, method: "TRANSFER", payer: "Pagador sintético", reference: "P0-PAY-REF" }), /referencia/i);
  assert.throws(() => store.createPayment({ quoteId: quote.id, amount: quote.patientAmount + 1, method: "TRANSFER", payer: "Pagador sintético", reference: "P0-OVERPAY" }), /supera/i);
  const reversed = store.reversePayment(payment.id, "Corrección financiera sintética", "P0-REVERSE-1");
  assert.equal(reversed.status, "REVERSED");
  assert.equal(reversed.allocations[0].status, "REVERSED");
  assert.ok(store.getState().auditLogs.some((entry) => entry.action === "REVERSE_PAYMENT"));
});

test("P0 inventory: atomic local convention covers reserve, consume, return, duplicate and organization boundaries", async () => {
  const store = await isolatedStore();
  const state = store.getState();
  const item = state.inventoryItems.find((candidate) => candidate.stock - candidate.committed >= 1
    && !state.catalogItems.find((catalog) => catalog.id === candidate.catalogItemId)?.requiresLot);
  assert.ok(item, "se requiere un ítem sintético no trazable para la convención local");
  const originalStock = item.stock;
  const originalCommitted = item.committed;
  const entry = store.createInventoryMovement({ inventoryItemId: item.id, type: "PURCHASE_ENTRY", quantity: 5, reference: "P0-INV-ENTRY" });
  assert.equal(store.getState().inventoryItems.find((candidate) => candidate.id === item.id).stock, originalStock + 5);
  const duplicate = store.createInventoryMovement({ inventoryItemId: item.id, type: "PURCHASE_ENTRY", quantity: 5, reference: "P0-INV-ENTRY" });
  assert.equal(duplicate.id, entry.id);
  assert.equal(store.getState().inventoryItems.find((candidate) => candidate.id === item.id).stock, originalStock + 5);
  store.createInventoryMovement({ inventoryItemId: item.id, caseId: "HOS-2026-0190", type: "PATIENT_COMMITMENT", quantity: 3, reference: "P0-INV-RES" });
  store.createInventoryMovement({ inventoryItemId: item.id, caseId: "HOS-2026-0190", type: "PATIENT_CONSUMPTION", quantity: 2, reference: "P0-INV-CONSUME" });
  store.createInventoryMovement({ inventoryItemId: item.id, caseId: "HOS-2026-0190", type: "RETURN_TO_STOCK", quantity: 1, reference: "P0-INV-RETURN" });
  const finalItem = store.getState().inventoryItems.find((candidate) => candidate.id === item.id);
  assert.equal(finalItem.stock, originalStock + 3);
  assert.equal(finalItem.committed, originalCommitted);
  const reservation = store.getState().inventoryReservations.find((candidate) => candidate.caseId === "HOS-2026-0190" && candidate.inventoryItemId === item.id && candidate.status === "OPEN");
  assert.ok(reservation.consumed >= 2);
  assert.ok(reservation.returned >= 1);
  item.organizationId = "ORG-OTHER";
  assert.throws(() => store.createInventoryMovement({ inventoryItemId: item.id, type: "POSITIVE_ADJUSTMENT", quantity: 1, reference: "P0-INV-CROSS-ORG" }), /no disponible/i);
});

test("P0 persistence contract closes direct writes and protects notification, payment and inventory histories", async () => {
  const [migration, adapter] = await Promise.all([readFile(migrationPath, "utf8"), readFile(adapterPath, "utf8")]);
  for (const marker of [
    "create table if not exists public.notification_attempt",
    "recipient_type text",
    "retry_count integer",
    "create or replace function public.queue_notification",
    "p_recipient_type",
    "pg_advisory_xact_lock",
    "record_notification_attempt",
    "MAX_RETRIES_EXCEEDED",
    "create table if not exists public.payment_allocations",
    "create table if not exists public.payment_receipts",
    "create or replace function public.apply_payment",
    "El pago supera el saldo pendiente",
    "create or replace function public.reverse_payment",
    "Los pagos no se eliminan",
    "create or replace function public.apply_inventory_movement_v2",
    "Stock libre insuficiente",
    "Consumo superior a la reserva",
    "Los movimientos de inventario son inmutables",
    "inventory_open_reservation_unique_idx",
    "alter table public.notification_attempt enable row level security",
    "set search_path = pg_catalog, public",
    "revoke all on function public.queue_notification"
  ]) assert.ok(migration.includes(marker), `missing ${marker}`);
  assert.match(migration, /create policy payments_write[\s\S]*with check \(false\)/);
  assert.match(migration, /create policy inventory_movements_write[\s\S]*with check \(false\)/);
  assert.doesNotMatch(migration, /grant execute on function[\s\S]*?to public/i);
  assert.match(adapter, /client\.rpc\("apply_payment"/);
  assert.match(adapter, /client\.rpc\("apply_inventory_movement_v2"/);
  assert.match(adapter, /client\.rpc\("queue_notification"/);
  assert.doesNotMatch(adapter, /payer_name/);
});
