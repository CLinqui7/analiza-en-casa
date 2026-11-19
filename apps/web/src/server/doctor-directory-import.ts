import { createHash } from 'node:crypto';
import { doctorSchema, type Doctor } from '@analiza/contracts';
import type { DoctorSnapshot } from './doctor-import-preflight';

export const directoryHeaders = [
  '#',
  'Nombre',
  'Especialidad',
  'JVPM',
  'CONADEM',
  'Teléfono',
  'Celular',
  'Nombre de la cliníca',
  'Dirección',
  'Ciudad',
  'Departamento',
  'Correo electrónico',
];
type Cell = string | number | boolean | Date | null;
export type DirectorySource = { sha256: string; sheet: string; rows: Cell[][] };
export type DirectoryOptions = { allowIncompleteHistorical: boolean };
export type DirectoryRecord = { row: number; sourceId: string; values: string[] };
type Location = NonNullable<Doctor['practiceLocations']>[number];
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonicalJson(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export const directoryHash = (value: unknown) =>
  createHash('sha256').update(canonicalJson(value)).digest('hex');
export const doctorSnapshotHash = (snapshot: DoctorSnapshot) =>
  directoryHash({
    organizationId: snapshot.organizationId,
    doctors: [...snapshot.doctors].sort((a, b) => a.doctor.id.localeCompare(b.doctor.id)),
  });
const norm = (value: string | undefined) =>
  (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const nameKey = (value: string) => norm(value.replace(/^(?:dr\.?|dra\.?|doctor|doctora)\s+/i, ''));
const text = (cell: Cell | undefined): string => {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'number' && (!Number.isSafeInteger(cell) || cell < 0))
    throw new Error('Número de origen no representable sin pérdida.');
  if (typeof cell !== 'string' && typeof cell !== 'number')
    throw new Error('Tipo de celda no permitido en el directorio.');
  const value = String(cell).replace(/\r\n?/g, '\n').trim();
  if (value.length > 4000) throw new Error('Celda demasiado larga.');
  return value;
};
const distinct = (values: string[]) =>
  values.filter((v, i, all) => v && all.findIndex((x) => norm(x) === norm(v)) === i);
const first = (rows: DirectoryRecord[], column: number) =>
  rows.map((r) => r.values[column]).find(Boolean);
function locations(rows: DirectoryRecord[]): Location[] {
  const found = new Map<string, Location>();
  for (const { values: v } of rows) {
    const fields = Object.fromEntries(
      Object.entries({
        specialty: v[2],
        landlinePhone: v[5],
        phone: v[6],
        clinicName: v[7],
        address: v[8],
        city: v[9],
        department: v[10],
        email: v[11],
      }).filter(([, value]) => value),
    );
    const id = 'practice-' + directoryHash(fields).slice(0, 24);
    found.set(id, { id, ...fields });
  }
  return [...found.values()];
}
function samePerson(source: Doctor, existing: Doctor) {
  if (nameKey(source.fullName) !== nameKey(existing.fullName)) return false;
  for (const key of ['jvpm', 'conadem'] as const)
    if (source[key] && existing[key] && norm(source[key]) !== norm(existing[key])) return false;
  return (['jvpm', 'conadem', 'email', 'phone'] as const).some(
    (key) => source[key] && existing[key] && norm(source[key]) === norm(existing[key]),
  );
}
function possibleMatch(source: Doctor, existing: Doctor) {
  return (
    nameKey(source.fullName) === nameKey(existing.fullName) ||
    (['jvpm', 'conadem'] as const).some(
      (key) => source[key] && existing[key] && norm(source[key]) === norm(existing[key]),
    )
  );
}

/** Explicit historical-directory path; interactive create/edit validation is unchanged. */
export function planDoctorDirectory(
  source: DirectorySource,
  snapshot: DoctorSnapshot,
  options: DirectoryOptions,
) {
  if (
    !/^[a-f0-9]{64}$/.test(source.sha256) ||
    !source.sheet.trim() ||
    !snapshot.organizationId.trim()
  )
    throw new Error('Falta procedencia u organización.');
  if (
    source.rows[0]?.length !== directoryHeaders.length ||
    source.rows[0].some((v, i) => norm(text(v)) !== norm(directoryHeaders[i]))
  )
    throw new Error('Los encabezados no corresponden al directorio autorizado.');
  const records: DirectoryRecord[] = source.rows.slice(1).flatMap((row, i) => {
    if (!row.some((v) => v !== null && v !== undefined && String(v).trim())) return [];
    if (row.slice(12).some((v) => v !== null && v !== undefined && String(v).trim()))
      throw new Error('Hay columnas adicionales sin correspondencia.');
    const values = directoryHeaders.map((_, c) => text(row[c]));
    if (!values[0] || !values[1] || !values[2])
      throw new Error('Falta ID de origen, nombre o especialidad.');
    if (values[11] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[11]))
      throw new Error('Correo del origen pendiente de revisión.');
    return [{ row: i + 2, sourceId: values[0], values }];
  });
  if (
    !records.length ||
    records.length > 2000 ||
    new Set(records.map((r) => r.sourceId)).size !== records.length
  )
    throw new Error('El lote requiere entre 1 y 2.000 IDs de origen únicos.');
  const existing = snapshot.doctors.map((e) => {
    if (!Number.isInteger(e.version) || e.version < 1)
      throw new Error('Versión de conciliación inválida.');
    return { doctor: doctorSchema.parse(e.doctor), version: e.version };
  });
  const groups = new Map<string, DirectoryRecord[]>();
  const identifierNames = new Map<string, Set<string>>();
  for (const record of records) {
    const key = nameKey(record.values[1]);
    if (!key) throw new Error('Nombre sin identidad comparable.');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record);
    for (const column of [3, 4])
      if (record.values[column]) {
        const id = column + ':' + norm(record.values[column]);
        if (!identifierNames.has(id)) identifierNames.set(id, new Set());
        identifierNames.get(id)!.add(key);
      }
  }
  const held: { rows: number[]; reason: string }[] = [];
  const actions: {
    kind: 'INSERT' | 'ENRICH' | 'UNCHANGED';
    doctor: Doctor;
    before?: Doctor;
    expectedVersion?: number;
    sourceRows: number[];
    warnings: string[];
  }[] = [];
  for (const [key, rows] of groups) {
    const sourceRows = rows.map((r) => r.row);
    const conflicting = [3, 4].some(
      (c) =>
        distinct(rows.map((r) => r.values[c])).length > 1 ||
        rows.some((r) => r.values[c] && identifierNames.get(c + ':' + norm(r.values[c]))!.size > 1),
    );
    if (conflicting) {
      held.push({ rows: sourceRows, reason: 'Identificadores profesionales contradictorios.' });
      continue;
    }
    // Matching names alone cannot merge people lacking professional IDs or shared contact.
    if (
      rows.length > 1 &&
      ![3, 4, 6, 11].some((c) =>
        rows.every((r) => r.values[c] && norm(r.values[c]) === norm(rows[0].values[c])),
      )
    ) {
      held.push({
        rows: sourceRows,
        reason: 'Nombre repetido sin un identificador o contacto común.',
      });
      continue;
    }
    const practiceLocations = locations(rows);
    const candidate = doctorSchema.parse({
      id:
        'import-doctor-' +
        directoryHash([snapshot.organizationId, source.sha256, key]).slice(0, 32),
      fullName: rows[0].values[1],
      specialty: distinct(rows.map((r) => r.values[2])).join('; '),
      jvpm: first(rows, 3),
      conadem: first(rows, 4),
      landlinePhone: first(rows, 5),
      phone: first(rows, 6),
      clinicName: first(rows, 7),
      address: first(rows, 8),
      email: first(rows, 11),
      zone: [first(rows, 9), first(rows, 10)].filter(Boolean).join(' · '),
      practiceLocations,
      attachments: [],
    });
    const matches = existing.filter((e) => possibleMatch(candidate, e.doctor));
    if (matches.length > 1 || (matches.length === 1 && !samePerson(candidate, matches[0].doctor))) {
      held.push({
        rows: sourceRows,
        reason: 'Coincidencia existente no inequívoca; no se sobrescribe.',
      });
      continue;
    }
    const previous = matches[0];
    let doctor = candidate;
    if (previous) {
      const merged = { ...previous.doctor };
      for (const [field, value] of Object.entries(candidate)) {
        if (['id', 'attachments', 'practiceLocations'].includes(field)) continue;
        if (!(merged as Record<string, unknown>)[field])
          (merged as Record<string, unknown>)[field] = value;
      }
      const entries = new Map(
        (previous.doctor.practiceLocations ?? []).map((location) => [location.id, location]),
      );
      for (const location of practiceLocations) {
        const sameId = entries.get(location.id);
        if (sameId && canonicalJson(sameId) !== canonicalJson(location))
          throw new Error('Una ubicación cambió con el mismo ID.');
        entries.set(location.id, location);
      }
      doctor = doctorSchema.parse({ ...merged, practiceLocations: [...entries.values()] });
    }
    const warnings: string[] = [];
    if (!doctor.referralCategory) warnings.push('RELACION_PENDIENTE');
    if (!doctor.landlinePhone) warnings.push('TELEFONO_FIJO_PENDIENTE');
    if (doctor.jvpm && doctor.conadem && norm(doctor.jvpm) === norm(doctor.conadem))
      warnings.push('MISMO_IDENTIFICADOR_EN_JVPM_Y_CONADEM_REVISAR_FUENTE');
    if (!options.allowIncompleteHistorical && warnings.some((w) => w.endsWith('_PENDIENTE'))) {
      held.push({
        rows: sourceRows,
        reason: 'Datos obligatorios pendientes; falta autorización de carga histórica.',
      });
      continue;
    }
    actions.push({
      kind: previous
        ? canonicalJson(previous.doctor) === canonicalJson(doctor)
          ? 'UNCHANGED'
          : 'ENRICH'
        : 'INSERT',
      doctor,
      before: previous?.doctor,
      expectedVersion: previous?.version,
      sourceRows,
      warnings,
    });
  }
  if (new Set(actions.map((a) => a.doctor.id)).size !== actions.length)
    throw new Error('Dos grupos intentan actualizar el mismo médico.');
  return {
    version: 1,
    sourceSha256: source.sha256,
    sourceSheet: source.sheet,
    organizationId: snapshot.organizationId,
    snapshotSha256: doctorSnapshotHash(snapshot),
    options,
    records,
    actions,
    held,
    summary: {
      sourceRows: records.length,
      profiles: actions.length,
      insert: actions.filter((a) => a.kind === 'INSERT').length,
      enrich: actions.filter((a) => a.kind === 'ENRICH').length,
      unchanged: actions.filter((a) => a.kind === 'UNCHANGED').length,
      heldRows: held.reduce((n, h) => n + h.rows.length, 0),
      consolidatedRows:
        records.length - held.reduce((n, h) => n + h.rows.length, 0) - actions.length,
      incompleteProfiles: actions.filter((a) => a.warnings.some((w) => w.endsWith('_PENDIENTE')))
        .length,
    },
  };
}
export type DoctorDirectoryPlan = ReturnType<typeof planDoctorDirectory>;
