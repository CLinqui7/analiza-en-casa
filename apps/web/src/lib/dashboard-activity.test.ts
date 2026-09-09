import { describe, expect, it } from 'vitest';
import {
  filterDashboardReadings,
  getDashboardActions,
  isInDashboardDateRange,
} from './dashboard-activity';

describe('dashboard activity', () => {
  it('filters exact ISO calendar dates inclusively', () => {
    expect(
      isInDashboardDateRange('2026-08-28T08:00:00.000Z', { from: '2026-08-28', to: '2026-08-28' }),
    ).toBe(true);
    expect(
      isInDashboardDateRange('2026-08-29T00:00:00.000Z', { from: '2026-08-28', to: '2026-08-28' }),
    ).toBe(false);
  });

  it('keeps only readings in range and orders them most recent first', () => {
    const readings = [
      { id: 'old', measuredAt: '2026-08-27T08:00:00.000Z' },
      { id: 'late', measuredAt: '2026-08-28T14:00:00.000Z' },
      { id: 'early', measuredAt: '2026-08-28T08:00:00.000Z' },
    ] as never;
    expect(
      filterDashboardReadings(readings, { from: '2026-08-28', to: '2026-08-28' }).map(
        ({ id }) => id,
      ),
    ).toEqual(['late', 'early']);
  });

  it('derives actionable scheduled shifts and documented case actions without inventing them', () => {
    const actions = getDashboardActions(
      [
        {
          id: 'scheduled',
          patientId: 'p1',
          startsAt: '2026-08-28T08:00:00.000Z',
          endsAt: '2026-08-28T14:00:00.000Z',
          resourceId: 'r1',
          status: 'SCHEDULED',
        },
        {
          id: 'cancelled',
          patientId: 'p1',
          startsAt: '2026-08-28T09:00:00.000Z',
          endsAt: '2026-08-28T10:00:00.000Z',
          resourceId: 'r1',
          status: 'CANCELLED',
        },
      ],
      [
        {
          id: 'case1',
          patientId: 'p1',
          startDate: '2026-08-28',
          status: 'ACTIVE',
          accountType: 'Demo',
          nextAction: 'Confirmar coordinación',
        },
        {
          id: 'case2',
          patientId: 'p1',
          startDate: '2026-08-28',
          status: 'ACTIVE',
          accountType: 'Demo',
        },
      ],
      [
        {
          id: 'p1',
          fullName: 'Paciente sintético',
          documentType: 'DUI',
          documentId: 'DEMO-001',
          status: 'ACTIVE',
        },
      ],
      { from: '2026-08-28', to: '2026-08-28' },
    );
    expect(actions).toEqual([
      expect.objectContaining({
        id: 'case-case1',
        href: '/hospitalizations/case1',
        detail: 'Confirmar coordinación',
      }),
      expect.objectContaining({
        id: 'shift-scheduled',
        href: '/agenda',
        patientName: 'Paciente sintético',
      }),
    ]);
  });
});
