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
  if (record.expiresOn && record.expiresOn < today) return 'EXPIRED';
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
