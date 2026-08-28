import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculateQuote, safeStorage } from "../app/domain.js";
import { createAppStore } from "../app/store.js";
import { DEMO_PASSWORD } from "./helpers/demo-auth.mjs";
import { mapSupabaseBootstrap } from "../app/supabase-adapter.js";

const mainPath = new URL("../app/main.js", import.meta.url);
const viewsPath = new URL("../app/views.js", import.meta.url);
const storePath = new URL("../app/store.js", import.meta.url);
const adapterPath = new URL("../app/supabase-adapter.js", import.meta.url);
const migrationPath = new URL("../supabase/migrations/202608280001_ch16_discount_rules_and_approvals.sql", import.meta.url);

async function isolatedStore(email = "admin@analiza.demo") {
  safeStorage.clear();
  const store = await createAppStore({ dataMode:"mock", notificationsMode:"mock" });
  await store.authenticate(email, DEMO_PASSWORD);
  return store;
}

function quoteInput(store, overrides = {}) {
  const state = store.getState();
  const recordCase = state.cases[0];
  const service = state.catalogItems.find((item) => item.category === "SERVICES");
  const study = state.catalogItems.find((item) => item.category === "STUDIES");
  return {
    caseId:recordCase.id,
    items:[service, study].map((item) => ({ catalogItemId:item.id, category:item.category, name:item.name, quantity:1, unitPrice:item.price })),
    invoiceDate:"2026-08-27",
    discountGroupId:"DISC-001",
    referredBy:"Referencia sintética CH16",
    comments:"Cotización sintética de prueba CH16",
    discount:{ reason:"Motivo sintético documentado" },
    ...overrides
  };
}

test("CH16 configura, actualiza e inactiva perfiles con auditoría y límites", async () => {
  const store = await isolatedStore();
  const rule = store.createDiscountRule({
    name:"Perfil fijo sintético CH16", type:"PROFILE", description:"Sólo datos de prueba",
    calculationType:"FIXED", fixedAmount:20, categories:{}, validFrom:"2026-08-01", validUntil:"2026-12-31",
    status:"ACTIVE", eligibility:{ patientId:store.getState().cases[0].patientId }, requiresReason:true, requiresApproval:false, exclusions:["MEDICATIONS"], maxAmount:10, combinable:false
  });
  assert.equal(rule.calculationType, "FIXED");
  assert.equal(rule.maxAmount, 10);
  assert.equal(store.discountEligibility(rule, { caseId:store.getState().cases[0].id, patientId:store.getState().cases[0].patientId, invoiceDate:"2026-08-27" }).eligible, true);
  assert.equal(store.discountEligibility(rule, { caseId:store.getState().cases[0].id, patientId:"PAT-OTRO", invoiceDate:"2026-08-27" }).eligible, false);
  const updated = store.updateDiscountRule(rule.id, { ...rule, fixedAmount:25, maxAmount:12 });
  assert.equal(updated.fixedAmount, 25);
  const inactive = store.inactivateDiscountRule(rule.id, "Fin de prueba sintética");
  assert.equal(inactive.active, false);
  const actions = store.getState().auditLogs.filter((entry) => entry.entity === rule.id).map((entry) => entry.action);
  assert.deepEqual(actions, ["INACTIVATE_DISCOUNT_RULE", "UPDATE_DISCOUNT_RULE", "CREATE_DISCOUNT_RULE"]);
  assert.throws(() => store.createDiscountRule({ name:"Inválido", calculationType:"FIXED", fixedAmount:0, categories:{} }), /monto fijo/i);
  safeStorage.clear();
});

test("CH16 no aplica un descuento que exige aprobación hasta vincular una solicitud aprobada", async () => {
  const store = await isolatedStore();
  const input = quoteInput(store);
  assert.throws(() => store.createQuote(input), /aprobación/i);
  const request = store.requestDiscountApproval({
    ruleId:input.discountGroupId,
    caseId:input.caseId,
    patientId:store.caseById(input.caseId).patientId,
    invoiceDate:input.invoiceDate,
    items:input.items,
    reason:input.discount.reason,
    requestKey:"CH16-APPROVAL-001"
  });
  assert.equal(request.status, "PENDING");
  await store.authenticate("finanzas@analiza.demo", DEMO_PASSWORD);
  const approved = store.approveDiscountRequest(request.id, "Aprobación sintética de prueba");
  assert.equal(approved.status, "APPROVED");
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  const quote = store.createQuote({ ...input, discountApprovalRequestId:approved.id });
  const expected = calculateQuote(quote.items, { type:"CATEGORY_PERCENTAGES", categories:{ SERVICES:15, STUDIES:10 }, exclusions:["MEDICATIONS"], maxAmount:null });
  assert.equal(quote.discountAmount, expected.discountAmount);
  assert.equal(quote.discountApprovalRequestId, approved.id);
  assert.ok(store.getState().auditLogs.some((entry) => entry.action === "REQUEST_DISCOUNT_APPROVAL"));
  assert.ok(store.getState().auditLogs.some((entry) => entry.action === "APPROVE_DISCOUNT_REQUEST"));
  safeStorage.clear();
});

test("CH16 invalida una aprobación cuando cambia el contenido de la cotización o la elegibilidad", async () => {
  const store = await isolatedStore();
  const input = quoteInput(store);
  const request = store.requestDiscountApproval({
    ruleId:input.discountGroupId, caseId:input.caseId, patientId:store.caseById(input.caseId).patientId,
    invoiceDate:input.invoiceDate, items:input.items, reason:input.discount.reason, requestKey:"CH16-APPROVAL-STALE"
  });
  await store.authenticate("finanzas@analiza.demo", DEMO_PASSWORD);
  store.approveDiscountRequest(request.id);
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  const changedItems = input.items.map((item, index) => index === 0 ? { ...item, quantity:2 } : item);
  assert.equal(store.discountApprovalStatus(store.getState().discountRules.find((rule) => rule.id === input.discountGroupId), {
    caseId:input.caseId, patientId:store.caseById(input.caseId).patientId, invoiceDate:input.invoiceDate,
    items:changedItems, approvalRequestId:request.id
  }).approved, false);
  assert.throws(() => store.createQuote({ ...input, items:changedItems, discountApprovalRequestId:request.id }), /aprobación/i);
  assert.throws(() => store.createDiscountRule({
    name:"Elegibilidad sintética CH16", type:"PROFILE", calculationType:"CATEGORY_PERCENTAGES", categories:{ SERVICES:5 },
    eligibility:{ patientId:"PAT-NO-EXISTE" }, requiresReason:false, requiresApproval:false
  }), /paciente.*disponible/i);
  safeStorage.clear();
});

test("CH16 no permite mutar perfiles a AUDITOR y normaliza las colecciones remotas", async () => {
  const store = await isolatedStore("auditoria@analiza.demo");
  assert.throws(() => store.createDiscountRule({ name:"Sin permiso", calculationType:"CATEGORY_PERCENTAGES", categories:{} }), /no tiene permiso/i);
  const mapped = mapSupabaseBootstrap({
    discountRules:[{
      id:"00000000-0000-0000-0000-000000000016", organization_id:"ORG-1", name:"Perfil remoto", rule_type:"PROFILE",
      calculation_type:"FIXED", fixed_amount:"12.50", category_percentages:{ SERVICES:5 }, excluded_categories:["MEDICATIONS"],
      eligibility:{ company_name:"Empresa sintética" }, max_amount:"10.00", approver_user_id:"00000000-0000-0000-0000-000000000006", status:"ACTIVE"
    }],
    discountApprovalRequests:[{
      id:"00000000-0000-0000-0000-000000000116", organization_id:"ORG-1", discount_rule_id:"00000000-0000-0000-0000-000000000016",
      hospitalization_id:"CASE-1", patient_id:"PAT-1", approver_user_id:"00000000-0000-0000-0000-000000000006", request_key:"KEY-16",
      quote_context:{ fingerprint:"fingerprint-16", items:[{ catalog_item_id:"CAT-1", quantity:1 }] }, calculated_discount_amount:"10.00", status:"PENDING"
    }]
  });
  assert.equal(mapped.discountRules[0].fixedAmount, 12.5);
  assert.deepEqual(mapped.discountRules[0].exclusions, ["MEDICATIONS"]);
  assert.equal(mapped.discountApprovalRequests[0].fingerprint, "fingerprint-16");
  safeStorage.clear();
});

test("CH16 enlaza UI, confirmación remota, RLS y RPCs transaccionales", async () => {
  const [main, views, store, adapter, migration] = await Promise.all([
    readFile(mainPath,"utf8"), readFile(viewsPath,"utf8"), readFile(storePath,"utf8"), readFile(adapterPath,"utf8"), readFile(migrationPath,"utf8")
  ]);
  for (const marker of ["request-discount-approval", "open-discount-approvals", "exportDiscounts", "save-discount", "inactivate-discount-rule"]) assert.ok(main.includes(marker), `falta ${marker}`);
  for (const marker of ["discountPageSize", "discountStatus", "Inactivar", "Excel", "Sin perfiles coincidentes"]) assert.ok(views.includes(marker), `falta ${marker}`);
  for (const action of ["SAVE_DISCOUNT_RULE", "REQUEST_DISCOUNT_APPROVAL", "DECIDE_DISCOUNT_APPROVAL"]) {
    assert.ok(store.includes(`requiredSync(\"${action}\"`), `falta confirmación ${action}`);
    assert.ok(adapter.includes(`case \"${action}\"`), `falta adaptador ${action}`);
  }
  for (const marker of [
    "create table if not exists public.discount_approval_requests",
    "alter table public.discount_approval_requests enable row level security",
    "create or replace function public.save_discount_rule",
    "create or replace function public.request_discount_approval",
    "create or replace function public.decide_discount_approval",
    "create or replace function public.apply_quote_draft_catalog_v2",
    "discount_approval_request_id",
    "rule_updated_epoch",
    "security definer",
    "set search_path = pg_catalog, public",
    "revoke all on table public.discount_rules from anon, authenticated",
    "grant select on table public.discount_approval_requests to authenticated"
  ]) assert.ok(migration.includes(marker), `falta ${marker}`);
  assert.match(adapter, /client\.rpc\("create_quote_draft_v2"/);
  assert.match(adapter, /client\.rpc\("save_discount_rule"/);
  assert.doesNotMatch(migration, /disable row level security/i);
});
