import { z } from 'zod';

const id = z.string().trim().min(1).max(120);
const text = z.string().trim().min(1).max(500);
const date = z.string().datetime({ offset: true });
export const configurationCategories = ['SPECIALTY', 'DOSE', 'INSURER', 'MEDICATION'] as const;

export const warehouseStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export const warehouseInputSchema = z
  .object({
    id,
    code: z.string().trim().min(2).max(40),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    status: warehouseStatusSchema,
  })
  .strict();
export const warehouseSchema = warehouseInputSchema.extend({
  createdAt: date,
  updatedAt: date,
});
export type Warehouse = z.infer<typeof warehouseSchema>;

export const warehouseTransferSchema = z
  .object({
    id,
    itemId: id,
    sourceWarehouseId: id,
    destinationWarehouseId: id,
    quantity: z.number().int().positive().max(1000000),
    reason: z.string().trim().min(1).max(500),
    reference: z.string().trim().max(200).optional(),
    occurredAt: date,
    idempotencyKey: id,
  })
  .strict()
  .refine((value) => value.sourceWarehouseId !== value.destinationWarehouseId, {
    message: 'La bodega de destino debe ser distinta de la bodega de origen.',
    path: ['destinationWarehouseId'],
  });
export type WarehouseTransfer = z.infer<typeof warehouseTransferSchema>;

export const inventoryTraceKindSchema = z.enum(['LOT', 'SERIAL']);
export const inventoryTraceQualityStatusSchema = z.enum([
  'QUARANTINED',
  'AVAILABLE',
  'BLOCKED',
  'REJECTED',
]);
export const inventoryTraceBalanceSchema = z
  .object({ warehouseId: id, quantity: z.number().int().nonnegative().max(1000000) })
  .strict();
export const inventoryTraceRecordSchema = z
  .object({
    id,
    kind: inventoryTraceKindSchema,
    itemId: id,
    supplierCatalogItemId: id,
    number: z.string().trim().min(1).max(120),
    receivedQuantity: z.number().int().positive().max(1000000),
    manufacturedOn: z.iso.date().optional(),
    expiresOn: z.iso.date().optional(),
    receiptReference: z.string().trim().min(1).max(200),
    qualityStatus: inventoryTraceQualityStatusSchema,
    receivedAt: date,
    createdAt: date,
    updatedAt: date,
    balances: z.array(inventoryTraceBalanceSchema),
  })
  .strict();
export type InventoryTraceRecord = z.infer<typeof inventoryTraceRecordSchema>;

export const inventoryTraceReceiptSchema = z
  .object({
    id,
    kind: inventoryTraceKindSchema,
    itemId: id,
    warehouseId: id,
    supplierCatalogItemId: id,
    number: z.string().trim().min(1).max(120),
    quantity: z.number().int().positive().max(1000000),
    manufacturedOn: z.iso.date().optional(),
    expiresOn: z.iso.date().optional(),
    receiptReference: z.string().trim().min(1).max(200),
    reason: z.string().trim().min(1).max(500),
    receivedAt: date,
    idempotencyKey: id,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.kind === 'LOT' && !value.expiresOn)
      context.addIssue({ code: 'custom', message: 'Indique el vencimiento.', path: ['expiresOn'] });
    if (value.kind === 'SERIAL' && value.quantity !== 1)
      context.addIssue({
        code: 'custom',
        message: 'Cada número de serie representa una unidad.',
        path: ['quantity'],
      });
    if (value.kind === 'SERIAL' && value.expiresOn)
      context.addIssue({
        code: 'custom',
        message: 'El vencimiento se registra por lote, no por número de serie.',
        path: ['expiresOn'],
      });
    if (value.manufacturedOn && value.expiresOn && value.manufacturedOn > value.expiresOn)
      context.addIssue({
        code: 'custom',
        message: 'El vencimiento debe ser posterior a la fabricación.',
        path: ['expiresOn'],
      });
  });
export type InventoryTraceReceipt = z.infer<typeof inventoryTraceReceiptSchema>;

export const inventoryTraceStatusChangeSchema = z
  .object({
    id,
    recordId: id,
    status: z.enum(['AVAILABLE', 'BLOCKED', 'REJECTED']),
    reason: z.string().trim().min(1).max(500),
    occurredAt: date,
    idempotencyKey: id,
  })
  .strict();
export type InventoryTraceStatusChange = z.infer<typeof inventoryTraceStatusChangeSchema>;

export const inventoryFefoIssueSchema = z
  .object({
    id,
    itemId: id,
    warehouseId: id,
    quantity: z.number().int().positive().max(1000000),
    reference: z.string().trim().min(1).max(200),
    reason: z.string().trim().min(1).max(500),
    occurredAt: date,
    idempotencyKey: id,
  })
  .strict();
export type InventoryFefoIssue = z.infer<typeof inventoryFefoIssueSchema>;
export const configurationEntrySchema = z
  .object({
    id,
    category: z.enum(configurationCategories),
    label: text,
    active: z.boolean(),
    discountPercent: z.number().min(0).max(100).optional(),
    inventoryItemId: id.optional(),
    tabletsPerBlister: z.number().int().positive().max(10000).optional(),
    tabletsPerBox: z.number().int().positive().max(100000).optional(),
  })
  .strict();
export type ConfigurationEntry = z.infer<typeof configurationEntrySchema>;

export const balancePeriodSchema = z.object({
  id,
  caseId: id,
  patientId: id,
  startsAt: date,
  endsAt: date,
  status: z.enum(['OPEN', 'CLOSED']),
  createdBy: id,
  closedBy: id.optional(),
  closedAt: date.optional(),
  handoff: z.string().max(2000).optional(),
});
export type BalancePeriod = z.infer<typeof balancePeriodSchema>;
export const balanceEntryInputSchema = z
  .object({
    periodId: id,
    measuredAt: date,
    direction: z.enum(['INTAKE', 'OUTPUT']),
    category: text,
    milliliters: z.number().finite().nonnegative().max(100000),
    note: z.string().trim().max(2000).optional(),
    correctionOf: id.optional(),
    correctionReason: text.optional(),
    idempotencyKey: id,
  })
  .strict();
export const balanceEntrySchema = balanceEntryInputSchema.extend({
  id,
  actorUserId: id,
  createdAt: date,
});
export type BalanceEntry = z.infer<typeof balanceEntrySchema>;
export const administrationInputSchema = z
  .object({
    caseId: id,
    medicationId: id,
    doseId: id,
    presentation: z.enum(['TABLET', 'BLISTER', 'BOX']),
    quantity: z.number().int().positive().max(100000),
    warehouseId: id,
    administeredAt: date,
    note: z.string().trim().max(2000).optional(),
    idempotencyKey: id,
  })
  .strict();
export const administrationSchema = administrationInputSchema.extend({
  id,
  actorUserId: id,
  baseUnits: z.number().int().positive(),
  inventoryMovementId: id,
});
export type Administration = z.infer<typeof administrationSchema>;
export const visitInputSchema = z
  .object({
    professionalUserId: id,
    professionalName: text,
    profession: z.enum(['NURSE', 'DOCTOR']),
    occurredAt: date,
    patientId: id,
    saleAmount: z.number().finite().nonnegative().max(10000000),
    saleReference: z.string().trim().max(200),
    note: z.string().max(1000).optional(),
    idempotencyKey: id,
  })
  .strict()
  .refine((value) => value.saleAmount === 0 || Boolean(value.saleReference), {
    message: 'Una venta requiere referencia de respaldo.',
    path: ['saleReference'],
  });
export const visitSchema = visitInputSchema.safeExtend({ id, createdBy: id });
export type Visit = z.infer<typeof visitSchema>;
export const goalInputSchema = z
  .object({
    professionalUserId: id,
    professionalName: text,
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    visitTarget: z.number().int().nonnegative(),
    salesTarget: z.number().finite().nonnegative(),
  })
  .strict();
export const goalSchema = goalInputSchema.extend({ id });
export type VisitGoal = z.infer<typeof goalSchema>;
export type OperationsSnapshot = {
  professionals: Array<{ userId: string; name: string; profession: 'NURSE' | 'DOCTOR' }>;
  configuration: ConfigurationEntry[];
  periods: BalancePeriod[];
  balanceEntries: BalanceEntry[];
  administrations: Administration[];
  visits: Visit[];
  goals: VisitGoal[];
  warehouses: Warehouse[];
  traceRecords: InventoryTraceRecord[];
};
export const emptyOperations = (): OperationsSnapshot => ({
  professionals: [],
  configuration: [],
  periods: [],
  balanceEntries: [],
  administrations: [],
  visits: [],
  goals: [],
  warehouses: [],
  traceRecords: [],
});

/** Corrections append a new observation; the original remains available for audit. */
export function balanceTotals(entries: readonly BalanceEntry[]) {
  const superseded = new Set(
    entries.flatMap((entry) => (entry.correctionOf ? [entry.correctionOf] : [])),
  );
  let intake = 0;
  let output = 0;
  for (const entry of entries) {
    if (superseded.has(entry.id)) continue;
    if (entry.direction === 'INTAKE') intake += entry.milliliters;
    else output += entry.milliliters;
  }
  return { intake, output, balance: intake - output };
}
