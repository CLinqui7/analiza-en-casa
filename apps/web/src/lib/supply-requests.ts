import { z } from 'zod';

export const supplyRequestInputSchema = z
  .object({
    idempotencyKey: z.uuid(),
    patientId: z.string().min(1),
    catalogItemId: z.string().min(1),
    quantity: z.number().int().min(1).max(100000),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    note: z.string().trim().max(500).default(''),
  })
  .strict();

export const supplyRequestSchema = supplyRequestInputSchema.omit({ idempotencyKey: true }).extend({
  id: z.string(),
  requestedBy: z.string(),
  status: z.literal('RECEIVED'),
  createdAt: z.string(),
});

export type SupplyRequestInput = z.infer<typeof supplyRequestInputSchema>;
export type SupplyRequest = z.infer<typeof supplyRequestSchema>;
export type SupplyRequestCatalogItem = Readonly<{
  id: string;
  sku: string;
  name: string;
  category: 'MEDICATIONS' | 'SUPPLIES' | 'EQUIPMENT';
}>;
