import { describe, expect, it } from 'vitest';
import { clinicalScaleReferences } from './clinical-scale-references';
import { parseClinicalScaleInput } from './clinical-scale-capture';

const observedAt = '2026-09-29T15:00:00.000Z';

describe('clinical scale capture', () => {
  it('accepts each original form only with all its visible values', () => {
    for (const scale of clinicalScaleReferences) {
      const values = Object.fromEntries(scale.fields.map((field) => [field.key, field.options[0]]));
      expect(parseClinicalScaleInput({ scaleId: scale.id, observedAt, values }).values).toEqual(
        values,
      );
    }
  });

  it('rejects missing, out-of-range and injected values', () => {
    const base = { scaleId: 'eva', observedAt, values: { score: 4 } };
    expect(() => parseClinicalScaleInput({ ...base, values: {} })).toThrow();
    expect(() => parseClinicalScaleInput({ ...base, values: { score: 11 } })).toThrow();
    expect(() => parseClinicalScaleInput({ ...base, values: { score: 4, extra: 1 } })).toThrow();
    expect(() => parseClinicalScaleInput({ ...base, organizationId: 'other' })).toThrow();
  });
});
