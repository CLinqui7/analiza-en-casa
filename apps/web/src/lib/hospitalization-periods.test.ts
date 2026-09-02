import { describe, expect, it } from 'vitest';
import { normalizeAdmissionPeriods } from './hospitalization-periods';

// test-id: vitest:cr009-admission-periods

describe('admission periods', () => {
  it('retains distinct admission/discharge periods in chronological order', () => {
    expect(normalizeAdmissionPeriods([
      { admissionDate: '2026-09-10', dischargeDate: '2026-09-12' },
      { admissionDate: '2026-09-01', dischargeDate: '2026-09-02' },
    ])).toEqual([
      { admissionDate: '2026-09-01', dischargeDate: '2026-09-02' },
      { admissionDate: '2026-09-10', dischargeDate: '2026-09-12' },
    ]);
  });

  it('rejects backwards and duplicate periods', () => {
    expect(() => normalizeAdmissionPeriods([{ admissionDate: '2026-09-03', dischargeDate: '2026-09-02' }])).toThrow('egreso');
    expect(() => normalizeAdmissionPeriods([
      { admissionDate: '2026-09-03', dischargeDate: '2026-09-04' },
      { admissionDate: '2026-09-03', dischargeDate: '2026-09-04' },
    ])).toThrow('No repita');
  });
});
