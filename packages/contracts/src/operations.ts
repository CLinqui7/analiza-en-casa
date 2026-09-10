import { z } from 'zod';

const id = z.string().trim().min(1).max(120);
const text = z.string().trim().min(1).max(500);
const date = z.string().datetime({ offset: true });
export const configurationCategories = ['SPECIALTY', 'DOSE', 'INSURER', 'MEDICATION'] as const;
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
};
export const emptyOperations = (): OperationsSnapshot => ({
  professionals: [],
  configuration: [],
  periods: [],
  balanceEntries: [],
  administrations: [],
  visits: [],
  goals: [],
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
