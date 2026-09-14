import type { Hospitalization, Patient, Shift, VitalReading } from '@analiza/contracts';

export type DashboardDateRange = {
  from: string;
  to: string;
};

export type DashboardAction = {
  id: string;
  kind: 'SHIFT' | 'CASE';
  patientName: string;
  detail: string;
  occursAt: string;
  href: string;
};

function datePart(value: string) {
  return value.slice(0, 10);
}

export function isInDashboardDateRange(value: string, range: DashboardDateRange) {
  const day = datePart(value);
  return (!range.from || day >= range.from) && (!range.to || day <= range.to);
}

export function filterDashboardReadings(
  readings: readonly VitalReading[],
  range: DashboardDateRange,
) {
  return readings
    .filter((reading) => isInDashboardDateRange(reading.measuredAt, range))
    .slice()
    .sort((left, right) => right.measuredAt.localeCompare(left.measuredAt));
}

export function getDashboardActions(
  shifts: readonly Shift[],
  hospitalizations: readonly Hospitalization[],
  patients: readonly Patient[],
  range: DashboardDateRange,
) {
  const patientName = (patientId: string) =>
    patients.find((patient) => patient.id === patientId)?.fullName ?? 'Paciente no disponible';
  const scheduledShifts: DashboardAction[] = shifts
    .filter((shift) => shift.status === 'SCHEDULED')
    .filter((shift) => isInDashboardDateRange(shift.startsAt, range))
    .map((shift) => ({
      id: `shift-${shift.id}`,
      kind: 'SHIFT',
      patientName: shift.patientId ? patientName(shift.patientId) : 'Paciente sin asignar',
      detail: shift.note?.trim() || 'Turno programado',
      occursAt: shift.startsAt,
      href: '/agenda',
    }));
  const caseActions: DashboardAction[] = hospitalizations
    .filter((hospitalization) => hospitalization.status !== 'CLOSED')
    .filter((hospitalization) => Boolean(hospitalization.nextAction?.trim()))
    .filter((hospitalization) => isInDashboardDateRange(hospitalization.startDate, range))
    .map((hospitalization) => ({
      id: `case-${hospitalization.id}`,
      kind: 'CASE',
      patientName: patientName(hospitalization.patientId),
      detail: hospitalization.nextAction!.trim(),
      occursAt: hospitalization.startDate,
      href: `/hospitalizations/${hospitalization.id}`,
    }));
  return [...scheduledShifts, ...caseActions].sort((left, right) =>
    left.occursAt.localeCompare(right.occursAt),
  );
}
