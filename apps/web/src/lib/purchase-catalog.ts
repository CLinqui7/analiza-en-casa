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
  for (const key of [
    'invoiceNumber',
    'note',
    'expirationDate',
    'lotNumber',
    'serialNumber',
  ] as const) {
    if (normalized[key] === undefined) delete normalized[key];
  }
  return normalized;
}
