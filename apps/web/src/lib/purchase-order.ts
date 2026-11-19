import { z } from 'zod';

const referencePrice = z
  .number()
  .finite()
  .positive()
  .max(1_000_000)
  .refine(
    (value) => Math.abs(value * 10_000 - Math.round(value * 10_000)) < 0.000001,
    'Indique un precio de referencia con hasta cuatro decimales.',
  );

export const purchaseOrderInputSchema = z
  .object({
    id: z.string().uuid(),
    supplierCatalogItemId: z.string().min(1).max(200),
    applyPerception: z.boolean().optional(),
    items: z
      .array(
        z
          .object({
            catalogItemId: z.string().min(1).max(200),
            quantity: z.number().int().positive().max(10_000),
            referenceUnitPrice: referencePrice,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export type PurchaseOrderInput = z.infer<typeof purchaseOrderInputSchema>;

export const purchaseOrderSchema = purchaseOrderInputSchema.extend({
  status: z.enum(['DRAFT', 'APPROVED', 'RECEIVED', 'CANCELLED', 'LINKED']).default('DRAFT'),
  workflowVersion: z.literal(1).optional(),
  revision: z.number().int().positive().default(1),
  receipt: z
    .object({
      kind: z.enum(['INVOICE', 'CREDIT_NOTE', 'FISCAL_CREDIT']),
      number: z.string(),
      fingerprint: z.string(),
    })
    .optional(),
  cancelReason: z.string().optional(),
  orderNumber: z.string(),
  issuedAt: z.string().datetime(),
  supplierName: z.string(),
  items: z
    .array(
      z.object({
        catalogItemId: z.string(),
        sku: z.string(),
        name: z.string(),
        quantity: z.number().int().positive(),
        referenceUnitPrice: referencePrice,
        lineTotal: z.number().nonnegative(),
      }),
    )
    .min(1),
  total: z.number().nonnegative(),
  subtotal: z.number().nonnegative().optional(),
  iva: z.number().nonnegative().optional(),
  perception: z.number().nonnegative().optional(),
  fingerprint: z.string().length(64),
});

export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;

export const receiptDocumentNames = {
  INVOICE: 'Factura',
  CREDIT_NOTE: 'Nota de crédito',
  FISCAL_CREDIT: 'Crédito fiscal',
} as const;

export const receiptWarehouseNames = {
  GENERAL: 'Bodega general Analiza en Casa',
  KIT: 'Botiquín Analiza',
} as const;

const receiptLine = z
  .object({
    index: z.number().int().nonnegative(),
    quantity: z.number().int().min(0).max(10000),
    lotNumber: z.string().trim().max(120),
    expiresOn: z.union([z.literal(''), z.string().date()]),
    serialNumbers: z.array(z.string().trim().min(1).max(120)).max(10000),
    usefulLife: z.string().trim().max(120),
    isFixedAsset: z.boolean(),
  })
  .strict();

export const orderActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('edit'),
      revision: z.number().int().positive(),
      order: purchaseOrderInputSchema,
    })
    .strict(),
  z.object({ action: z.literal('approve'), revision: z.number().int().positive() }).strict(),
  z
    .object({
      action: z.literal('cancel'),
      revision: z.number().int().positive(),
      reason: z.string().trim().min(1).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal('receive'),
      revision: z.number().int().positive(),
      destination: z.enum(['GENERAL', 'KIT']),
      documentKind: z.enum(['INVOICE', 'FISCAL_CREDIT', 'CREDIT_NOTE']),
      documentNumber: z.string().trim().min(1).max(100),
      lines: z.array(receiptLine).min(1).max(100),
    })
    .strict(),
]);
export type OrderAction = z.infer<typeof orderActionSchema>;

export function purchaseOrderLineTotal(quantity: number, referenceUnitPrice: number) {
  return Math.round(quantity * referenceUnitPrice * 100) / 100;
}

export function purchaseOrderTotals(
  lines: readonly { quantity: number; referenceUnitPrice: number }[],
  applyPerception: boolean,
) {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.referenceUnitPrice * 100),
    0,
  );
  const ivaCents = Math.round(subtotalCents * 0.13);
  const perceptionCents = applyPerception ? Math.round(subtotalCents * 0.01) : 0;
  return {
    subtotal: subtotalCents / 100,
    iva: ivaCents / 100,
    perception: perceptionCents / 100,
    total: (subtotalCents + ivaCents + perceptionCents) / 100,
  };
}
