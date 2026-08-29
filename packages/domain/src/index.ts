import type { Hospitalization, InventoryMovement, NurseHourEntry, Patient, Payment, Quote, QuoteDiscount, QuoteItem, QuoteItemCategory, VitalReading } from '@analiza/contracts';

export type DocumentRule = {
  label: string;
  mask?: string;
  pattern?: RegExp;
  help: string;
};

// These are demo configuration values, not a claim of official document validity.
export const documentRules: Record<Patient['documentType'], DocumentRule> = {
  DUI: {
    label: 'DUI',
    mask: '########-#',
    pattern: /^\d{8}-\d$/,
    help: 'Formato demo configurado: 8 dígitos, guion y 1 dígito.',
  },
  PASSPORT: {
    label: 'Pasaporte',
    help: 'Formato oficial pendiente de configuración por el cliente.',
  },
  OTHER: {
    label: 'Otro documento',
    help: 'Indique el identificador tal como aparece en el documento.',
  },
};

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeDocument(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

export function maskDui(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  return digits.length > 8 ? `${digits.slice(0, 8)}-${digits.slice(8)}` : digits;
}

export function validateDocument(
  documentType: Patient['documentType'],
  value: string,
): string | undefined {
  const rule = documentRules[documentType];
  if (!value.trim()) return 'El número de documento es obligatorio.';
  if (rule.pattern && !rule.pattern.test(value)) {
    return `El documento no coincide con la configuración demo de ${rule.label}.`;
  }
  return undefined;
}

export function findDuplicatePatient(
  patients: readonly Patient[],
  candidate: Pick<Patient, 'documentType' | 'documentId'>,
): Patient | undefined {
  const document = normalizeDocument(candidate.documentId);
  return patients.find(
    (patient) =>
      patient.documentType === candidate.documentType &&
      normalizeDocument(patient.documentId) === document,
  );
}

export function searchPatients(patients: readonly Patient[], query: string): Patient[] {
  const needle = normalizeText(query);
  const documentNeedle = normalizeDocument(query);
  const phoneNeedle = normalizePhone(query);
  if (!needle) return [...patients];
  return patients.filter((patient) =>
    normalizeText(patient.fullName).includes(needle) ||
    normalizeText(patient.insurer ?? '').includes(needle) ||
    normalizeDocument(patient.documentId).includes(documentNeedle) ||
    (phoneNeedle.length > 0 && normalizePhone(patient.phone ?? '').includes(phoneNeedle)),
  );
}

/** Search the fields the legacy hospitalization register exposes, using the
 * same accent-, case-, whitespace-, and document-separator-insensitive rules
 * as patient lookup. */
export function searchHospitalizations(
  hospitalizations: readonly Hospitalization[],
  patients: readonly Patient[],
  query: string,
): Hospitalization[] {
  const needle = normalizeText(query);
  const documentNeedle = normalizeDocument(query);
  if (!needle) return [...hospitalizations];
  return hospitalizations.filter((hospitalization) => {
    const patient = patients.find((candidate) => candidate.id === hospitalization.patientId);
    return [
      normalizeText(hospitalization.id),
      normalizeText(hospitalization.status),
      normalizeText(hospitalization.accountType),
      normalizeText(patient?.fullName ?? ''),
      normalizeText(patient?.company ?? ''),
    ].some((value) => value.includes(needle))
      || normalizeDocument(hospitalization.id).includes(documentNeedle)
      || normalizeDocument(patient?.documentId ?? '').includes(documentNeedle);
  });
}

export const quoteCategories: ReadonlyArray<{ value: QuoteItemCategory; label: string }> = [
  { value: 'SERVICES', label: 'Servicios' },
  { value: 'STUDIES', label: 'Estudios diagnósticos' },
  { value: 'MEDICATIONS', label: 'Medicamentos' },
  { value: 'SUPPLIES', label: 'Insumos' },
  { value: 'EQUIPMENT', label: 'Equipos' },
  { value: 'FEES', label: 'Honorarios' },
  { value: 'EXTRAS', label: 'Extras' },
];

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function quoteItemGross(item: Pick<QuoteItem, 'quantity' | 'unitPrice'>): number {
  return roundMoney(item.quantity * item.unitPrice);
}

export function quoteItemSubtotal(item: QuoteItem): number {
  return roundMoney(quoteItemGross(item) - item.discountAmount);
}

export function validateQuoteItem(item: QuoteItem): string | undefined {
  if (!item.name.trim()) return 'El concepto es obligatorio.';
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) return 'La cantidad debe ser mayor que cero.';
  if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) return 'El precio manual no puede ser negativo.';
  if (!Number.isFinite(item.discountAmount) || item.discountAmount < 0) return 'El descuento manual no puede ser negativo.';
  if (item.discountAmount > quoteItemGross(item)) return 'El descuento manual no puede superar el importe de la línea.';
  return undefined;
}

export type QuoteTotals = {
  subtotal: number;
  itemDiscountAmount: number;
  generalDiscountAmount: number;
  discountAmount: number;
  total: number;
  insurerAmount: number;
  patientAmount: number;
};

function generalQuoteDiscount(items: readonly QuoteItem[], netBeforeGeneralDiscount: number, discount?: QuoteDiscount): number {
  if (!discount) return 0;
  if (discount.type === 'FIXED') return Math.min(netBeforeGeneralDiscount, roundMoney(discount.value ?? 0));
  if (discount.type === 'PERCENT') return Math.min(netBeforeGeneralDiscount, roundMoney(netBeforeGeneralDiscount * (discount.value ?? 0) / 100));
  return roundMoney(items.reduce((sum, item) => {
    const percentage = discount.categories?.[item.category] ?? 0;
    return sum + quoteItemSubtotal(item) * percentage / 100;
  }, 0));
}

/** Pure quote calculation. All prices, discounts, and insurer responsibility
 * are explicit caller-provided values; no taxes, prices, or coverage are inferred. */
export function calculateQuoteTotals(
  items: readonly QuoteItem[],
  discount?: QuoteDiscount,
  insurerAmount = 0,
): QuoteTotals {
  for (const item of items) {
    const error = validateQuoteItem(item);
    if (error) throw new Error(error);
  }
  if (!Number.isFinite(insurerAmount) || insurerAmount < 0) throw new Error('El importe explícito de aseguradora no puede ser negativo.');
  const subtotal = roundMoney(items.reduce((sum, item) => sum + quoteItemGross(item), 0));
  const itemDiscountAmount = roundMoney(items.reduce((sum, item) => sum + item.discountAmount, 0));
  const netBeforeGeneralDiscount = roundMoney(subtotal - itemDiscountAmount);
  const generalDiscountAmount = generalQuoteDiscount(items, netBeforeGeneralDiscount, discount);
  const total = roundMoney(netBeforeGeneralDiscount - generalDiscountAmount);
  const explicitInsurerAmount = roundMoney(insurerAmount);
  if (explicitInsurerAmount > total) throw new Error('El importe explícito de aseguradora no puede superar el total.');
  return {
    subtotal,
    itemDiscountAmount,
    generalDiscountAmount,
    discountAmount: roundMoney(itemDiscountAmount + generalDiscountAmount),
    total,
    insurerAmount: explicitInsurerAmount,
    patientAmount: roundMoney(total - explicitInsurerAmount),
  };
}

export function calculateQuoteBalance(quote: Pick<Quote, 'id' | 'patientAmount'>, payments: readonly Payment[]) {
  const paid = roundMoney(payments
    .filter((payment) => payment.quoteId === quote.id && payment.status === 'APPLIED')
    .reduce((sum, payment) => sum + payment.amount, 0));
  return { paid, balance: roundMoney(quote.patientAmount - paid) };
}

export function searchQuotes(quotes: readonly Quote[], patients: readonly Patient[], query: string): Quote[] {
  const needle = normalizeText(query);
  const normalizedNeedle = normalizeDocument(query);
  if (!needle) return [...quotes];
  return quotes.filter((quote) => {
    const patient = patients.find((candidate) => candidate.id === quote.patientId);
    return [quote.id, quote.caseId, quote.status, patient?.fullName ?? '']
      .some((value) => normalizeText(value).includes(needle))
      || normalizeDocument(quote.id).includes(normalizedNeedle)
      || normalizeDocument(quote.caseId).includes(normalizedNeedle);
  });
}

export function canEditQuote(quote: Pick<Quote, 'status' | 'immutable'>): boolean {
  return quote.status === 'DRAFT' && quote.immutable !== true;
}

export function createQuoteRevision(
  source: Quote,
  id: string,
  revisionReason: string,
  createdAt = new Date().toISOString(),
): Quote {
  const reason = revisionReason.trim();
  if (!reason) throw new Error('El motivo de revisión es obligatorio.');
  const rootQuoteId = source.rootQuoteId ?? source.originalQuoteId ?? source.id;
  return {
    ...source,
    id,
    version: source.version + 1,
    status: 'DRAFT',
    immutable: false,
    createdAt,
    sentAt: undefined,
    originalQuoteId: rootQuoteId,
    rootQuoteId,
    revisionReason: reason,
    items: source.items.map((item) => ({ ...item })),
    discount: source.discount ? { ...source.discount, categories: source.discount.categories ? { ...source.discount.categories } : undefined } : undefined,
  };
}

export type VitalMetric = {
  key: keyof Omit<VitalReading, 'id' | 'patientId' | 'measuredAt' | 'source' | 'note'>;
  label: string;
  unit: string;
};

export const vitalMetrics: readonly VitalMetric[] = [
  { key: 'heartRate', label: 'FC', unit: 'lpm' },
  { key: 'respiratoryRate', label: 'FR', unit: 'rpm' },
  { key: 'systolic', label: 'Sistólica', unit: 'mmHg' },
  { key: 'diastolic', label: 'Diastólica', unit: 'mmHg' },
  { key: 'pulse', label: 'Pulso', unit: 'lpm' },
  { key: 'temperature', label: 'Temperatura', unit: '°C' },
  { key: 'oxygenSaturation', label: 'SpO₂', unit: '%' },
  { key: 'pain', label: 'Dolor', unit: 'escala' },
  { key: 'glucose', label: 'Glicemia', unit: 'mg/dL' },
];

export function measuredVitalMetrics(reading: VitalReading) {
  return vitalMetrics.flatMap((metric) => {
    const value = reading[metric.key];
    return value === undefined ? [] : [{ ...metric, value }];
  });
}

export type KardexRow = InventoryMovement & { delta: number; balance: number };

export function movementDelta(movement: InventoryMovement): number {
  if (movement.kind === 'ENTRY' || movement.kind === 'RETURN') return movement.quantity;
  if (movement.kind === 'EXIT' || movement.kind === 'TRANSFER') return -movement.quantity;
  return movement.adjustmentDirection === 'OUT' ? -movement.quantity : movement.quantity;
}

export function deriveKardex(movements: readonly InventoryMovement[], itemId: string): KardexRow[] {
  let balance = 0;
  return movements
    .filter((movement) => movement.itemId === itemId)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((movement) => {
      const delta = movementDelta(movement);
      balance += delta;
      return { ...movement, delta, balance };
    });
}

export function currentInventoryBalance(
  movements: readonly InventoryMovement[],
  itemId: string,
): number {
  return deriveKardex(movements, itemId).at(-1)?.balance ?? 0;
}

export function canRecordMovement(
  movements: readonly InventoryMovement[],
  candidate: InventoryMovement,
): boolean {
  const current = currentInventoryBalance(movements, candidate.itemId);
  return current + movementDelta(candidate) >= 0;
}

export function nurseHoursTotal(entries: readonly NurseHourEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.hours, 0);
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows
    .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(','))
    .join('\r\n');
}
