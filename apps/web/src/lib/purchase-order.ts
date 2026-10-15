import { z } from 'zod';

const referencePrice = z
  .number()
  .finite()
  .positive()
  .max(1_000_000)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
    'Indique un precio de referencia con hasta dos decimales.',
  );

export const purchaseOrderInputSchema = z
  .object({
    id: z.string().uuid(),
    supplierCatalogItemId: z.string().min(1).max(200),
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
  fingerprint: z.string().length(64),
});

export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;

export function purchaseOrderLineTotal(quantity: number, referenceUnitPrice: number) {
  return (quantity * Math.round(referenceUnitPrice * 100)) / 100;
}
