import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  doctorImportColumns,
  previewDoctorImport,
  readDoctorCsv,
  readDoctorImportFile,
} from './doctor-import-preflight';

const fields = doctorImportColumns.map(([key]) => key);
const header: string[] = doctorImportColumns.map(([, label]) => label);
function row(
  index: number,
  overrides: Record<string, string | number | boolean | Date | null> = {},
) {
  const values: Record<string, string | number | boolean | Date | null> = {
    sourceId: `QA-${index}`,
    fullName: `Médico sintético ${index}`,
    specialty: 'Especialidad sintética',
    landlinePhone: '2222-0000',
    referralCategory: 'Nuevo',
    jvpm: `QA-${index}`,
    ...overrides,
  };
  return fields.map((field) => values[field] ?? '');
}
const org = 'synthetic-doctor-import';
describe('doctor bulk preparation without writes', () => {
  it('reads the delivered Excel template and 700 actual XLSX rows without losing leading zeros', async () => {
    const original = await readFile(
      new URL(
        '../../../../outputs/doctors-preparation-20261105/Plantilla-medicos-Analiza.xlsx',
        import.meta.url,
      ),
    );
    const blank = await readDoctorImportFile(original, '.xlsx');
    expect(blank.sheet).toBe('Medicos');
    expect(blank.rows[0]).toEqual(header);
    expect(previewDoctorImport(blank.rows, org).summary.total).toBe(0);
    const zip = unzipSync(original);
    // Normalize the exporter namespace for the synthetic worksheet fixture only.
    const xml = strFromU8(zip['xl/worksheets/sheet1.xml'])
      .replace(/(<\/?)(?:x:)/g, '$1')
      .replace('xmlns:x=', 'xmlns=');
    const first = xml.match(/<row\b[^>]*r="1"[^>]*>[\s\S]*?<\/row>/)![0];
    const data = Array.from({ length: 700 }, (_, i) => {
      const cells = row(i, { documentId: String(i).padStart(8, '0') + '-1' });
      return `<row r="${i + 2}">${cells.map((value, column) => `<c r="${String.fromCharCode(65 + column)}${i + 2}" t="inlineStr"><is><t>${value}</t></is></c>`).join('')}</row>`;
    }).join('');
    zip['xl/worksheets/sheet1.xml'] = strToU8(
      xml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${first}${data}</sheetData>`),
    );
    const read = await readDoctorImportFile(zipSync(zip), '.xlsx', 'Medicos');
    const preview = previewDoctorImport(read.rows, org, { organizationId: org, doctors: [] });
    expect(preview.summary).toEqual({
      total: 700,
      rowsWithoutIssues: 700,
      rowsToReview: 0,
      issues: 0,
    });
    expect(preview.records[0].doctor?.documentId).toBe('00000000-1');
    expect(preview.records[699].doctor?.documentId).toBe('00000699-1');
    expect(preview.readyForControlledImport).toBe(true);
    await expect(readDoctorImportFile(original, '.xlsx', 'No existe')).rejects.toThrow(
      /hoja exacta/,
    );
    zip['xl/worksheets/sheet1.xml'] = strToU8(
      xml.replace(
        '</sheetData>',
        '<row r="1002"><c r="A1002"><f>1+1</f><v>2</v></c></row></sheetData>',
      ),
    );
    await expect(readDoctorImportFile(zipSync(zip), '.xlsx')).rejects.toThrow(/fórmulas/);
  });
  it('prepares 700 rows with exact reconciliation and stable fingerprints', () => {
    const source = [header, ...Array.from({ length: 700 }, (_, i) => row(i))];
    const result = previewDoctorImport(source, org, { organizationId: org, doctors: [] });
    expect(result.summary).toEqual({
      total: 700,
      rowsWithoutIssues: 700,
      rowsToReview: 0,
      issues: 0,
    });
    expect(result.readyForControlledImport).toBe(true);
    expect(previewDoctorImport(source, org).readyForControlledImport).toBe(false);
    expect(previewDoctorImport(source, org).records.map((r) => r.fingerprint)).toEqual(
      result.records.map((r) => r.fingerprint),
    );
    expect(result.records[699].doctor?.fullName).toBe('Médico sintético 699');
    expect(source[1][fields.indexOf('referralCategory')]).toBe('Nuevo');
  });
  it('marks all duplicate members, normalizes names/identifiers only for comparison', () => {
    const source = [
      header,
      row(1, { fullName: 'Dra. María  Sintética', documentId: '00000001-2' }),
      row(2, { fullName: 'MARIA SINTETICA', documentId: '000000012' }),
    ];
    const result = previewDoctorImport(source, org);
    expect(result.summary.rowsToReview).toBe(2);
    expect(result.issues.filter((i) => i.code === 'POSSIBLE_DUPLICATE_FILE')).toHaveLength(4);
    expect(result.records[0].doctor?.documentId).toBe('00000001-2');
    expect(result.records[0].doctor?.fullName).toBe('Dra. María  Sintética');
  });
  it('compares only the chosen organization and never proposes overwriting', () => {
    const doctor = previewDoctorImport([header, row(1)], org).records[0].doctor!;
    const existing = {
      organizationId: org,
      doctors: [{ doctor: { ...doctor, id: 'existing-1' }, version: 4 }],
    };
    const result = previewDoctorImport([header, row(2, { jvpm: 'qa1' })], org, existing);
    expect(result.issues.some((i) => i.existingIds?.includes('existing-1'))).toBe(true);
    expect(result.records[0].status).toBe('REVIEW');
    expect(result.readyForControlledImport).toBe(false);
    expect(existing.doctors[0].version).toBe(4);
    expect(() => previewDoctorImport([header, row(1)], 'another', existing)).toThrow(
      /otra organización/,
    );
  });
  it('keeps DUI/address optional but preserves current required fields', () => {
    expect(previewDoctorImport([header, row(1)], org).issues).toEqual([]);
    for (const field of ['fullName', 'specialty', 'landlinePhone', 'referralCategory']) {
      const preview = previewDoctorImport([header, row(1, { [field]: '' })], org);
      expect(preview.issues.some((i) => i.code === 'REQUIRED_VALUE' && i.column === field)).toBe(
        true,
      );
      expect(preview.records[0].doctor).toBeUndefined();
    }
  });
  it('does not infer telephone kind, dates, categories or lost zeros', () => {
    const result = previewDoctorImport(
      [
        header,
        row(1, {
          documentId: 123,
          birthDate: '01/02/1980',
          secretaryBirthday: '2026-02-30',
          referralCategory: 'antiguo',
          email: 'broken',
        }),
      ],
      org,
    );
    expect(result.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        'IDENTIFIER_NOT_TEXT',
        'AMBIGUOUS_DATE',
        'INVALID_CATEGORY',
        'INVALID_EMAIL',
      ]),
    );
    expect(result.records[0].values.documentId).toBe('123');
    const valid = previewDoctorImport(
      [header, row(2, { birthDate: new Date('1980-02-01T00:00:00Z') })],
      org,
    );
    expect(valid.issues).toEqual([]);
    expect(valid.records[0].doctor?.birthDate).toBe('1980-02-01');
  });
  it('rejects ambiguity in columns and reports original row numbers', () => {
    const result = previewDoctorImport(
      [
        header.concat('Nombre', 'Sin correspondencia'),
        row(1).concat('Otro', 'Dato'),
        [],
        row(2, { landlinePhone: '' }),
      ],
      org,
    );
    expect(result.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['DUPLICATE_COLUMN', 'UNKNOWN_COLUMN']),
    );
    expect(result.issues.find((i) => i.column === 'landlinePhone')?.row).toBe(4);
    expect(result.records.every((r) => r.status === 'REVIEW')).toBe(true);
  });
  it('handles CSV quoting, delimiters and embedded newlines without dropping fields', () => {
    expect(
      readDoctorCsv('\uFEFFNombre;Dirección\r\n"María, QA";"Calle ""A""\nZona 1"\r\n'),
    ).toEqual([
      ['Nombre', 'Dirección'],
      ['María, QA', 'Calle "A"\nZona 1'],
    ]);
    expect(readDoctorCsv('a,b\n1,""')).toEqual([
      ['a', 'b'],
      ['1', ''],
    ]);
    expect(() => readDoctorCsv('a,b\n"x,y')).toThrow(/sin cerrar/);
    expect(() => readDoctorCsv('a,b\n"x"oops,y')).toThrow(/después/);
  });
  it('enforces row and file boundaries and rejects unsupported files', async () => {
    expect(() =>
      previewDoctorImport([header, ...Array.from({ length: 2001 }, (_, i) => row(i))], org),
    ).toThrow(/2.000/);
    expect(previewDoctorImport([header], org).issues[0].code).toBe('NO_RECORDS');
    await expect(
      readDoctorImportFile(new Uint8Array(5 * 1024 * 1024 + 1), '.xlsx'),
    ).rejects.toThrow(/5 MB/);
    await expect(readDoctorImportFile(new Uint8Array(), '.xls')).rejects.toThrow(/xlsx/);
  });
});
