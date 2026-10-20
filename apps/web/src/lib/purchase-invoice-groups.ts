import type { Purchase } from '@analiza/contracts';

/** The void command requires a received line, even when another line appears first. */
export function invoiceVoidSource(lines: readonly Purchase[]): Purchase | null {
  const draft =
    lines.length > 1 && lines.every((line) => line.status === 'DRAFT') ? lines[0] : null;
  if (
    draft?.invoiceGroupId &&
    draft.invoiceNumber &&
    lines.every(
      (line) =>
        !line.invoiceVoidedAt &&
        line.invoiceGroupId === draft.invoiceGroupId &&
        line.invoiceNumber === draft.invoiceNumber &&
        line.supplierCatalogItemId === draft.supplierCatalogItemId &&
        line.reference === draft.reference &&
        line.warehouseId === draft.warehouseId,
    )
  )
    return draft;
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
