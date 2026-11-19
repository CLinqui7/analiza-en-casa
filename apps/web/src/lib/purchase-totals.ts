import type { Purchase } from '@analiza/contracts';

export function samePurchaseTaxRates(a: Purchase['taxRates'], b: Purchase['taxRates']) {
  return a?.iva === b?.iva && a?.perception === b?.perception;
}

/** A serial has its own physical record. Money rounds once per invoiced order line. */
export function invoicedPurchaseLines(lines: readonly Purchase[]) {
  const grouped = new Map<string, Purchase>();
  for (const line of lines) {
    const key =
      line.purchaseOrderId && line.purchaseOrderLineIndex !== undefined
        ? JSON.stringify([
            line.purchaseOrderId,
            line.purchaseOrderLineIndex,
            line.catalogItemId,
            line.unitCost,
          ])
        : line.id;
    const existing = grouped.get(key);
    if (existing)
      grouped.set(key, { ...existing, quantity: (existing.quantity ?? 1) + (line.quantity ?? 1) });
    else grouped.set(key, line);
  }
  return [...grouped.values()];
}

export function purchaseTotals(lines: readonly Purchase[]) {
  if (!lines.length || lines.some((line) => line.unitCost === undefined || !line.taxRates))
    return null;
  const { iva, perception } = lines[0].taxRates!;
  if (lines.some((line) => line.taxRates?.iva !== iva || line.taxRates?.perception !== perception))
    return null;
  const subtotalCents = invoicedPurchaseLines(lines).reduce(
    (sum, line) => sum + Math.round((line.quantity ?? 1) * (line.unitCost ?? 0) * 100),
    0,
  );
  const ivaCents = Math.round(subtotalCents * iva);
  const perceptionCents = Math.round(subtotalCents * perception);
  return {
    subtotal: subtotalCents / 100,
    iva: ivaCents / 100,
    perception: perceptionCents / 100,
    total: (subtotalCents + ivaCents + perceptionCents) / 100,
  };
}
