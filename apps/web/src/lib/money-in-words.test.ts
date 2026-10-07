import { describe, expect, it } from 'vitest';
import { usdAmountInSpanishWords } from './money-in-words';

describe('USD amount in Spanish words', () => {
  it.each([
    [0, 'CERO DÓLARES CON CERO CENTAVOS'],
    [1, 'UN DÓLAR CON CERO CENTAVOS'],
    [21.01, 'VEINTIÚN DÓLARES CON UN CENTAVO'],
    [40, 'CUARENTA DÓLARES CON CERO CENTAVOS'],
    [101.25, 'CIENTO UN DÓLARES CON VEINTICINCO CENTAVOS'],
    [1000.5, 'MIL DÓLARES CON CINCUENTA CENTAVOS'],
    [1_000_000, 'UN MILLÓN DE DÓLARES CON CERO CENTAVOS'],
    [1_000_001.3, 'UN MILLÓN UN DÓLARES CON TREINTA CENTAVOS'],
  ])('renders %s without changing the numerical amount', (value, expected) => {
    expect(usdAmountInSpanishWords(value)).toBe(expected);
  });

  it('does not invent wording for out-of-range or non-finite values', () => {
    expect(usdAmountInSpanishWords(-1)).toBeNull();
    expect(usdAmountInSpanishWords(Number.POSITIVE_INFINITY)).toBeNull();
    expect(usdAmountInSpanishWords(1_000_000_000_000)).toBeNull();
  });
});
