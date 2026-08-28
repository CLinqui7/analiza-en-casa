import { z } from 'zod';

export const patientDocumentTypeSchema = z.enum(['DUI', 'PASSPORT', 'OTHER']);

export const patientSchema = z.object({
  id: z.string(),
  fullName: z.string().trim().min(1),
  documentType: patientDocumentTypeSchema,
  documentId: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  insurer: z.string().trim().optional(),
});

export const vitalReadingSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  caseId: z.string().optional(),
  measuredAt: z.string(),
  source: z.enum(['clinical', 'patient']),
  professional: z.string().trim().optional(),
  heartRate: z.number().int().positive().optional(),
  respiratoryRate: z.number().int().positive().optional(),
  systolic: z.number().int().positive().optional(),
  diastolic: z.number().int().positive().optional(),
  pulse: z.number().int().positive().optional(),
  temperature: z.number().positive().optional(),
  oxygenSaturation: z.number().int().positive().optional(),
  pain: z.number().nonnegative().optional(),
  glucose: z.number().positive().optional(),
  note: z.string().trim().optional(),
});

export const nursingResourceSchema = z.object({
  id: z.string(),
  displayName: z.string().trim().min(1),
  territory: z.string().trim().min(1),
  shift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT']),
  availability: z.enum(['AVAILABLE', 'ASSIGNED', 'OFF_DUTY']),
  capacity: z.number().int().nonnegative(),
  boardRegistrationNumber: z.string().trim().min(1),
});

export const nurseHourEntrySchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  date: z.string(),
  hours: z.number().positive(),
  service: z.string().trim().min(1),
});

export const inventoryMovementSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  createdAt: z.string(),
  kind: z.enum(['ENTRY', 'EXIT', 'TRANSFER', 'RETURN', 'ADJUSTMENT']),
  quantity: z.number().int().positive(),
  adjustmentDirection: z.enum(['IN', 'OUT']).optional(),
  reason: z.string().trim().min(1),
  warehouseId: z.string().trim().optional(),
  reference: z.string().trim().optional(),
  user: z.string().trim().optional(),
});

export const shiftSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  patientId: z.string().optional(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: z.enum(['SCHEDULED', 'CANCELLED', 'COMPLETED']),
  note: z.string().trim().optional(),
});

export const hospitalizationSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  startDate: z.string(),
  status: z.enum(['ACTIVE', 'CLOSED']),
  accountType: z.string().trim().min(1),
  nextAction: z.string().trim().optional(),
});

export const quoteSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  patientId: z.string(),
  version: z.number().int().positive(),
  status: z.enum(['DRAFT', 'SENT']),
  summary: z.string().trim().min(1),
  createdAt: z.string(),
  sentAt: z.string().optional(),
});

export const paymentSchema = z.object({
  id: z.string(),
  quoteId: z.string(),
  amount: z.number().positive(),
  reference: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1),
  status: z.enum(['APPLIED', 'VOIDED']),
  createdAt: z.string(),
  voidReason: z.string().trim().optional(),
});

export const clinicalDocumentSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  patientId: z.string(),
  type: z.enum(['CARE_PLAN', 'CLINICAL_EVOLUTION']),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  author: z.string().trim().min(1),
  status: z.enum(['DRAFT', 'SIGNED']),
  version: z.number().int().positive(),
  createdAt: z.string(),
  signedAt: z.string().optional(),
  correctionOf: z.string().optional(),
  correctionReason: z.string().trim().optional(),
});

export const catalogItemSchema = z.object({
  id: z.string(),
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  createdAt: z.string(),
});

export const purchaseSchema = z.object({
  id: z.string(),
  catalogItemId: z.string(),
  reference: z.string().trim().min(1),
  note: z.string().trim().optional(),
  status: z.literal('DRAFT'),
  createdAt: z.string(),
});

export type Patient = z.infer<typeof patientSchema>;
export type VitalReading = z.infer<typeof vitalReadingSchema>;
export type NursingResource = z.infer<typeof nursingResourceSchema>;
export type NurseHourEntry = z.infer<typeof nurseHourEntrySchema>;
export type Shift = z.infer<typeof shiftSchema>;
export type Hospitalization = z.infer<typeof hospitalizationSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type ClinicalDocument = z.infer<typeof clinicalDocumentSchema>;
export type CatalogItem = z.infer<typeof catalogItemSchema>;
export type Purchase = z.infer<typeof purchaseSchema>;
export type InventoryMovement = z.infer<typeof inventoryMovementSchema>;
