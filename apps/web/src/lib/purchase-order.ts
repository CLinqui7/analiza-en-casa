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
