import { patientSchema, type Patient } from '@analiza/contracts';
import type { Role } from '@/lib/permissions';

export type ServerActor = Readonly<{ userId: string; organizationId: string; role: Role }>;

export class MongoAccessError extends Error {
  constructor(message = 'No tiene autorización para esta operación.') {
    super(message);
    this.name = 'MongoAccessError';
  }
}

export class MongoConflictError extends Error {
  constructor() {
    super('El registro cambió antes de guardar. Recargue y vuelva a intentar.');
    this.name = 'MongoConflictError';
  }
}

export class MongoDuplicatePatientError extends Error {
  constructor() {
    super('Ya existe un paciente con ese documento en esta organización.');
    this.name = 'MongoDuplicatePatientError';
  }
}

export class MongoInputError extends Error {
  constructor(message = 'La solicitud contiene campos no permitidos.') {
    super(message);
    this.name = 'MongoInputError';
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MongoInputError();
  return value as Record<string, unknown>;
}

export function rejectBrowserAuthority(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(rejectBrowserAuthority);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'organizationId' || key === 'actor') {
      throw new MongoInputError('La organización se resuelve en el servidor.');
    }
    if (key.startsWith('$'))
      throw new MongoInputError('Los operadores de base de datos no están permitidos.');
    rejectBrowserAuthority(child);
  }
}

function parsePatientDto(value: unknown): Patient {
  try {
    return patientSchema.strict().parse(value);
  } catch {
    throw new MongoInputError('El paciente contiene datos no válidos.');
  }
}

export function parsePatientCreate(input: unknown): Patient {
  rejectBrowserAuthority(input);
  const body = object(input);
  if ('role' in body) throw new MongoInputError('El rol se resuelve en el servidor.');
  if (Object.keys(body).some((key) => key !== 'patient')) throw new MongoInputError();
  return parsePatientDto(body.patient);
}

export function parsePatientReplace(input: unknown): { patient: Patient; expectedVersion: number } {
  rejectBrowserAuthority(input);
  const body = object(input);
  if ('role' in body) throw new MongoInputError('El rol se resuelve en el servidor.');
  if (Object.keys(body).some((key) => key !== 'patient' && key !== 'expectedVersion')) {
    throw new MongoInputError();
  }
  if (!Number.isInteger(body.expectedVersion) || (body.expectedVersion as number) < 1) {
    throw new MongoInputError('La versión esperada es obligatoria.');
  }
  return {
    patient: parsePatientDto(body.patient),
    expectedVersion: body.expectedVersion as number,
  };
}
