import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateQuote,
  validatePayment,
  canTransitionQuote,
  quoteProgress,
  quoteBalance,
  inventoryFree,
  inventoryState,
  statementBalance,
  roleCan,
  toCsv
} from "../app/domain.js";

test("calculateQuote aplica descuento y separa seguro/paciente con decimales exactos", () => {
  const result = calculateQuote(
    [
      { quantity: 5, unitPrice: 180, discountAmount: 0 },
      { quantity: 10, unitPrice: 14.8, discountAmount: 0 },
      { quantity: 3, unitPrice: 29, discountAmount: 0 },
      { quantity: 2, unitPrice: 95, discountAmount: 0 }
    ],
    { type: "PERCENT", value: 5 },
    900
  );
  assert.equal(result.subtotal, 1325);
  assert.equal(result.discountAmount, 66.25);
  assert.equal(result.total, 1258.75);
  assert.equal(result.insurerAmount, 900);
  assert.equal(result.patientAmount, 358.75);
});

test("calculateQuote limita cobertura a total", () => {
  const result = calculateQuote([{ quantity: 1, unitPrice: 100 }], { type: "PERCENT", value: 0 }, 500);
  assert.equal(result.insurerAmount, 100);
  assert.equal(result.patientAmount, 0);
});

test("validatePayment impide referencias duplicadas y sobrepago", () => {
  assert.equal(validatePayment({ amount: 50, balance: 100, existingReferences: ["ABC"], reference: "ABC" }).ok, false);
  assert.equal(validatePayment({ amount: 120, balance: 100, existingReferences: [], reference: "NEW" }).ok, false);
  assert.equal(validatePayment({ amount: 100, balance: 100, existingReferences: [], reference: "NEW" }).ok, true);
});

test("workflow de cotización bloquea saltos incompatibles", () => {
  assert.equal(canTransitionQuote("DRAFT", "READY_TO_SEND"), true);
  assert.equal(canTransitionQuote("DRAFT", "APPROVED"), false);
  assert.equal(canTransitionQuote("INSURER_REVIEW", "INFO_REQUIRED"), true);
  assert.equal(canTransitionQuote("INSURER_REVIEW", "PARTIALLY_APPROVED"), true);
  assert.ok(quoteProgress("APPROVED") > quoteProgress("DRAFT"));
});

test("quoteBalance considera solo pagos aplicados", () => {
  const quote = { id: "Q1", patientAmount: 300 };
  const payments = [
    { quoteId: "Q1", amount: 100, status: "APPLIED" },
    { quoteId: "Q1", amount: 50, status: "REVERSED" },
    { quoteId: "Q2", amount: 200, status: "APPLIED" }
  ];
  assert.equal(quoteBalance(quote, payments), 200);
});

test("inventario libre y alertas", () => {
  assert.equal(inventoryFree({ stock: 20, committed: 5 }), 15);
  assert.equal(inventoryState({ stock: 20, committed: 5, minimum: 10 }), "OK");
  assert.equal(inventoryState({ stock: 10, committed: 5, minimum: 7 }), "LOW");
  assert.equal(inventoryState({ stock: 5, committed: 5, minimum: 2 }), "OUT");
});

test("estado de cuenta médico calcula pendiente", () => {
  assert.equal(statementBalance({ gross: 225, adjustments: 10, withholdings: 22.5, paid: 50 }), 162.5);
});

test("roles respetan separación de funciones", () => {
  assert.equal(roleCan("ADMIN", "settings:write"), true);
  assert.equal(roleCan("NURSE", "clinical:write"), true);
  assert.equal(roleCan("NURSE", "payments:write"), false);
  assert.equal(roleCan("INVENTORY", "inventory:write"), true);
  assert.equal(roleCan("AUDITOR", "audit:read"), true);
  assert.equal(roleCan("AUDITOR", "payments:write"), false);
});

test("CSV escapa comas y comillas", () => {
  const csv = toCsv([{ name: 'Paciente, "Demo"', status: "ACTIVE" }]);
  assert.match(csv, /"Paciente, ""Demo"""/);
});
