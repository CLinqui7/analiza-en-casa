import { hospitalizationSchema, type Hospitalization } from '@analiza/contracts';
import { MongoInputError, rejectBrowserAuthority } from './patients';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MongoInputError();
  return value as Record<string, unknown>;
}

function parseHospitalization(value: unknown): Hospitalization {
  try {
    return hospitalizationSchema.strict().parse(value);
  } catch {
    throw new MongoInputError('La hospitalización contiene datos no válidos.');
  }
}

export function parseHospitalizationCreate(input: unknown): Hospitalization {
  rejectBrowserAuthority(input);
  const body = object(input);
  if (Object.keys(body).some((key) => key !== 'hospitalization')) throw new MongoInputError();
  return parseHospitalization(body.hospitalization);
}

export function parseHospitalizationReplace(input: unknown): {
  hospitalization: Hospitalization;
  expectedVersion: number;
} {
  rejectBrowserAuthority(input);
  const body = object(input);
  if (Object.keys(body).some((key) => key !== 'hospitalization' && key !== 'expectedVersion')) {
    throw new MongoInputError();
  }
  if (!Number.isInteger(body.expectedVersion) || (body.expectedVersion as number) < 1) {
    throw new MongoInputError('La versión esperada es obligatoria.');
  }
  return {
    hospitalization: parseHospitalization(body.hospitalization),
    expectedVersion: body.expectedVersion as number,
  };
}
