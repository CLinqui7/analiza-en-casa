import { z } from 'zod';
import { quoteMedicalFeeOptions } from './quote-medical-fees';

export const requestCategoryLabels = {
  MEDICATIONS: 'Medicamentos',
  SUPPLIES: 'Insumos',
  EQUIPMENT: 'Equipos',
  SERVICES: 'Servicios',
  LABORATORY: 'Laboratorios',
  PHYSIOTHERAPY: 'Fisioterapia',
  IMAGING: 'Imágenes',
  FEES: 'Honorarios',
} as const;

export const requestQuoteCategories = {
  MEDICATIONS: 'MEDICATIONS',
  SUPPLIES: 'SUPPLIES',
  EQUIPMENT: 'EQUIPMENT',
  SERVICES: 'SERVICES',
  LABORATORY: 'STUDIES',
  PHYSIOTHERAPY: 'EXTRAS',
  IMAGING: 'IMAGING',
} as const;
export const feeServices = ['Visita', 'Seguimiento'] as const;
const quantity = z.number().int().min(1).max(100000);
const catalogProduct = z
  .object({ catalogItemId: z.string().trim().min(1).max(200), quantity })
  .strict();
const feeProduct = z
  .object({
    feeService: z.enum(feeServices),
    feeAmount: z.number().refine((n) => (quoteMedicalFeeOptions as readonly number[]).includes(n)),
    quantity,
  })
  .strict();
export const supplyRequestProduct = z.union([catalogProduct, feeProduct]);
export type RequestProduct = z.infer<typeof supplyRequestProduct>;
export const productKey = (line: RequestProduct) =>
  'catalogItemId' in line ? 'catalog:' + line.catalogItemId : 'fee:' + line.feeService;
export const supplyRequestProducts = z
  .array(supplyRequestProduct)
  .min(1)
  .max(50)
  .refine(
    (lines) => new Set(lines.map(productKey)).size === lines.length,
    'Cada concepto debe aparecer una sola vez.',
  );
const header = z
  .object({
    idempotencyKey: z.uuid(),
    patientId: z.string().min(1),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    note: z.string().trim().max(500).default(''),
  })
  .strict();
const legacyInput = header.extend(catalogProduct.shape);
export const supplyRequestInputSchema = z.union([
  header.extend({ products: supplyRequestProducts }),
  legacyInput.transform(({ catalogItemId, quantity, ...rest }) => ({
    ...rest,
    products: [{ catalogItemId, quantity }],
  })),
]);
export const supplyRequestSchema = header.omit({ idempotencyKey: true }).extend({
  id: z.string(),
  catalogItemId: z.string().nullable(),
  quantity,
  products: z
    .array(
      z.union([catalogProduct.extend({ id: z.string() }), feeProduct.extend({ id: z.string() })]),
    )
    .optional(),
  requestedBy: z.string(),
  status: z.enum(['RECEIVED', 'ASSIGNED', 'REMOVED']),
  assignedQuoteId: z.string().optional(),
  createdAt: z.string(),
});
export type SupplyRequestInput = z.infer<typeof supplyRequestInputSchema>;
export type SupplyRequest = z.infer<typeof supplyRequestSchema>;
export type SupplyRequestCatalogItem = Readonly<{
  id: string;
  sku: string;
  name: string;
  category: keyof typeof requestQuoteCategories;
  salePriceExcludingTax?: number | null;
}>;
