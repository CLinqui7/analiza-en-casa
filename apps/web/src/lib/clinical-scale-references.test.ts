import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { clinicalScaleReferences } from './clinical-scale-references';

describe('clinical scale source catalog', () => {
  it('links each of the ten Excel rows to a unique original image', () => {
    expect(clinicalScaleReferences).toHaveLength(10);
    expect(clinicalScaleReferences.map((entry) => entry.row)).toEqual([
      22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
    ]);
    expect(new Set(clinicalScaleReferences.map((entry) => entry.image)).size).toBe(10);
    for (const reference of clinicalScaleReferences) {
      expect(existsSync(path.resolve('apps/web/public', reference.image.slice(1)))).toBe(true);
    }
  });

  it('retains source conflicts instead of authorizing scores from them', () => {
    expect(clinicalScaleReferences.find((entry) => entry.id === 'glasgow')?.conflict).toBe(true);
    expect(clinicalScaleReferences.find((entry) => entry.id === 'dowton-b')?.conflict).toBe(true);
  });
});
