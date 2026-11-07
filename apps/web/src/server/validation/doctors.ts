import { doctorSchema, type Doctor } from '@analiza/contracts';
import { MongoInputError, rejectBrowserAuthority } from './patients';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MongoInputError();
  return value as Record<string, unknown>;
}

function parseDoctor(value: unknown): Doctor {
  try {
    const doctor = doctorSchema.strict().parse(value);
    // Bytes and their metadata are accepted only by /api/files after the doctor exists.
    // A browser must not turn a filename-only selection into a completed private attachment.
    if (doctor.attachments.length) {
      throw new MongoInputError(
        'Los archivos se cargan de forma privada después de guardar el médico.',
      );
    }
    if (!doctor.landlinePhone?.trim()) {
      throw new MongoInputError('Ingrese el teléfono fijo del médico.');
    }
    return doctor;
  } catch (error) {
    if (error instanceof MongoInputError) throw error;
    throw new MongoInputError('El médico contiene datos no válidos.');
  }
}

export function parseDoctorCreate(input: unknown): Doctor {
  rejectBrowserAuthority(input);
  const body = object(input);
  if (Object.keys(body).some((key) => key !== 'doctor')) throw new MongoInputError();
  const doctor = parseDoctor(body.doctor);
  if (!doctor.referralCategory)
    throw new MongoInputError('Seleccione si el médico es nuevo o recurrente.');
  return doctor;
}

export function parseDoctorReplace(input: unknown): { doctor: Doctor; expectedVersion: number } {
  rejectBrowserAuthority(input);
  const body = object(input);
  if (Object.keys(body).some((key) => key !== 'doctor' && key !== 'expectedVersion')) {
    throw new MongoInputError();
  }
  if (!Number.isInteger(body.expectedVersion) || (body.expectedVersion as number) < 1) {
    throw new MongoInputError('La versión esperada es obligatoria.');
  }
  const doctor = parseDoctor(body.doctor);
  if (!doctor.referralCategory)
    throw new MongoInputError('Seleccione si el médico es nuevo o recurrente.');
  return { doctor, expectedVersion: body.expectedVersion as number };
}
