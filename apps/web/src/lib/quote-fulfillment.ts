import { z } from 'zod';
import { supplyRequestProduct } from './supply-requests';
export const assignSupplySchema = z
  .object({
    idempotencyKey: z.uuid(),
    requestId: z.string().min(1),
    quoteId: z.string().min(1),
    expectedRecordVersion: z.number().int().positive(),
    expectedUnitPrice: z.number().finite().nonnegative(),
    expectedProducts: z
      .array(
        z
          .object({
            id: z.string().min(1),
            unitPrice: z.number().finite().nonnegative().nullable(),
          })
          .strict(),
      )
      .max(50)
      .optional(),
    additions: z
      .array(
        z
          .object({
            product: supplyRequestProduct,
            expectedPrice: z.number().finite().nonnegative().nullable(),
          })
          .strict(),
      )
      .max(50)
      .optional(),
    // MANUAL remains readable only for retries of assignments saved before Nov18.
    priceSource: z.enum(['CATALOG', 'MANUAL', 'PENDING']).optional(),
    approvedExtension: z
      .object({ decisionId: z.uuid(), reason: z.string().trim().min(5).max(1000) })
      .strict()
      .optional(),
  })
  .strict();
export const deliverOrderSchema = z
  .object({
    idempotencyKey: z.uuid(),
    quoteId: z.string().min(1),
    lineId: z.string().min(1),
    nursingResourceId: z.string().min(1),
    quantity: z.number().finite().positive(),
  })
  .strict();
export type PrequoteProduct = {
  pricePending?: boolean;
  id: string;
  itemName: string;
  itemCategory: string;
  catalogItemId: string | null;
  quantity: number;
  unitPrice: number | null;
  assignedUnitPrice: number | null;
  itemAvailable: boolean;
  assignmentPresent: boolean;
};
export type PrequoteEntry = {
  pricePending?: boolean;
  products?: PrequoteProduct[];
  id: string;
  createdAt: string;
  patientId: string;
  patientName: string;
  itemName: string;
  itemCategory?: string;
  quantity: number;
  note: string;
  priority: string;
  requestedBy: string;
  unitPrice: number | null;
  assignedUnitPrice?: number | null;
  itemAvailable: boolean;
  assignedQuoteId: string | null;
  currentQuoteId: string | null;
  assignmentPresent: boolean;
  rootQuoteId: string | null;
};
export type PrequoteChoice = {
  id: string;
  rootId: string;
  patientId: string;
  status: 'DRAFT' | 'SENT' | 'APPROVED';
  approvalDecisionId?: string | null;
  total: number;
  recordVersion: number;
};
export type PrequoteInbox = {
  entries: PrequoteEntry[];
  quotes: PrequoteChoice[];
  page: number;
  total: number;
};
export type ReceivedOrderEntry = {
  quoteId: string;
  rootId: string;
  createdAt: string;
  patientName: string;
  lineId: string;
  patientDocument: string;
  itemName: string;
  quantity: number;
  delivered: number;
  status: string;
  deliveries: { id: string; nurseName: string; quantity: number; createdAt: string }[];
};
export type ReceivedOrderInbox = {
  entries: ReceivedOrderEntry[];
  nurses: { id: string; name: string }[];
  page: number;
  total: number;
};
