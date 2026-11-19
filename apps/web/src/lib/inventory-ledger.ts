import type {
  ClinicalRecord,
  HomeCustody,
  InventoryMovement,
  InventoryTraceRecord,
  OperationsSnapshot,
  Purchase,
} from '@analiza/contracts';
import { movementDelta } from '@analiza/domain';

type StockPosition = {
  itemId: string;
  warehouseId: string;
  available: number;
  held: number;
  expired: number;
};
const positionKey = (item: string, warehouse: string) => JSON.stringify([item, warehouse]);

export function stockByWarehouse(
  movements: InventoryMovement[],
  records: InventoryTraceRecord[],
  custodies: HomeCustody[],
  today = new Date().toISOString().slice(0, 10),
) {
  const positions = new Map<string, StockPosition>();
  const position = (itemId: string, warehouseId: string) => {
    const key = positionKey(itemId, warehouseId);
    let row = positions.get(key);
    if (!row) {
      row = { itemId, warehouseId, available: 0, held: 0, expired: 0 };
      positions.set(key, row);
    }
    return row;
  };
  for (const movement of movements)
    position(movement.itemId, movement.warehouseId ?? 'central').available +=
      movementDelta(movement);
  for (const record of records) {
    for (const { warehouseId, quantity } of record.balances) {
      const row = position(record.itemId, warehouseId);
      if (
        record.expiresOn &&
        record.expiresOn < today &&
        (record.qualityStatus === 'AVAILABLE' || record.qualityStatus === 'QUARANTINED')
      ) {
        row.expired += quantity;
        if (record.qualityStatus === 'AVAILABLE') row.available -= quantity;
      } else if (record.qualityStatus !== 'AVAILABLE') row.held += quantity;
    }
  }
  for (const custody of custodies) {
    if (custody.returnedQuantity)
      position(custody.itemId, custody.warehouseId).held += custody.returnedQuantity;
  }
  return [...positions.values()];
}

export function custodyReturns(custody: HomeCustody) {
  if (custody.returns?.length) return custody.returns;
  return custody.returnedQuantity && custody.receivedAt
    ? [
        {
          id: custody.closeKey ?? custody.id,
          quantity: custody.returnedQuantity,
          receivedAt: custody.receivedAt,
          receivedBy: '',
        },
      ]
    : [];
}

export type LedgerRow = InventoryMovement & {
  delta: number;
  balance: number;
  heldReceipt?: boolean;
};

/** Physical receipts held for inspection appear immediately. Only availability movements change the spendable balance. */
export function inventoryLedger(
  movements: InventoryMovement[],
  records: InventoryTraceRecord[],
  receipts: OperationsSnapshot['inventoryLedgerReceipts'],
  purchases: Purchase[],
  custodies: HomeCustody[],
  clinical: ClinicalRecord[],
) {
  const received = new Map(
    purchases
      .filter((p) => p.status === 'RECEIVED' && p.traceRecordId)
      .map((p) => [p.traceRecordId!, p]),
  );
  const receiptSources = new Map(receipts?.map((r) => [r.traceRecordId, r]));
  const patientByMovement = new Map<string, string>();
  for (const record of clinical)
    for (const id of record.stockMovementIds ?? []) patientByMovement.set(id, record.patientId);
  const entries: LedgerRow[] = [];
  for (const custody of custodies) {
    const suffixes = custody.traceAllocations.length
      ? custody.traceAllocations.map((_, i) => String(i))
      : ['untraced'];
    for (const suffix of suffixes)
      patientByMovement.set(`${custody.id}:out:${suffix}`, custody.patientId);
    for (const event of custodyReturns(custody)) {
      entries.push({
        id: `held-return:${custody.id}:${event.id}`,
        itemId: custody.itemId,
        patientId: custody.patientId,
        warehouseId: custody.warehouseId,
        quantity: event.quantity,
        createdAt: event.receivedAt,
        kind: 'RETURN',
        reason: 'Devolución en cuarentena',
        user: event.receivedBy || undefined,
        heldReceipt: true,
        delta: 0,
        balance: 0,
      });
    }
  }
  for (const record of records) {
    const purchase = received.get(record.id);
    const source = receiptSources.get(record.id);
    entries.push({
      id: `physical:${record.id}`,
      itemId: record.itemId,
      traceRecordId: record.id,
      traceNumber: record.number,
      warehouseId: source?.warehouseId ?? purchase?.warehouseId,
      kind: 'ENTRY',
      quantity: record.receivedQuantity,
      createdAt: record.receivedAt,
      reason: 'Recepción en cuarentena',
      purchaseDocumentNumber: source?.purchaseDocumentNumber ?? purchase?.invoiceNumber,
      user: source?.registeredBy,
      delta: 0,
      balance: 0,
      heldReceipt: true,
    });
  }
  for (const movement of movements) {
    entries.push({
      ...movement,
      delta: movementDelta(movement),
      balance: 0,
      patientId: movement.patientId ?? patientByMovement.get(movement.id),
    });
  }
  const balances = new Map<string, number>();
  entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (const row of entries) {
    const key = positionKey(row.itemId, row.warehouseId ?? 'central');
    row.balance = (balances.get(key) ?? 0) + row.delta;
    balances.set(key, row.balance);
  }
  return entries.reverse();
}
