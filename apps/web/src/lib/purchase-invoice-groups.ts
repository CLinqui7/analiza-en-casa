import type { Purchase } from '@analiza/contracts';

/** The void command requires a received line, even when another line appears first. */
export function invoiceVoidSource(lines: readonly Purchase[]): Purchase | null {
  const received = lines.find((line) => line.status === 'RECEIVED');
  if (!received?.invoiceNumber) return null;
  if (
    lines.some(
      (line) =>
        !['RECEIVED', 'CANCELLED'].includes(line.status) ||
        line.invoiceVoidedAt ||
        line.invoiceNumber !== received.invoiceNumber ||
        line.supplierCatalogItemId !== received.supplierCatalogItemId ||
        line.reference !== received.reference ||
        line.warehouseId !== received.warehouseId,
    )
  )
    return null;
  return received;
}
