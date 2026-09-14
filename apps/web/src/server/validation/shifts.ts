import { shiftSchema, type Shift } from '@analiza/contracts';
import { MongoInputError, rejectBrowserAuthority } from './patients';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new MongoInputError();
  return value as Record<string, unknown>;
}

function parseShift(value: unknown): Shift {
  try {
    const shift = shiftSchema.strict().parse(value);
    const startsAt = new Date(shift.startsAt);
    const endsAt = new Date(shift.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new MongoInputError('El intervalo del turno no es válido.');
    }
    return shift;
  } catch (error) {
    if (error instanceof MongoInputError) throw error;
    throw new MongoInputError('El turno contiene datos no válidos.');
  }
}

export function parseShiftSeriesCommand(input: unknown): {
  shifts: Shift[];
  idempotencyKey: string;
} {
  rejectBrowserAuthority(input);
  const body = object(input);
  if (Object.keys(body).some((key) => key !== 'shifts' && key !== 'idempotencyKey')) {
    throw new MongoInputError();
  }
  if (
    !Array.isArray(body.shifts) ||
    !body.shifts.length ||
    typeof body.idempotencyKey !== 'string' ||
    !body.idempotencyKey.trim()
  ) {
    throw new MongoInputError('La serie y su clave de idempotencia son obligatorias.');
  }
  const shifts = body.shifts.map(parseShift);
  if (new Set(shifts.map((shift) => shift.id)).size !== shifts.length) {
    throw new MongoInputError('La serie contiene identificadores repetidos.');
  }
  return { shifts, idempotencyKey: body.idempotencyKey };
}

export function overlaps(
  a: Pick<Shift, 'startsAt' | 'endsAt'>,
  b: Pick<Shift, 'startsAt' | 'endsAt'>,
) {
  return new Date(a.startsAt) < new Date(b.endsAt) && new Date(a.endsAt) > new Date(b.startsAt);
}

export function assertNoSeriesCollisions(shifts: readonly Shift[]) {
  for (let index = 0; index < shifts.length; index += 1) {
    const current = shifts[index];
    if (current.status === 'CANCELLED') continue;
    for (const candidate of shifts.slice(index + 1)) {
      if (
        candidate.status !== 'CANCELLED' &&
        candidate.resourceId === current.resourceId &&
        overlaps(current, candidate)
      ) {
        throw new MongoInputError('La serie contiene turnos que colisionan para el mismo recurso.');
      }
    }
  }
}
