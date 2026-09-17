import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseInformationWorkbook } from './information-import-parser';

const officialTemplate = fileURLToPath(
  new URL('../../public/templates/plantilla_carga_analiza_en_casa.xlsx', import.meta.url),
);

describe('information workbook parser', () => {
  it('recognizes every sheet and header in the official template', async () => {
    const parsed = await parseInformationWorkbook(
      'plantilla.xlsx',
      await readFile(officialTemplate),
    );

    expect(parsed.records).toEqual([]);
    expect(parsed.issues).toEqual([
      {
        sheet: 'Archivo',
        row: 0,
        message: 'La plantilla no contiene registros para importar.',
      },
    ]);
  });

  it('rejects content that is not a valid xlsx workbook', async () => {
    const parsed = await parseInformationWorkbook('archivo.xlsx', new TextEncoder().encode('no'));

    expect(parsed.records).toEqual([]);
    expect(parsed.issues[0]?.message).toBe('No pudimos leer el documento Excel.');
  });
});
