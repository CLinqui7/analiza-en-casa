import type { Shift } from '@analiza/contracts';
import { describe, expect, it } from 'vitest';
import { buildShiftSeries, endForPreset, endTimeForPreset } from './agenda-series';

// test-id: vitest:cr017-multi-day-shifts
// test-id: vitest:cr018-shift-presets

describe('agenda series', () => {
  it('creates one shift per selected day and derives 6h/8h endings', () => {
    expect(endTimeForPreset('2026-09-01', '08:00', 'SIX_HOURS')).toBe('14:00');
    expect(endTimeForPreset('2026-09-01', '08:00', 'EIGHT_HOURS')).toBe('16:00');
    expect(buildShiftSeries({ dates: ['2026-09-03', '2026-09-01'], resourceId: 'nurse-1', startTime: '08:00', endTime: '14:00', status: 'SCHEDULED', existing: [], idFor: (date) => `shift-${date}` }).map((shift) => shift.id)).toEqual(['shift-2026-09-01', 'shift-2026-09-03']);
  });

  it('rejects repeated days and resource collisions', () => {
    const existing: Shift[] = [{ id: 'existing', resourceId: 'nurse-1', startsAt: new Date('2026-09-01T08:00').toISOString(), endsAt: new Date('2026-09-01T14:00').toISOString(), status: 'SCHEDULED' }];
    expect(() => buildShiftSeries({ dates: ['2026-09-02', '2026-09-02'], resourceId: 'nurse-1', startTime: '08:00', endTime: '14:00', status: 'SCHEDULED', existing: [], idFor: () => 'x' })).toThrow('No repita');
    expect(() => buildShiftSeries({ dates: ['2026-09-01'], resourceId: 'nurse-1', startTime: '09:00', endTime: '12:00', status: 'SCHEDULED', existing, idFor: () => 'x' })).toThrow('colisiona');
  });

  it('preserves exact preset durations across midnight', () => {
    expect(endForPreset('2026-09-01', '20:00', 'SIX_HOURS')).toEqual({ endTime: '02:00', endDayOffset: 1 });
    expect(endForPreset('2026-09-01', '20:00', 'EIGHT_HOURS')).toEqual({ endTime: '04:00', endDayOffset: 1 });
    const [shift] = buildShiftSeries({ dates: ['2026-09-01'], resourceId: 'nurse-1', startTime: '20:00', endTime: '02:00', endDayOffset: 1, status: 'SCHEDULED', existing: [], idFor: () => 'overnight' });
    expect(new Date(shift.endsAt).getTime() - new Date(shift.startsAt).getTime()).toBe(6 * 60 * 60 * 1000);
  });
});
