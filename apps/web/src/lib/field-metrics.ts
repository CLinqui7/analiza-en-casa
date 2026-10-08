import type { CommercialAdmission, CommercialVisit, ConfirmedSale } from '@analiza/contracts';

const localDate = (instant: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);

export function periodStarts(now: Date) {
  const day = localDate(now);
  const monday = new Date(`${day}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return { week: monday.toISOString().slice(0, 10), month: `${day.slice(0, 7)}-01` };
}

function inPeriod(day: string, start: string, period: 'WEEK' | 'MONTH') {
  if (period === 'MONTH') return day.slice(0, 7) === start.slice(0, 7);
  const end = new Date(`${start}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  return day >= start && day < end.toISOString().slice(0, 10);
}

export function commercialTotals(
  visits: readonly CommercialVisit[],
  admissions: readonly CommercialAdmission[],
  sales: readonly ConfirmedSale[],
  start: string,
  period: 'WEEK' | 'MONTH',
) {
  const matchingVisits = visits.filter((visit) =>
    inPeriod(localDate(new Date(visit.occurredAt)), start, period),
  );
  // Admissions and sales belong to the period of their own event, even when
  // the referring visit happened in a previous week or month.
  const visitIds = new Set(visits.map((visit) => visit.id));
  const doctors = new Set(
    matchingVisits.filter((visit) => visit.outcome !== 'NO_CONTACT').map((visit) => visit.doctorId),
  );
  const patients = new Set(
    admissions
      .filter((item) => visitIds.has(item.visitId) && inPeriod(item.admittedAt, start, period))
      .map((item) => item.patientId),
  );
  const salesCents = sales
    .filter(
      (sale) =>
        sale.commercialVisitId &&
        visitIds.has(sale.commercialVisitId) &&
        inPeriod(localDate(new Date(sale.occurredAt)), start, period),
    )
    .reduce((sum, sale) => sum + Math.round(sale.amount * 100), 0);
  return { doctors: doctors.size, patients: patients.size, sales: salesCents / 100 };
}

export function companySales(
  sales: readonly ConfirmedSale[],
  start: string,
  period: 'WEEK' | 'MONTH',
) {
  return (
    sales
      .filter((sale) => inPeriod(localDate(new Date(sale.occurredAt)), start, period))
      .reduce((sum, sale) => sum + Math.round(sale.amount * 100), 0) / 100
  );
}
