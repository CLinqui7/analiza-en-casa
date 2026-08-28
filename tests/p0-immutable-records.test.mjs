import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppStore } from "../app/store.js";
import { DEMO_PASSWORD } from "./helpers/demo-auth.mjs";
import { healthReportDocument } from "../app/templates.js";
import { safeStorage } from "../app/domain.js";

const migrationPath = new URL("../supabase/migrations/202608260005_p0_quote_clinical_immutability.sql", import.meta.url);
const initialSchemaPath = new URL("../supabase/migrations/202608260001_initial_schema.sql", import.meta.url);

async function isolatedStore() {
  safeStorage.clear();
  const store = await createAppStore({ dataMode: "mock", notificationsMode: "mock" });
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  return store;
}

function quoteInput(overrides = {}, catalogItem = { id: "CAT-SRV-001", category: "SERVICES", name: "Enfermería domiciliar 12 horas", price: 180 }) {
  return {
    caseId: "HOS-2026-0190",
    items: [{ catalogItemId: catalogItem.id, category: catalogItem.category, name: catalogItem.name, quantity: 2, unitPrice: catalogItem.price, discountAmount: 0 }],
    discount: { type: "PERCENT", value: 0, reason: "" },
    insurerAmount: 0,
    invoiceDate: "2026-08-27",
    discountGroupId: "REGULAR",
    referredBy: "Referencia sintética",
    comments: "Cotización sintética de prueba.",
    ...overrides
  };
}

test("P0 quote: an authorized draft can change, but a sent version and its items cannot", async () => {
  const store = await isolatedStore();
  const draft = store.createQuote(quoteInput());
  const edited = store.updateQuoteDraft(draft.id, quoteInput({
    items: [{ ...draft.items[0], quantity: 3 }],
    comments: "Borrador editado autorizado."
  }));
  assert.equal(edited.status, "DRAFT");
  assert.equal(edited.total, 540);

  store.sendQuote(draft.id, "EMAIL");
  const sent = store.quoteById(draft.id);
  const historicalTotal = sent.total;
  const historicalItems = structuredClone(sent.items);
  assert.equal(sent.immutable, true);
  assert.throws(() => store.updateQuoteDraft(sent.id, quoteInput({ items: [{ ...sent.items[0], quantity: 99 }] })), /no se puede editar/i);
  assert.deepEqual(sent.items, historicalItems);
  assert.equal(sent.total, historicalTotal);
});

test("P0 quote: revisions are sequential, linked, copied, auditable, and preserve prior sent totals", async () => {
  const store = await isolatedStore();
  const original = store.createQuote(quoteInput());
  store.sendQuote(original.id);
  const frozenOriginal = structuredClone(store.quoteById(original.id));

  const revision = store.reviseQuote(original.id, quoteInput({
    revisionReason: "Cambio solicitado en la cotización sintética.",
    items: [{ ...original.items[0], quantity: 4 }]
  }));
  const laterRevision = store.reviseQuote(original.id, quoteInput({
    revisionReason: "Segunda revisión de prueba.",
    items: [{ ...original.items[0], quantity: 5 }]
  }));

  assert.equal(revision.quoteId, original.id);
  assert.equal(revision.previousVersionId, original.id);
  assert.equal(revision.version, 2);
  assert.equal(laterRevision.version, 3);
  assert.notEqual(revision.items[0].id, original.items[0].id);
  assert.equal(revision.items[0].name, original.items[0].name);
  assert.equal(revision.status, "DRAFT");
  assert.equal(store.quoteById(original.id).total, frozenOriginal.total);
  assert.deepEqual(store.quoteById(original.id).items, frozenOriginal.items);
  assert.deepEqual(store.quoteVersions(original).map((item) => item.version), [1, 2, 3]);
  assert.throws(() => store.reviseQuote(original.id, quoteInput()), /motivo/i);
  assert.ok(store.getState().auditLogs.some((entry) => entry.action === "CREATE_QUOTE_REVISION" && entry.entity === revision.id));
});

test("P0 quote: organization boundaries and invalid direct state transitions are rejected", async () => {
  const store = await isolatedStore();
  const draft = store.createQuote(quoteInput());
  assert.throws(() => store.updateQuoteStatus(draft.id, "CLOSED"), /Transición no permitida/i);
  store.getState().quotes.find((item) => item.id === draft.id).organizationId = "ORG-OTHER";
  assert.throws(() => store.updateQuoteDraft(draft.id, quoteInput()), /no disponible/i);
});

test("P0 clinical: drafts edit, signature blocks updates, and corrections preserve the original", async () => {
  const store = await isolatedStore();
  const document = store.createClinicalDocument({
    caseId: "HOS-2026-0190",
    type: "HEALTH_REPORT",
    title: "Reporte sintético",
    summary: "Borrador inicial",
    content: { diagnosis: "Contenido sintético" }
  });
  store.updateClinicalDocument(document.id, { summary: "Borrador editado autorizado" });
  store.signClinicalDocument(document.id);
  const signed = structuredClone(store.getState().clinicalDocuments.find((item) => item.id === document.id));
  assert.equal(signed.status, "SIGNED");
  assert.equal(signed.signatureMetadata.legalValidation, "NEEDS_CLIENT_CONFIRMATION");
  assert.throws(() => store.updateClinicalDocument(document.id, { summary: "Edición silenciosa" }), /no puede editarse/i);

  const correction = store.createClinicalCorrection("CLINICAL_DOCUMENT", document.id, {
    kind: "ADDENDUM",
    reason: "Aclaración sintética requerida.",
    content: { text: "Contenido complementario sintético." }
  });
  assert.equal(correction.originalDocumentId, document.id);
  assert.equal(correction.previousVersionId, document.id);
  assert.equal(store.clinicalHistory("CLINICAL_DOCUMENT", document.id).length, 2);
  assert.deepEqual(store.getState().clinicalDocuments.find((item) => item.id === document.id), signed);
  assert.equal(store.clinicalRecordStatus("CLINICAL_DOCUMENT", document.id), "CORRECTED");
  assert.ok(store.getState().auditLogs.some((entry) => entry.action === "SIGN_CLINICAL_DOCUMENT"));
  assert.ok(store.getState().auditLogs.some((entry) => entry.action === "CREATE_CLINICAL_CORRECTION"));
});

test("P0 clinical: unauthorized correction, missing void reason, and cross-organization access are blocked", async () => {
  const store = await isolatedStore();
  const treatingDoctorId = store.getState().doctors.find((item) => item.status === "ACTIVE")?.id;
  const document = store.createClinicalDocument({ caseId: "HOS-2026-0190", type: "MEDICAL_ORDER", title: "Orden sintética", summary: "Prueba", content: { treatingDoctorId } });
  store.signClinicalDocument(document.id);
  await store.authenticate("enfermeria@analiza.demo", DEMO_PASSWORD);
  assert.throws(() => store.createClinicalCorrection("CLINICAL_DOCUMENT", document.id, { reason: "Sin permiso" }), /permiso/i);
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  assert.throws(() => store.voidClinicalDocument(document.id, ""), /motivo/i);
  store.getState().clinicalDocuments.find((item) => item.id === document.id).organizationId = "ORG-OTHER";
  assert.throws(() => store.voidClinicalDocument(document.id, "Motivo válido"), /no disponible/i);
});

test("P0 clinical: signed nursing notes and medication cards use the same append-only correction flow", async () => {
  const store = await isolatedStore();
  const treatingDoctorId = store.getState().doctors.find((item) => item.status === "ACTIVE")?.id;
  await store.authenticate("enfermeria@analiza.demo", DEMO_PASSWORD);
  const note = store.addNursingNote({ caseId: "HOS-2026-0190", text: "Nota sintética", sign: true });
  assert.equal(note.status, "SIGNED");
  const card = store.createMedicationCard({
    caseId: "HOS-2026-0190",
    treatingDoctorId,
    items: [{ medication: "Medicamento sintético", doctorId: treatingDoctorId, dose: "Dato QA", route: "VO", frequency: "Dato QA", schedule: ["08:00"] }]
  });
  store.signMedicationCard(card.id);
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  store.createClinicalCorrection("NURSING_NOTE", note.id, { reason: "Aclaración de prueba", content: { text: "Addendum" } });
  store.createClinicalCorrection("MEDICATION_CARD", card.id, { reason: "Aclaración de tarjeta", content: { text: "Addendum" } });
  assert.equal(store.clinicalRecordStatus("NURSING_NOTE", note.id), "CORRECTED");
  assert.equal(store.clinicalRecordStatus("MEDICATION_CARD", card.id), "CORRECTED");
  assert.equal(store.voidClinicalRecord("MEDICATION_CARD", card.id, "Anulación sintética"), true);
  assert.equal(store.getState().medicationCards.find((item) => item.id === card.id).documentStatus, "VOIDED");
  assert.equal(store.clinicalRecordStatus("MEDICATION_CARD", card.id), "VOIDED");
});

test("P0 clinical print identifies the version, signature metadata, corrections, and state", () => {
  const html = healthReportDocument({
    document: {
      id: "DOC-PRINT", title: "Reporte sintético", version: 2, status: "SIGNED", authorName: "Autor QA",
      signatureMetadata: { signerRole: "DOCTOR", signedAt: "2026-08-26T12:00:00Z", legalValidation: "NEEDS_CLIENT_CONFIRMATION" },
      content: {}
    },
    patient: {},
    recordCase: {},
    corrections: [{ correctionKind: "ADDENDUM", reason: "Aclaración", authorName: "Admin QA", authorRole: "ADMIN", createdAt: "2026-08-26T13:00:00Z", content: { text: "Complemento" } }]
  });
  assert.match(html, /Versión 2/);
  assert.match(html, /NEEDS_CLIENT_CONFIRMATION/);
  assert.match(html, /Enmiendas y addenda/);
  assert.match(html, /CORRECTED/);
});

test("P0 persistence contract protects sent quote items and signed clinical records with RLS, triggers, RPCs, and audit evidence", async () => {
  const [migration, initialSchema] = await Promise.all([readFile(migrationPath, "utf8"), readFile(initialSchemaPath, "utf8")]);
  const persistence = `${initialSchema}\n${migration}`;
  for (const marker of [
    "previous_version_id uuid references public.quote_versions",
    "unique (quote_id, version)",
    "create policy quote_versions_update_draft",
    "create policy quote_items_update_draft",
    "create policy quote_items_delete_draft",
    "create or replace function public.create_quote_revision",
    "for update;",
    "create or replace function public.send_quote_version",
    "Los totales de la versión no coinciden con sus ítems",
    "create or replace function public.transition_quote_status",
    "CREATE_QUOTE_REVISION",
    "SEND_QUOTE_VERSION",
    "create table if not exists public.clinical_record_corrections",
    "create or replace function public.sign_clinical_record",
    "create or replace function public.create_clinical_record_correction",
    "create or replace function public.void_clinical_record",
    "clinical_documents_update_draft",
    "nursing_notes_update_draft",
    "medication_cards_update_draft",
    "medication_card_items_update_draft",
    "prevent_signed_clinical_document_mutation",
    "prevent_signed_nursing_note_mutation",
    "prevent_signed_medication_card_mutation",
    "prevent_signed_medication_card_item_mutation",
    "CREATE_CLINICAL_CORRECTION",
    "VOID_CLINICAL_RECORD"
  ]) assert.ok(persistence.includes(marker), `missing ${marker}`);
  assert.match(migration, /and qv\.immutable = false[\s\S]*status_snapshot in \('DRAFT','READY_TO_SEND'\)/);
  assert.match(migration, /organization_id = public\.current_organization_id\(\)/);
  assert.match(migration, /revoke all on function public\.send_quote_version\(uuid, uuid\) from public, anon, authenticated/);
});
