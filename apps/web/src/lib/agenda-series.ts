import type { Shift } from '@analiza/contracts';

export type ShiftPreset = 'SIX_HOURS' | 'EIGHT_HOURS';

export type PresetEnd = { endTime: string; endDayOffset: 0 | 1 };

function atLocalTime(date: string, time: string) {
  return new Date(`${date}T${time}`);
}

export function endForPreset(date: string, startTime: string, preset: ShiftPreset): PresetEnd {
  const startsAt = atLocalTime(date, startTime);
  const startDay = startsAt.getDate();
  startsAt.setHours(startsAt.getHours() + (preset === 'SIX_HOURS' ? 6 : 8));
  return {
    endTime: startsAt.toTimeString().slice(0, 5),
    endDayOffset: startsAt.getDate() === startDay ? 0 : 1,
  };
}

export function endTimeForPreset(date: string, startTime: string, preset: ShiftPreset) {
  return endForPreset(date, startTime, preset).endTime;
}

export function buildShiftSeries(input: {
  dates: string[];
  resourceId: string;
  patientId?: string;
  startTime: string;
  endTime: string;
  endDayOffset?: 0 | 1;
  status: Shift['status'];
  note?: string;
  existing: Shift[];
  idFor: (date: string) => string;
}): Shift[] {
  const uniqueDates = [...new Set(input.dates.filter(Boolean))].sort();
  if (!uniqueDates.length) throw new Error('Seleccione al menos una fecha.');
  if (uniqueDates.length !== input.dates.filter(Boolean).length)
    throw new Error('No repita una fecha de turno.');
  return uniqueDates.map((date) => {
    const startsAt = atLocalTime(date, input.startTime);
    const endsAt = atLocalTime(date, input.endTime);
    endsAt.setDate(endsAt.getDate() + (input.endDayOffset ?? 0));
    if (endsAt <= startsAt) throw new Error('El fin debe ser posterior al inicio.');
    const overlaps = input.existing.some(
      (shift) =>
        shift.resourceId === input.resourceId &&
        shift.status !== 'CANCELLED' &&
        startsAt < new Date(shift.endsAt) &&
        endsAt > new Date(shift.startsAt),
    );
    if (overlaps) throw new Error(`El recurso ya tiene un turno que colisiona el ${date}.`);
    return {
      id: input.idFor(date),
      resourceId: input.resourceId,
      patientId: input.patientId || undefined,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status: input.status,
      note: input.note || undefined,
    };
  });
}
