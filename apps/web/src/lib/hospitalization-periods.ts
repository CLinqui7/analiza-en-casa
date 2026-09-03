import type { Hospitalization } from '@analiza/contracts';

export type AdmissionPeriod = NonNullable<Hospitalization['admissionPeriods']>[number];

export function normalizeAdmissionPeriods(periods: AdmissionPeriod[]): AdmissionPeriod[] {
  const normalized = periods
    .filter((period) => period.admissionDate)
    .map((period) => ({
      admissionDate: period.admissionDate,
      dischargeDate: period.dischargeDate || undefined,
    }));
  const keys = new Set<string>();
  for (const period of normalized) {
    if (period.dischargeDate && period.dischargeDate < period.admissionDate) {
      throw new Error('La fecha de egreso debe ser igual o posterior a la fecha de ingreso.');
    }
    const key = `${period.admissionDate}:${period.dischargeDate ?? ''}`;
    if (keys.has(key)) throw new Error('No repita el mismo período de ingreso y egreso.');
    keys.add(key);
  }
  return normalized.sort((left, right) => left.admissionDate.localeCompare(right.admissionDate));
}

export function admissionPeriodsFor(hospitalization: Hospitalization): AdmissionPeriod[] {
  return hospitalization.admissionPeriods?.length
    ? hospitalization.admissionPeriods
    : [{ admissionDate: hospitalization.startDate, dischargeDate: hospitalization.endDate }];
}
