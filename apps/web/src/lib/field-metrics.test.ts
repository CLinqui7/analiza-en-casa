import { describe, expect, it } from 'vitest';
import { commercialTotals, companySales, periodStarts } from './field-metrics';
import type { CommercialAdmission, CommercialVisit, ConfirmedSale } from '@analiza/contracts';

describe('field metrics', () => {
  // test-id: vitest:commercial-salvador-periods
  it('uses Salvador calendar dates and Monday week starts', () => {
    expect(periodStarts(new Date('2026-10-08T03:00:00Z'))).toEqual({
      week: '2026-10-05',
      month: '2026-10-01',
    });
    expect(periodStarts(new Date('2026-10-05T02:00:00Z')).week).toBe('2026-09-28');
  });
  // test-id: vitest:commercial-confirmed-reference-metrics
  it('counts distinct contacted doctors, linked admissions and referenced commercial sales only', () => {
    const visits = [
      { id: 'v1', doctorId: 'd1', occurredAt: '2026-10-06T16:00:00Z', outcome: 'CONTACTED' },
      { id: 'v2', doctorId: 'd1', occurredAt: '2026-10-07T16:00:00Z', outcome: 'FOLLOW_UP' },
      { id: 'v3', doctorId: 'd2', occurredAt: '2026-10-07T16:00:00Z', outcome: 'NO_CONTACT' },
      { id: 'v4', doctorId: 'd3', occurredAt: '2026-09-29T16:00:00Z', outcome: 'CONTACTED' },
    ] as CommercialVisit[];
    const admissions = [
      {
        id: 'a1',
        visitId: 'v1',
        hospitalizationId: 'h1',
        patientId: 'p1',
        admittedAt: '2026-10-07',
      },
      {
        id: 'a2',
        visitId: 'v2',
        hospitalizationId: 'h1',
        patientId: 'p1',
        admittedAt: '2026-10-07',
      },
      {
        id: 'a3',
        visitId: 'v4',
        hospitalizationId: 'h2',
        patientId: 'p2',
        admittedAt: '2026-10-08',
      },
    ] as CommercialAdmission[];
    const sales = [
      {
        id: 's1',
        amount: 20.25,
        commercialVisitId: 'v1',
        occurredAt: '2026-10-07T16:00:00Z',
        reference: 'REF-1',
      },
      { id: 's2', amount: 10, occurredAt: '2026-10-07T16:00:00Z', reference: 'REF-2' },
      {
        id: 's3',
        amount: 4.75,
        commercialVisitId: 'v4',
        occurredAt: '2026-10-08T16:00:00Z',
        reference: 'REF-3',
      },
    ] as ConfirmedSale[];
    expect(commercialTotals(visits, admissions, sales, '2026-10-05', 'WEEK')).toEqual({
      doctors: 1,
      patients: 2,
      sales: 25,
    });
    expect(companySales(sales, '2026-10-05', 'WEEK')).toBe(35);
  });
});
