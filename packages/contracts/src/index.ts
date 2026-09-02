import { z } from 'zod';

export const patientDocumentTypeSchema = z.enum(['DUI', 'PASSPORT', 'RESIDENT_CARD', 'OTHER']);

export const patientInsuranceSchema = z.object({
  status: z.enum(['REGULAR', 'INSURED']).default('REGULAR'),
  insurer: z.string().trim().optional(),
  isPolicyHolder: z.boolean().optional(),
  policyNumber: z.string().trim().optional(),
  certificateOrUnit: z.string().trim().optional(),
  holderDocumentId: z.string().trim().optional(),
  holderFullName: z.string().trim().optional(),
  holderBirthDate: z.string().optional(),
  effectiveDate: z.string().optional(),
});

export const patientContactSchema = z.object({
  id: z.string(),
  fullName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  relationship: z.string().trim().optional(),
  role: z.string().trim().optional(),
  country: z.string().trim().optional(),
  documentType: patientDocumentTypeSchema.optional(),
  documentId: z.string().trim().optional(),
  isPrimary: z.boolean().default(false),
});

export const patientAddressSchema = z.object({
  line: z.string().trim().optional(),
  comments: z.string().trim().optional(),
  coordinates: z.string().trim().optional(),
  locationUrl: z.string().trim().optional(),
});

export const patientSchema = z.object({
  id: z.string(),
  fullName: z.string().trim().min(1),
  documentType: patientDocumentTypeSchema,
  documentId: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  insurer: z.string().trim().optional(),
  birthDate: z.string().optional(),
  sex: z.enum(['M', 'F']).optional(),
  company: z.string().trim().optional(),
  homePhone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  retired: z.boolean().optional(),
  bloodType: z.enum(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']).optional(),
  civilStatus: z.string().trim().optional(),
  nationality: z.string().trim().optional(),
  occupation: z.string().trim().optional(),
  triageStatus: z.string().trim().optional(),
  notifications: z.object({ botmakerConsent: z.boolean().default(true), lastStatus: z.string().trim().optional() }).optional(),
  insurance: patientInsuranceSchema.optional(),
  contacts: z.array(patientContactSchema).optional(),
  address: patientAddressSchema.optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
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
  endDate: z.string().optional(),
  status: z.enum(['ACTIVE', 'PENDING_CLOSE', 'CLOSED']),
  accountType: z.string().trim().min(1),
  insurer: z.string().trim().optional(),
  manager: z.string().trim().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  diagnosisSummary: z.string().trim().optional(),
  nextAction: z.string().trim().optional(),
  devices: z.array(z.string().trim().min(1)).optional(),
});

export const quoteItemCategorySchema = z.enum([
  'SERVICES',
  'STUDIES',
  'MEDICATIONS',
  'SUPPLIES',
  'EQUIPMENT',
  'FEES',
  'EXTRAS',
]);

export const quoteItemSchema = z.object({
  id: z.string(),
  category: quoteItemCategorySchema,
  name: z.string().trim().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discountAmount: z.number().nonnegative().default(0),
});

export const quoteDiscountSchema = z.object({
  type: z.enum(['PERCENT', 'FIXED', 'CATEGORY_PERCENTAGES']),
  value: z.number().nonnegative().optional(),
  categories: z.record(quoteItemCategorySchema, z.number().min(0).max(100)).optional(),
});

export const quoteSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  patientId: z.string(),
  version: z.number().int().positive(),
  status: z.enum(['DRAFT', 'SENT']),
  summary: z.string().trim().min(1),
  /** Administrative invoice fields observed in CH03.  They do not alter totals. */
  invoiceDate: z.string().optional(),
  discountGroup: z.string().trim().optional(),
  referralLabel: z.string().trim().optional(),
  giftCardCode: z.string().trim().optional(),
  comments: z.string().trim().optional(),
  items: z.array(quoteItemSchema).default([]),
  discount: quoteDiscountSchema.optional(),
  subtotal: z.number().nonnegative().default(0),
  discountAmount: z.number().nonnegative().default(0),
  total: z.number().nonnegative().default(0),
  insurerAmount: z.number().nonnegative().default(0),
  patientAmount: z.number().nonnegative().default(0),
  immutable: z.boolean().default(false),
  createdAt: z.string(),
  sentAt: z.string().optional(),
  originalQuoteId: z.string().optional(),
  rootQuoteId: z.string().optional(),
  revisionReason: z.string().trim().optional(),
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

/** Statuses displayed by the legacy preauthorization board. They describe an
 * observed administrative fact; this enum intentionally does not encode a
 * transition policy. */
export const insuranceRequestStatusSchema = z.enum([
  'SENT_TO_INSURER',
  'INSURER_REVIEW',
  'INFO_REQUIRED',
  'PARTIALLY_APPROVED',
  'APPROVED',
  'REJECTED',
]);

export const insuranceEventSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  status: insuranceRequestStatusSchema,
  date: z.string(),
  note: z.string().trim().min(1),
});

export const insuranceRequestSchema = z.object({
  id: z.string(),
  quoteId: z.string(),
  patientId: z.string(),
  insurer: z.string().trim().min(1),
  status: insuranceRequestStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  lastNote: z.string().trim().min(1),
});

export type Patient = z.infer<typeof patientSchema>;
export type PatientInsurance = z.infer<typeof patientInsuranceSchema>;
export type PatientContact = z.infer<typeof patientContactSchema>;
export type PatientAddress = z.infer<typeof patientAddressSchema>;
export type VitalReading = z.infer<typeof vitalReadingSchema>;
export type NursingResource = z.infer<typeof nursingResourceSchema>;
export type NurseHourEntry = z.infer<typeof nurseHourEntrySchema>;
export type Shift = z.infer<typeof shiftSchema>;
export type Hospitalization = z.infer<typeof hospitalizationSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type QuoteItem = z.infer<typeof quoteItemSchema>;
export type QuoteItemCategory = z.infer<typeof quoteItemCategorySchema>;
export type QuoteDiscount = z.infer<typeof quoteDiscountSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type ClinicalDocument = z.infer<typeof clinicalDocumentSchema>;
export type CatalogItem = z.infer<typeof catalogItemSchema>;
export type Purchase = z.infer<typeof purchaseSchema>;
export type InventoryMovement = z.infer<typeof inventoryMovementSchema>;
export type InsuranceRequestStatus = z.infer<typeof insuranceRequestStatusSchema>;
export type InsuranceEvent = z.infer<typeof insuranceEventSchema>;
export type InsuranceRequest = z.infer<typeof insuranceRequestSchema>;
