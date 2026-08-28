import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAppStore, DEMO_PASSWORD } from "../app/store.js";
import { safeStorage } from "../app/domain.js";

const general = {
  invoiceDate: "2026-08-27",
  discountGroupId: "REGULAR",
  referredBy: "Referencia sintética",
  comments: "Comentario administrativo sintético"
};

test("CH05 rechaza líneas inválidas aunque se omita la interfaz", async () => {
  safeStorage.clear();
  const store = await createAppStore({ dataMode: "mock", notificationsMode: "mock" });
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  const caseId = store.getState().cases[0].id;
  const item = store.getState().catalogItems[0];
  const base = { caseId, ...general, items: [{ catalogItemId:item.id, category:item.category, name:item.name, quantity:1, unitPrice:item.price }] };
  assert.throws(() => store.createQuote({ ...base, items: [{ ...base.items[0], quantity: 0 }] }), /cantidad.*mayor/i);
  assert.throws(() => store.createQuote({ ...base, items: [{ ...base.items[0], unitPrice: -1 }] }), /precio válido/i);
  assert.throws(() => store.createQuote({ ...base, items: [{ ...base.items[0], unitPrice: item.price + 1 }] }), /coincidir.*catálogo/i);
  assert.throws(() => store.createQuote({ ...base, items: [{ ...base.items[0], discountAmount: item.price + 1 }] }), /descuento.*superar.*bruto/i);
  assert.throws(() => store.createQuote({ ...base, items: [{ ...base.items[0], discountAmount: Number.NaN }] }), /descuento.*importe válido/i);
  assert.throws(() => store.createQuote({ ...base, items: [{ ...base.items[0], name: "Nombre manipulado" }] }), /coincidir.*catálogo|catálogo autorizado/i);
  assert.throws(() => store.createQuote({ ...base, items: [{ ...base.items[0], category: "NO-AUTORIZADA" }] }), /categoría.*autorizada/i);
  assert.throws(() => store.createQuote({ ...base, items: [{ ...base.items[0], catalogItemId: "CAT-AJENO" }] }), /catálogo autorizado/i);
  const quote = store.createQuote(base);
  assert.equal(quote.items.length, 1);
  safeStorage.clear();
});

test("CH05 conserva compositor, procesamiento, ledger y resumen observados", async () => {
  const [main, styles, storeSource, adapter, migration] = await Promise.all([
    readFile(new URL("../app/main.js", import.meta.url), "utf8"),
    readFile(new URL("../app/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../app/store.js", import.meta.url), "utf8"),
    readFile(new URL("../app/supabase-adapter.js", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608270002_ch05_quote_catalog_integrity.sql", import.meta.url), "utf8")
  ]);
  for (const contract of ["Socio de negocios", "quote-item-search", "No results found", "Procesando...", "Cantidad", "Añadir", "quote-ledger", "Filtrar por Item", "Código", "Subtotal", "Desc. %", "Desc. $", "Impuesto", "Total", "manufacturer"])
    assert.ok(`${main}\n${styles}`.includes(contract), `Falta contrato CH05: ${contract}`);
  assert.match(main, /CH05-Q001/);
  assert.match(main, /CH05-Q004/);
  assert.match(main, /CH05-Q005/);
  assert.doesNotMatch(main, /data-action="quote-item-price-change"/);
  for (const contract of ["create_quote_draft", "update_quote_draft_catalog", "create_quote_revision_catalog"])
    assert.ok(adapter.includes(contract), `Falta RPC transaccional CH05: ${contract}`);
  for (const contract of ["apply_quote_draft_catalog", "create_quote_revision_catalog", "price_list_items", "price_list_item_id", "revoke insert, update, delete", "revoke execute on function public.create_quote_revision", "public.current_organization_id()"])
    assert.ok(migration.includes(contract), `Falta integridad financiera CH05: ${contract}`);
  assert.doesNotMatch(adapter, /case "CREATE_QUOTE": \{[\s\S]{0,1000}\.from\("quote_items"\)\.insert/);
  assert.match(storeSource, /adapter\.mode === "supabase"[\s\S]{0,160}requiredSync\("CREATE_QUOTE"/);
  assert.match(storeSource, /requiredSync\("CREATE_QUOTE_REVISION"/);
  assert.match(storeSource, /requiredSync\("UPDATE_QUOTE_DRAFT"/);
  assert.match(storeSource, /remote\?\.quote_id[\s\S]{0,220}remote\.quote_version_id/);
  assert.match(main, /const result=await runSafely\(\(\)=>draft\.editDraft/);
});
