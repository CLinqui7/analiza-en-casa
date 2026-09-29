export const phoneCountries = [
  { iso: 'SV', name: 'El Salvador', code: '503' },
  { iso: 'CU', name: 'Cuba', code: '53' },
  { iso: 'GT', name: 'Guatemala', code: '502' },
  { iso: 'HN', name: 'Honduras', code: '504' },
  { iso: 'NI', name: 'Nicaragua', code: '505' },
  { iso: 'CR', name: 'Costa Rica', code: '506' },
  { iso: 'PA', name: 'Panamá', code: '507' },
  { iso: 'MX', name: 'México', code: '52' },
  { iso: 'US', name: 'Estados Unidos / Canadá', code: '1' },
  { iso: 'CO', name: 'Colombia', code: '57' },
] as const;

export type PhoneCountry = (typeof phoneCountries)[number]['iso'];
const countriesByLongestCode = [...phoneCountries].sort(
  (left, right) => right.code.length - left.code.length,
);

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function splitPhone(value: string): { country: PhoneCountry | ''; national: string } {
  const trimmed = value.trim();
  if (!trimmed) return { country: 'SV', national: '' };
  if (!trimmed.startsWith('+')) return { country: '', national: phoneDigits(trimmed) };
  const digits = phoneDigits(trimmed);
  const match = countriesByLongestCode.find((candidate) => digits.startsWith(candidate.code));
  return match
    ? { country: match.iso, national: digits.slice(match.code.length) }
    : { country: '', national: digits };
}

export function formatNationalPhone(value: string): string {
  const digits = phoneDigits(value).slice(0, 12);
  if (digits.length <= 4) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
}

export function composePhone(country: PhoneCountry, national: string): string {
  const digits = phoneDigits(national).slice(0, 12);
  if (!digits) return '';
  const code = phoneCountries.find((entry) => entry.iso === country)?.code;
  return code ? `+${code} ${formatNationalPhone(digits)}` : '';
}

/** Only rewrite numbers whose country is explicit; ambiguous legacy numbers remain untouched. */
export function normalizeKnownPhone(value: string): string {
  const parsed = splitPhone(value);
  return parsed.country ? composePhone(parsed.country, parsed.national) : value;
}

export function isNormalizedPhone(value: string): boolean {
  if (!value) return true;
  const { country, national } = splitPhone(value);
  const code = phoneCountries.find((entry) => entry.iso === country)?.code;
  return Boolean(
    code &&
    national.length >= 7 &&
    national.length <= 12 &&
    value === composePhone(country as PhoneCountry, national),
  );
}
