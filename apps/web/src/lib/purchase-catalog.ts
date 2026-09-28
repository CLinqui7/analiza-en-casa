import type { Purchase } from '@analiza/contracts';

export function normalizePurchaseTraceability(purchase: Purchase, category: unknown) {
  const normalized = { ...purchase };
  if (category === 'EQUIPMENT') {
    delete normalized.expirationDate;
    delete normalized.lotNumber;
  }
  if (category === 'MEDICATIONS' || category === 'SUPPLIES') {
    delete normalized.serialNumber;
  }
  return normalized;
}
