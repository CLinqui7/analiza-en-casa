import type { InventoryMovement, NurseHourEntry, Patient, VitalReading } from '@analiza/contracts';

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
