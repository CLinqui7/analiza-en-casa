import { createHash } from 'node:crypto';
import readWorkbook from 'read-excel-file/node';
import { unzipSync, strFromU8 } from 'fflate';
import { doctorSchema, type Doctor } from '@analiza/contracts';
import { parseDoctorCreate } from './validation/doctors';

// Preparation only. This module has no database, HTTP or mutation dependency.
export const doctorImportColumns = [
  ['sourceId', 'ID de origen'],
  ['fullName', 'Nombre completo'],
  ['specialty', 'Especialidad'],
  ['landlinePhone', 'Teléfono fijo'],
  ['referralCategory', 'Nuevo o recurrente'],
  ['jvpm', 'JVPM'],
  ['conadem', 'CONADEM'],
  ['documentId', 'DUI'],
  ['nit', 'NIT'],
  ['phone', 'Teléfono celular'],
  ['email', 'Email'],
  ['birthDate', 'Fecha de nacimiento'],
  ['clinicName', 'Clínica'],
  ['address', 'Dirección'],
  ['consultationHours', 'Horarios de consulta'],
  ['medicalVisitHours', 'Horario de visita médica'],
  ['zone', 'Zona'],
  ['secretaryName', 'Nombre de la secretaria'],
  ['secretaryBirthday', 'Cumpleaños de la secretaria'],
] as const;
type Column = (typeof doctorImportColumns)[number][0];
type Cell = string | number | boolean | Date | null;
export type DoctorImportIssue = {
  row: number;
  column?: string;
  code: string;
  message: string;
  relatedRows?: number[];
  existingIds?: string[];
  matches?: number;
};
export type DoctorSnapshot = {
  organizationId: string;
  doctors: Array<{ doctor: Doctor; version: number }>;
};
const normalize = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const headers = new Map<string, Column>();
for (const [key, label] of doctorImportColumns) {
  headers.set(normalize(key), key);
  headers.set(normalize(label), key);
}
for (const [alias, field] of Object.entries({
  nombre: 'fullName',
  nombre_del_doctor: 'fullName',
  nombre_medico: 'fullName',
  numero_de_colegiacion: 'jvpm',
  jvmp: 'jvpm',
  correo: 'email',
  correo_electronico: 'email',
  celular: 'phone',
  telefono_celular: 'phone',
  telefono_fijo: 'landlinePhone',
  relacion: 'referralCategory',
  nuevo_recurrente: 'referralCategory',
  clinica_nombre: 'clinicName',
}))
  headers.set(normalize(alias), field as Column);
const required: Column[] = ['fullName', 'specialty', 'landlinePhone', 'referralCategory'];
const identifiers: Column[] = [
  'sourceId',
  'documentId',
  'jvpm',
  'conadem',
  'nit',
  'phone',
  'landlinePhone',
];

export async function readDoctorImportFile(
  bytes: Uint8Array,
  extension: string,
  sheetName?: string,
) {
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('El archivo supera 5 MB.');
  if (extension.toLowerCase() === '.csv')
    return {
      sheet: 'CSV',
      rows: readDoctorCsv(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    };
  if (extension.toLowerCase() !== '.xlsx') throw new Error('Use Excel .xlsx o CSV UTF-8.');
  let expandedBytes = 0;
  const zip = unzipSync(bytes, {
    filter: (entry) => {
      expandedBytes += entry.originalSize;
      if (expandedBytes > 32 * 1024 * 1024)
        throw new Error('El contenido descomprimido supera 32 MB.');
      return /^xl\/worksheets\/[^/]+\.xml$/.test(entry.name);
    },
  });
  if (Object.values(zip).some((xml) => /<(?:\w+:)?f(?:\s|\/?>)/.test(strFromU8(xml))))
    throw new Error(
      'El Excel contiene fórmulas. Prepare una copia de valores conservando el original.',
    );
  const sheets = await readWorkbook(Buffer.from(bytes));
  const selected = sheetName
    ? sheets.find((sheet) => sheet.sheet === sheetName)
    : sheets.length === 1
      ? sheets[0]
      : sheets.find((sheet) => sheet.sheet === 'Medicos');
  if (!selected)
    throw new Error('Indique la hoja exacta con --sheet; no se seleccionan hojas por suposición.');
  return { sheet: selected.sheet, rows: selected.data as Cell[][] };
}

/** RFC 4180 quotes and embedded newlines; also accepts semicolon-delimited exports. */
export function readDoctorCsv(text: string): Cell[][] {
  text = text.replace(/^\uFEFF/, '');
  let quoted = false;
  const counts = { ',': 0, ';': 0 };
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted && /[\r\n]/.test(text[i])) break;
    else if (!quoted && (text[i] === ',' || text[i] === ';')) counts[text[i] as ',' | ';']++;
  }
  const delimiter = counts[';'] > counts[','] ? ';' : ',';
  const rows: Cell[][] = [];
  let row: Cell[] = [],
    cell = '',
    inQuotes = false,
    closed = false;
  const finishCell = () => {
    row.push(cell);
    cell = '';
    closed = false;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
          closed = true;
        }
      } else cell += ch;
    } else if (ch === '"') {
      if (cell || closed) throw new Error('CSV con comillas fuera de posición.');
      inQuotes = true;
    } else if (ch === delimiter) finishCell();
    else if (ch === '\n' || ch === '\r') {
      finishCell();
      rows.push(row);
      row = [];
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else {
      if (closed) throw new Error('CSV con contenido después del cierre de comillas.');
      cell += ch;
    }
  }
  if (inQuotes) throw new Error('CSV con comillas sin cerrar.');
  if (cell || closed || row.length) {
    finishCell();
    rows.push(row);
  }
  return rows;
}

function identityKeys(values: Partial<Record<Column, string>>): string[] {
  const keys: string[] = [];
  for (const key of ['sourceId', 'documentId', 'jvpm', 'conadem', 'nit'] as const) {
    const value = normalize(values[key] ?? '');
    if (value) keys.push(`${key}:${value}`);
  }
  const name = (values.fullName ?? '').replace(/^(?:dr\.?|dra\.?|doctor|doctora)\s+/i, '');
  if (normalize(name)) keys.push(`name:${normalize(name)}`);
  return keys;
}

export function previewDoctorImport(
  input: Cell[][],
  organizationId: string,
  existing?: DoctorSnapshot,
) {
  if (!organizationId.trim()) throw new Error('Indique la organización de destino.');
  if (existing && existing.organizationId !== organizationId)
    throw new Error('La conciliación pertenece a otra organización.');
  const issues: DoctorImportIssue[] = [];
  const table = input
    .map((row, i) => ({ row, number: i + 1 }))
    .filter(({ row }) => row.some((cell) => cell !== null && String(cell).trim() !== ''));
  const heading = table.shift();
  if (!heading) throw new Error('El archivo está vacío.');
  if (table.length > 2_000)
    throw new Error('La preparación admite hasta 2.000 médicos por archivo.');
  const mapped = heading.row.map((cell) => headers.get(normalize(String(cell ?? ''))));
  const used = new Set<Column>();
  mapped.forEach((column, i) => {
    if (!column)
      issues.push({
        row: heading.number,
        column: String(heading.row[i] ?? ''),
        code: 'UNKNOWN_COLUMN',
        message: 'Columna sin correspondencia: revisar antes de continuar.',
      });
    else if (used.has(column))
      issues.push({
        row: heading.number,
        column,
        code: 'DUPLICATE_COLUMN',
        message: 'Dos columnas corresponden al mismo campo.',
      });
    else used.add(column);
  });
  for (const column of required)
    if (!used.has(column))
      issues.push({
        row: heading.number,
        column,
        code: 'MISSING_COLUMN',
        message: 'Falta una columna obligatoria.',
      });
  const prepared = table.map(({ row, number }) => {
    const values: Partial<Record<Column, string>> = {};
    if (row.slice(mapped.length).some((cell) => cell !== null && String(cell).trim()))
      issues.push({ row: number, code: 'EXTRA_CELLS', message: 'Hay valores sin encabezado.' });
    mapped.forEach((column, index) => {
      const cell = row[index];
      if (!column || cell === null || cell === undefined || String(cell).trim() === '') return;
      if (identifiers.includes(column) && typeof cell !== 'string')
        issues.push({
          row: number,
          column,
          code: 'IDENTIFIER_NOT_TEXT',
          message: 'Guardar como texto y comprobar ceros iniciales y precisión en el origen.',
        });
      if (typeof cell === 'boolean')
        issues.push({
          row: number,
          column,
          code: 'BOOLEAN_VALUE',
          message: 'Este campo requiere texto, no un valor lógico.',
        });
      const value = cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell).trim();
      if (value.length > 4_000)
        issues.push({
          row: number,
          column,
          code: 'OVERSIZED_CELL',
          message: 'El valor supera 4.000 caracteres; revisar el archivo.',
        });
      values[column] = value;
    });
    for (const column of required)
      if (!values[column])
        issues.push({
          row: number,
          column,
          code: 'REQUIRED_VALUE',
          message: 'Dato obligatorio pendiente; no se completa por suposición.',
        });
    if (values.referralCategory) {
      const category = normalize(values.referralCategory);
      const categories: Record<string, string> = {
        new: 'NEW',
        nuevo: 'NEW',
        recurrent: 'RECURRENT',
        recurrente: 'RECURRENT',
      };
      if (categories[category]) values.referralCategory = categories[category];
      else
        issues.push({
          row: number,
          column: 'referralCategory',
          code: 'INVALID_CATEGORY',
          message: 'Seleccione Nuevo o Recurrente.',
        });
    }
    for (const column of ['birthDate', 'secretaryBirthday'] as const)
      if (values[column]) {
        const date = values[column]!;
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(Date.parse(date)) ||
          new Date(date).toISOString().slice(0, 10) !== date
        )
          issues.push({
            row: number,
            column,
            code: 'AMBIGUOUS_DATE',
            message: 'Use una fecha válida AAAA-MM-DD, sin inferir el año.',
          });
      }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
      issues.push({
        row: number,
        column: 'email',
        code: 'INVALID_EMAIL',
        message: 'Revise el formato del correo.',
      });
    // Reuse the application's current boundary instead of relaxing required fields.
    const { sourceId, ...fields } = values;
    let doctor: Doctor | undefined;
    try {
      doctor = parseDoctorCreate({
        doctor: { ...fields, id: `preview-${number}`, attachments: [] },
      });
    } catch {
      if (!issues.some((issue) => issue.row === number))
        issues.push({
          row: number,
          code: 'DOCTOR_VALIDATION',
          message: 'El registro no cumple la validación actual del formulario.',
        });
    }
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(Object.entries(values).sort()))
      .digest('hex');
    return { sourceRow: number, sourceId, fingerprint, values, doctor };
  });
  const groups = new Map<string, number[]>();
  for (const record of prepared)
    for (const key of identityKeys(record.values))
      groups.set(key, [...(groups.get(key) ?? []), record.sourceRow]);
  for (const [key, rows] of groups)
    if (rows.length > 1)
      for (const row of rows)
        issues.push({
          row,
          column: key.split(':')[0],
          code: 'POSSIBLE_DUPLICATE_FILE',
          message: 'Coincidencia dentro del archivo; no se fusiona automáticamente.',
          relatedRows: rows.filter((n) => n !== row).slice(0, 20),
          matches: rows.length - 1,
        });
  const existingIndex = new Map<string, string[]>();
  if (existing)
    for (const item of existing.doctors) {
      const doctor = doctorSchema.parse(item.doctor);
      if (!doctor.id.trim() || !Number.isInteger(item.version) || item.version < 1)
        throw new Error('La conciliación requiere médicos con ID y versión válidos.');
      for (const key of identityKeys(doctor as Partial<Record<Column, string>>))
        existingIndex.set(key, [...(existingIndex.get(key) ?? []), doctor.id]);
    }
  for (const record of prepared)
    for (const key of identityKeys(record.values)) {
      const matches = existingIndex.get(key);
      if (matches?.length)
        issues.push({
          row: record.sourceRow,
          column: key.split(':')[0],
          code: 'EXISTING_MATCH',
          message: 'Coincide con un médico existente; revisar sin sobrescribir.',
          existingIds: matches.slice(0, 20),
          matches: matches.length,
        });
    }
  if (!prepared.length)
    issues.push({ row: 0, code: 'NO_RECORDS', message: 'No hay médicos para revisar.' });
  const problemRows = new Set(
    issues.filter((issue) => issue.row > heading.number).map((issue) => issue.row),
  );
  if (issues.some((issue) => issue.row === heading.number))
    for (const record of prepared) problemRows.add(record.sourceRow);
  return {
    mode: 'PREVIEW_ONLY' as const,
    organizationId,
    comparedWithExisting: existing !== undefined,
    readyForControlledImport: prepared.length > 0 && issues.length === 0 && existing !== undefined,
    summary: {
      total: prepared.length,
      rowsWithoutIssues: prepared.length - problemRows.size,
      rowsToReview: problemRows.size,
      issues: issues.length,
    },
    issues,
    records: prepared.map((record) => ({
      ...record,
      status: problemRows.has(record.sourceRow) ? 'REVIEW' : 'CANDIDATE',
    })),
  };
}
