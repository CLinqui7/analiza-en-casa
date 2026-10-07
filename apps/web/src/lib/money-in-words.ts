const units = [
  'cero',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
];
const tens = [
  '',
  '',
  '',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
];
const hundreds = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
];

function underThousand(value: number): string {
  if (value < 30) return units[value];
  if (value < 100) {
    const ten = Math.floor(value / 10);
    return value % 10 ? `${tens[ten]} y ${units[value % 10]}` : tens[ten];
  }
  if (value === 100) return 'cien';
  const hundred = Math.floor(value / 100);
  return value % 100 ? `${hundreds[hundred]} ${underThousand(value % 100)}` : hundreds[hundred];
}

function beforeMasculineNoun(words: string): string {
  return words
    .replace(/veintiuno$/, 'veintiún')
    .replace(/ y uno$/, ' y un')
    .replace(/\buno$/, 'un');
}

function underMillion(value: number, beforeNoun = false): string {
  const thousands = Math.floor(value / 1000);
  const rest = value % 1000;
  const prefix = thousands
    ? thousands === 1
      ? 'mil'
      : `${beforeMasculineNoun(underThousand(thousands))} mil`
    : '';
  const suffix = rest ? underThousand(rest) : '';
  const words = [prefix, suffix].filter(Boolean).join(' ');
  return beforeNoun ? beforeMasculineNoun(words) : words;
}

function integerWords(value: number, beforeNoun = false): string {
  if (value === 0) return 'cero';
  const millions = Math.floor(value / 1_000_000);
  const rest = value % 1_000_000;
  const prefix = millions
    ? millions === 1
      ? 'un millón'
      : `${underMillion(millions, true)} millones`
    : '';
  const suffix = rest ? underMillion(rest, beforeNoun) : '';
  return [prefix, suffix].filter(Boolean).join(' ');
}

/** Administrative wording only; it neither calculates tax nor establishes payment terms. */
export function usdAmountInSpanishWords(value: number): string | null {
  if (!Number.isFinite(value) || value < 0 || value >= 1_000_000_000_000) return null;
  const centsTotal = Math.round((value + Number.EPSILON) * 100);
  const whole = Math.floor(centsTotal / 100);
  const cents = centsTotal % 100;
  const de = whole >= 1_000_000 && whole % 1_000_000 === 0 ? 'de ' : '';
  return `${integerWords(whole, true)} ${de}${whole === 1 ? 'dólar' : 'dólares'} con ${integerWords(cents, true)} ${cents === 1 ? 'centavo' : 'centavos'}`.toLocaleUpperCase(
    'es-SV',
  );
}
