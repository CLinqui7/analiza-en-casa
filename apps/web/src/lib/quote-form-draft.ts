import { quoteDiscountSchema, quoteItemSchema, quoteSchema } from '@analiza/contracts';
import { z } from 'zod';

/** Incomplete quote forms are private working data, not quote versions. */
export const quoteFormDraftSchema = z.object({
  caseId: z.string().max(200),
  patientId: z.string().max(200),
  patientQuery: z.string().max(1000),
  referralQuery: z.string().max(1000),
  summary: z.string().max(4000),
  careSetting: quoteSchema.shape.careSetting,
  comments: z.string().max(8000),
  paymentCondition: z.string().max(160),
  invoiceDate: z.string().max(32),
  invoiceDocumentType: quoteSchema.shape.invoiceDocumentType,
  discountGroup: z.string().max(200),
  referralLabel: z.string().max(1000),
  referralSelections: z.array(z.string().max(1000)).max(30),
  items: z.array(quoteItemSchema).max(300),
  discount: quoteDiscountSchema.optional(),
  insurerAmount: z.number().nonnegative(),
  revisionReason: z.string().max(4000),
});
