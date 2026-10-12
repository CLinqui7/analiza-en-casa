import type { InventoryTraceRecord } from '@analiza/contracts';

export type InventoryTraceEffectiveStatus =
  InventoryTraceRecord['qualityStatus'] | 'EXPIRED' | 'DEPLETED';

export function inventoryTraceQuantity(record: InventoryTraceRecord) {
  return record.balances.reduce((sum, balance) => sum + balance.quantity, 0);
}

export function inventoryTraceEffectiveStatus(
  record: InventoryTraceRecord,
  today = new Date().toISOString().slice(0, 10),
): InventoryTraceEffectiveStatus {
  if (inventoryTraceQuantity(record) === 0) return 'DEPLETED';
  if (
    ['QUARANTINED', 'AVAILABLE'].includes(record.qualityStatus) &&
    record.expiresOn &&
    record.expiresOn < today
  )
    return 'EXPIRED';
  return record.qualityStatus;
}

export function expiredTraceQuantity(
  records: readonly InventoryTraceRecord[],
  itemId: string,
  warehouseId: string,
  today = new Date().toISOString().slice(0, 10),
) {
  return records
    .filter(
      (record) =>
        record.itemId === itemId &&
        record.qualityStatus === 'AVAILABLE' &&
        Boolean(record.expiresOn) &&
        record.expiresOn! < today,
    )
    .reduce(
      (sum, record) =>
        sum +
        record.balances
          .filter((balance) => balance.warehouseId === warehouseId)
          .reduce((subtotal, balance) => subtotal + balance.quantity, 0),
      0,
    );
}

/** Physical quantities not eligible for dispatch, grouped without counting a lot twice. */
export function unavailableTraceQuantities(
  records: readonly InventoryTraceRecord[],
  itemId: string,
  warehouseId: string,
  today = new Date().toISOString().slice(0, 10),
) {
  return records.reduce(
    (totals, record) => {
      if (record.itemId !== itemId) return totals;
      const quantity = record.balances
        .filter((balance) => balance.warehouseId === warehouseId)
        .reduce((sum, balance) => sum + balance.quantity, 0);
      if (!quantity) return totals;
      if (
        record.expiresOn &&
        record.expiresOn < today &&
        ['QUARANTINED', 'AVAILABLE'].includes(record.qualityStatus)
      )
        totals.expired += quantity;
      else if (record.qualityStatus !== 'AVAILABLE') totals.held += quantity;
      return totals;
    },
    { held: 0, expired: 0 },
  );
}
