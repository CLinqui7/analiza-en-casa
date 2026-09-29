import { describe, expect, it } from 'vitest';
import { composePhone, isNormalizedPhone, normalizeKnownPhone, splitPhone } from './phone-number';

describe('phone number entry', () => {
  it('keeps an existing country code and formats the national number', () => {
    expect(splitPhone('+53 5123-4567')).toEqual({ country: 'CU', national: '51234567' });
    expect(composePhone('CU', '51234567')).toBe('+53 5123-4567');
    expect(isNormalizedPhone('+53 51234567')).toBe(false);
    expect(normalizeKnownPhone('+53 51234567')).toBe('+53 5123-4567');
  });

  it('does not guess the country of a legacy number without a code', () => {
    expect(splitPhone('7123-4567')).toEqual({ country: '', national: '71234567' });
    expect(normalizeKnownPhone('7123-4567')).toBe('7123-4567');
    expect(isNormalizedPhone('7123-4567')).toBe(false);
    expect(composePhone('SV', '71234567')).toBe('+503 7123-4567');
  });

  it('requires a country code and a plausible national length for new entries', () => {
    expect(isNormalizedPhone('+503 7123-4567')).toBe(true);
    expect(isNormalizedPhone('+503 123')).toBe(false);
  });
});
