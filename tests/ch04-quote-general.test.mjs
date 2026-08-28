import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppStore } from "../app/store.js";
import { DEMO_PASSWORD } from "./helpers/demo-auth.mjs";
import { safeStorage } from "../app/domain.js";

test("CH04 conserva datos generales, búsquedas, multiselección y categorías observadas", async () => {
  const [main, styles, domain, migration, adapter] = await Promise.all([
    readFile(new URL("../app/main.js", import.meta.url), "utf8"),
    readFile(new URL("../app/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../app/domain.js", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608270001_ch04_quote_general_integrity.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/supabase-adapter.js", import.meta.url), "utf8")
  ]);
  for (const contract of [
    "quote-patient-options", "patientSearch", "DUI/NIT", "Teléfono", "Correo",
    "invoiceDate", "discountGroupId", "quote-referral-options", "referral-tags",
    "quote-remove-referral", "clear-quote-giftcard", "Comentarios",
    "Servicios", "Estudios Dx", "Medicamentos", "Insumos", "Equipos", "Honorarios", "Extras",
    "Solo disponibles en inventario", "Socio de negocios", "Precio", "Cantidad"
  ]) assert.ok(`${main}\n${styles}\n${domain}`.includes(contract), `Falta contrato CH04: ${contract}`);
  assert.match(main, /CH03-Q007\/CH04-Q005\/CH04-Q006/);
  assert.match(main, /CH05-Q001/);
  assert.match(main, /CH05-Q005/);
  for (const contract of ["validate_quote_general_integrity", "v_case_organization_id", "v_case_patient_id", "discount_group_id", "referred_by", "invoice_date", "prevent_sent_quote_financial_change"])
    assert.ok(migration.includes(contract), `Falta integridad remota CH04: ${contract}`);
  for (const contract of ["invoice_date", "discount_group_id", "referred_by", "giftcard"])
    assert.ok(adapter.includes(contract), `Falta mapeo remoto CH04: ${contract}`);
});

test("CH04 valida generales obligatorios también en el dominio", async () => {
  safeStorage.clear();
  const store = await createAppStore({ dataMode: "mock", notificationsMode: "mock" });
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  const catalogItem = store.getState().catalogItems[0];
  const base = {
    caseId: store.getState().cases[0].id,
    items: [{ catalogItemId: catalogItem.id, category: catalogItem.category, name: catalogItem.name, quantity: 1, unitPrice: catalogItem.price }],
    invoiceDate: "2026-08-27",
    discountGroupId: "REGULAR",
    referredBy: "Referencia sintética",
    comments: "Comentario administrativo sintético"
  };
  assert.throws(() => store.createQuote({ ...base, invoiceDate: "2026-02-31" }), /fecha.*válida/i);
  assert.throws(() => store.createQuote({ ...base, discountGroupId: "NO-AUTORIZADO" }), /grupo de descuento autorizado/i);
  assert.throws(() => store.createQuote({ ...base, referredBy: "" }), /referencia autorizada/i);
  assert.throws(() => store.createQuote({ ...base, comments: "" }), /comentarios.*obligatorios/i);
  const quote = store.createQuote(base);
  assert.equal(quote.invoiceDate, base.invoiceDate);
  assert.equal(quote.referredBy, base.referredBy);
  safeStorage.clear();
});
