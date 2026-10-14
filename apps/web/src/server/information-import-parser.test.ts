import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { parseInformationWorkbook } from './information-import-parser';

const officialTemplate = fileURLToPath(
  new URL('../../public/templates/plantilla_carga_analiza_en_casa.xlsx', import.meta.url),
);

describe('information workbook parser', () => {
  async function populatedService(extra: Record<string, string | number> = {}) {
    const files = unzipSync(await readFile(officialTemplate));
    const values: Record<string, string | number> = {
      A: 'QA-SERVICE',
      B: 'Servicio sintético',
      C: 'Enfermeria',
      E: 'Visita',
      G: 31.3528,
      H: 'USD',
      L: 'Activo',
      ...extra,
    };
    const row = `<row r="6">${Object.entries(values)
      .map(([column, value]) =>
        typeof value === 'number'
          ? `<c r="${column}6"><v>${value}</v></c>`
          : `<c r="${column}6" t="inlineStr"><is><t>${value}</t></is></c>`,
      )
      .join('')}</row>`;
    files['xl/worksheets/sheet3.xml'] = strToU8(
      strFromU8(files['xl/worksheets/sheet3.xml']).replace(
        /<row\b[^>]*r="6"[^>]*>[\s\S]*?<\/row>/,
        row,
      ),
    );
    return parseInformationWorkbook('synthetic-test.xlsx', zipSync(files));
  }
  it('uses the supplied permitted values and preserves decimal service prices', async () => {
    const valid = await populatedService();
    expect(valid.records).toHaveLength(1);
    expect(valid.issues).toEqual([]);
    expect(valid.records[0].values.precio_base).toBe(31.3528);
    const invalid = await populatedService({ H: 'UNAPPROVED' });
    expect(
      invalid.issues.some((issue) => issue.column === 'moneda' && issue.message.includes('Listas')),
    ).toBe(true);
  });
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
