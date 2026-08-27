import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculateQuote, safeStorage } from "../app/domain.js";
import { createAppStore, DEMO_PASSWORD } from "../app/store.js";

test("CH06 calcula descuentos configurados por categoría", () => {
  const calculation = calculateQuote([
    { category:"SERVICES", quantity:1, unitPrice:100 },
    { category:"STUDIES", quantity:1, unitPrice:100 },
    { category:"MEDICATIONS", quantity:1, unitPrice:100 }
  ], { type:"CATEGORY_PERCENTAGES", categories:{ SERVICES:10, STUDIES:5, MEDICATIONS:0 } });
  assert.equal(calculation.subtotal, 300);
  assert.equal(calculation.discountAmount, 15);
  assert.equal(calculation.total, 285);
});

test("CH06 aplica sólo un grupo activo sin aprobación pendiente", async () => {
  safeStorage.clear();
  const store = await createAppStore({ dataMode:"mock", notificationsMode:"mock" });
  await store.authenticate("admin@analiza.demo", DEMO_PASSWORD);
  const service = store.getState().catalogItems.find((item) => item.category === "SERVICES");
  const study = store.getState().catalogItems.find((item) => item.category === "STUDIES");
  const input = {
    caseId:store.getState().cases[0].id,
    items:[service, study].map((item) => ({ catalogItemId:item.id, category:item.category, name:item.name, quantity:1, unitPrice:item.price })),
    invoiceDate:"2026-08-27", discountGroupId:"DISC-002", referredBy:"Referencia sintética",
    comments:"Cotización sintética CH06", discount:{ reason:"Motivo sintético autorizado" }
  };
  assert.throws(() => store.createQuote({ ...input, discountGroupId:"DISC-001" }), /requiere.*aprobación/i);
  assert.throws(() => store.createQuote({ ...input, discount:{ reason:"" } }), /motivo.*descuento/i);
  const quote = store.createQuote(input);
  const expected = calculateQuote(quote.items, { type:"CATEGORY_PERCENTAGES", categories:{ SERVICES:10, STUDIES:5 } });
  assert.equal(quote.discountAmount, expected.discountAmount);
  assert.equal(quote.total, expected.total);
  safeStorage.clear();
});

test("CH06 conserva categorías, catálogo rico, ledger y descuento seguro", async () => {
  const [main, mock, domain, store, migration] = await Promise.all([
    readFile(new URL("../app/main.js", import.meta.url), "utf8"),
    readFile(new URL("../app/mock-data.js", import.meta.url), "utf8"),
    readFile(new URL("../app/domain.js", import.meta.url), "utf8"),
    readFile(new URL("../app/store.js", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202608270002_ch05_quote_catalog_integrity.sql", import.meta.url), "utf8")
  ]);
  for (const contract of ["Insumos", "Equipos", "Honorarios", "Extras", "Fabricante sintético", "Filtrar por Item", "Desc. %", "Descuento configurado"])
    assert.ok(`${main}\n${mock}\n${domain}`.includes(contract), `Falta contrato CH06: ${contract}`);
  assert.match(store, /resolveQuoteDiscount/);
  assert.match(store, /requiresApproval/);
  assert.match(migration, /v_requires_approval/);
  assert.match(migration, /requiere aprobación previa/);
});
