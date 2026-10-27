import type { Patient, Payment, Quote } from '@analiza/contracts';
import { quoteDisplayCode, toCsv } from '@analiza/domain';

export type PaymentReportFilters = {
  query: string;
  status: 'ALL' | Payment['status'];
  from: string;
  to: string;
};

export type PaymentReportRow = {
  payment: Payment;
  patientName: string;
  quoteCode: string;
};

export const paymentMethodLabel: Record<NonNullable<Payment['paymentMethod']>, string> = {
  CASH: 'Efectivo',
  CHECK: 'Cheque',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
};

export const paymentStatusLabel: Record<Payment['status'], string> = {
  APPLIED: 'Aplicado',
  VOIDED: 'Reversado',
};

const paymentDateFormatter = new Intl.DateTimeFormat('es-SV', {
  timeZone: 'America/El_Salvador',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function paymentLocalDate(createdAt: string): string {
  const parts = paymentDateFormatter.formatToParts(new Date(createdAt));
  const value = (name: string) => parts.find((part) => part.type === name)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function paymentReportRows(
  payments: Payment[],
  quotes: Quote[],
  patients: Patient[],
  filters: PaymentReportFilters,
): PaymentReportRow[] {
  const quoteById = new Map(quotes.map((quote) => [quote.id, quote]));
  const patientById = new Map(patients.map((patient) => [patient.id, patient]));
  const query = filters.query.trim().toLocaleLowerCase('es');
  return payments
    .map((payment) => {
      const quote = quoteById.get(payment.quoteId);
      return {
        payment,
        patientName: quote
          ? (patientById.get(quote.patientId)?.fullName ?? 'Paciente no disponible')
          : 'Paciente no disponible',
        quoteCode: quoteDisplayCode(payment.quoteId),
      };
    })
    .filter((row) => {
      const date = paymentLocalDate(row.payment.createdAt);
      return (
        (filters.status === 'ALL' || row.payment.status === filters.status) &&
        (!filters.from || date >= filters.from) &&
        (!filters.to || date <= filters.to) &&
        (!query ||
          [row.patientName, row.quoteCode, row.payment.reference ?? '', row.payment.id]
            .join(' ')
            .toLocaleLowerCase('es')
            .includes(query))
      );
    })
    .sort(
      (a, b) =>
        b.payment.createdAt.localeCompare(a.payment.createdAt) ||
        b.payment.id.localeCompare(a.payment.id),
    );
}

function csvValue(value: string): string {
  return /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? `'${value}` : value;
}

export function paymentReportCsv(rows: PaymentReportRow[]): string {
  return toCsv([
    [
      'Fecha y hora UTC',
      'Paciente',
      'Cotización',
      'Monto USD',
      'Medio de pago',
      'Referencia',
      'Estado',
      'Motivo de reversión',
      'ID del pago',
    ],
    ...rows.map(({ payment, patientName, quoteCode }) =>
      [
        payment.createdAt,
        patientName,
        quoteCode,
        payment.amount.toFixed(2),
        payment.paymentMethod ? paymentMethodLabel[payment.paymentMethod] : 'No registrado',
        payment.reference ?? '',
        paymentStatusLabel[payment.status],
        payment.voidReason ?? '',
        payment.id,
      ].map(csvValue),
    ),
  ]);
}
