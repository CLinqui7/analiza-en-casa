import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { catalogItemSchema, type CatalogItem } from '@analiza/contracts';
import { Client } from 'pg';
import readWorkbook from 'read-excel-file/node';
import { z } from 'zod';

type SourceRecord = {
  sheet: string;
  row: number;
  category: NonNullable<CatalogItem['category']>;
  name: string;
  salePrice?: number;
  provider?: readonly unknown[];
};

const sourcePath = process.argv.find((argument) => argument.toLowerCase().endsWith('.xlsx'));
assert.ok(sourcePath, 'Indique el archivo ITEMS A GENERAR AUTOMATICAMENTE EN SISTEMA.xlsx.');
const apply = process.argv.includes('--apply');
if (apply) {
  assert.equal(process.env.ANALIZA_CATALOG_IMPORT_APPROVED, '1');
  assert.equal(process.env.ANALIZA_MANAGED_POSTGRES, 'neon');
}
const databaseUrl = process.env.DATABASE_URL_UNPOOLED;
assert.ok(databaseUrl && new URL(databaseUrl).hostname.endsWith('.neon.tech'));

const sourceBytes = await readFile(sourcePath);
const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
const sheets = await readWorkbook(sourceBytes);
const sheetMap = new Map(sheets.map((sheet) => [sheet.sheet, sheet.data]));
assert.deepEqual(
  [...sheetMap.keys()],
  ['SERVICIOS', 'INSUMOS', 'MEDICAMENTOS', 'EQUIPO E INSTRUMENTAL', 'PROVEEDORES'],
  'El archivo no tiene las cinco hojas esperadas.',
);

const normalizeName = (name: string) =>
  name
    .toUpperCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const amount = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100_000_000
    ? Number(value.toFixed(5))
    : undefined;

const records: SourceRecord[] = [];
const counts: Record<string, number> = {};
for (const [sheet, category, firstRow, expected] of [
  ['SERVICIOS', 'SERVICES', 2, 47],
  ['INSUMOS', 'SUPPLIES', 3, 156],
  ['MEDICAMENTOS', 'MEDICATIONS', 3, 99],
  ['EQUIPO E INSTRUMENTAL', 'EQUIPMENT', 3, 94],
  ['PROVEEDORES', 'PROVIDERS', 3, 150],
] as const) {
  const rows = sheetMap.get(sheet);
  assert.ok(rows);
  let count = 0;
  for (let index = firstRow - 1; index < rows.length; index++) {
    const cells = rows[index] ?? [];
    const name = text(cells[1]);
    if (!name) continue;
    // The services sheet repeats text-only section headings in the price columns.
    if (sheet === 'SERVICIOS' && typeof cells[3] !== 'number') continue;
    const salePrice = sheet === 'SERVICIOS' ? amount(cells[3]) : undefined;
    records.push({
      sheet,
      row: index + 1,
      category,
      name,
      salePrice,
      provider: sheet === 'PROVEEDORES' ? cells : undefined,
    });
    count++;
  }
  assert.equal(count, expected, `Cantidad inesperada de registros en ${sheet}.`);
  counts[sheet] = count;
}
assert.equal(records.length, 546);
const sourceKeys = new Set<string>();
for (const record of records) {
  const key = `${record.category}:${normalizeName(record.name)}`;
  assert.ok(
    !sourceKeys.has(key),
    `Nombre duplicado en el archivo: ${record.sheet}, fila ${record.row}.`,
  );
  sourceKeys.add(key);
}

const prefixes: Record<string, string> = {
  SERVICES: 'SER',
  SUPPLIES: 'INS',
  MEDICATIONS: 'MED',
  EQUIPMENT: 'EQU',
  PROVIDERS: 'PRO',
};
const sourceNote = (record: SourceRecord) => {
  const details = [`Origen: ${basename(sourcePath)}, hoja ${record.sheet}, fila ${record.row}.`];
  if (record.category !== 'PROVIDERS' && record.salePrice === undefined)
    details.push('Pendiente de precio de venta sin IVA.');
  if (record.provider) {
    const labels = [
      [2, 'NIT/DUI'],
      [3, 'Registro NCR/IVA'],
      [4, 'Giro'],
      [5, 'Dirección'],
      [6, 'Teléfono'],
      [7, 'Correo'],
      [8, 'Ejecutivo de venta'],
      [9, 'Condición de pago'],
    ] as const;
    for (const [index, label] of labels) {
      const value = text(record.provider[index]);
      if (value) details.push(`${label}: ${value}.`);
    }
  }
  return details.join(' ').slice(0, 2000);
};

const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: true },
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
});
try {
  await client.connect();
  if (apply) {
    await client.query('BEGIN');
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('analiza:catalog-import',0))",
    );
  }
  const memberships = await client.query<{ organization_id: string; user_id: string }>(
    `SELECT m.organization_id,u.id AS user_id
     FROM analiza.users u JOIN analiza.memberships m ON m.user_id=u.id
     WHERE u.email_normalized=$1 AND m.role='ADMIN' AND m.active AND u.disabled_at IS NULL`,
    ['linquicarloss@gmail.com'],
  );
  assert.equal(
    memberships.rowCount,
    1,
    'No se encontró una única organización ADMIN del propietario.',
  );
  const { organization_id: organizationId, user_id: actorId } = memberships.rows[0];
  assert.equal(
    organizationId,
    'analiza-main',
    'La organización no es la base compartida esperada.',
  );
  await client.query("SELECT set_config('analiza.organization_id',$1,true)", [organizationId]);
  const existing = await client.query<{ id: string; body: CatalogItem }>(
    'SELECT id,body FROM analiza.catalog_items WHERE organization_id=$1',
    [organizationId],
  );
  const byName = new Map<string, CatalogItem[]>();
  const skus = new Set<string>();
  for (const { body } of existing.rows) {
    const key = `${body.category}:${normalizeName(body.name)}`;
    byName.set(key, [...(byName.get(key) ?? []), body]);
    skus.add(body.sku.toUpperCase());
  }

  const toCreate: CatalogItem[] = [];
  const toUpdate: { item: CatalogItem; source: SourceRecord }[] = [];
  const priceChanges: { name: string; previous: number | null; supplied: number }[] = [];
  const ambiguousMatches: { sheet: string; row: number; name: string; existingSkus: string[] }[] =
    [];
  let matched = 0;
  let pendingPrices = 0;
  for (const source of records) {
    const key = `${source.category}:${normalizeName(source.name)}`;
    const matches = byName.get(key) ?? [];
    if (source.category !== 'PROVIDERS' && source.salePrice === undefined) pendingPrices++;
    if (matches.length) {
      matched++;
      if (matches.length > 1) {
        // Existing duplicates with different prices cannot be merged safely.
        ambiguousMatches.push({
          sheet: source.sheet,
          row: source.row,
          name: source.name,
          existingSkus: matches.map((item) => item.sku),
        });
        continue;
      }
      const item = matches[0];
      // Prices in the new file are explicitly sale prices excluding VAT.
      if (source.salePrice !== undefined && item.salePriceExcludingTax !== source.salePrice) {
        toUpdate.push({ item, source });
        priceChanges.push({
          name: source.name,
          previous: item.salePriceExcludingTax ?? null,
          supplied: source.salePrice,
        });
      }
      continue;
    }
    const sku = `XLS-${prefixes[source.category]}-${String(source.row).padStart(4, '0')}`;
    assert.ok(!skus.has(sku.toUpperCase()), `Código existente con otro nombre: ${sku}.`);
    skus.add(sku.toUpperCase());
    const providerEmail = source.provider ? text(source.provider[7]) : '';
    const providerPhone = source.provider ? text(source.provider[6]) : '';
    const body = catalogItemSchema.strict().parse({
      id: randomUUID(),
      sku,
      name: source.name,
      category: source.category,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      notes: sourceNote(source),
      ...(source.salePrice === undefined ? {} : { salePriceExcludingTax: source.salePrice }),
      ...(providerPhone && providerPhone.length <= 50 ? { landlinePhone: providerPhone } : {}),
      ...(providerEmail && z.email().safeParse(providerEmail).success
        ? { email: providerEmail }
        : {}),
    });
    toCreate.push(body);
    byName.set(key, [body]);
  }

  const summary = {
    operation: apply ? 'APPLIED' : 'PLAN_ONLY',
    sourceSha256,
    counts,
    matched,
    created: toCreate.length,
    updatedPrices: toUpdate.length,
    pendingPrices,
    ambiguousMatches,
    priceChanges: priceChanges.filter(
      ({ previous, supplied }) => previous !== null && Math.abs(previous - supplied) > 0.01,
    ),
  };
  if (!apply) {
    console.log(JSON.stringify(summary));
  } else {
    for (const item of toCreate) {
      await client.query(
        'INSERT INTO analiza.catalog_items(organization_id,id,body) VALUES($1,$2,$3::jsonb)',
        [organizationId, item.id, JSON.stringify(item)],
      );
    }
    for (const { item, source } of toUpdate) {
      await client.query(
        'UPDATE analiza.catalog_items SET body=$3::jsonb WHERE organization_id=$1 AND id=$2',
        [
          organizationId,
          item.id,
          JSON.stringify({ ...item, salePriceExcludingTax: source.salePrice }),
        ],
      );
    }
    await client.query(
      `INSERT INTO analiza.audit_events
       (organization_id,id,actor_user_id,action,resource_type,resource_id)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [
        organizationId,
        randomUUID(),
        actorId,
        'CATALOG_SOURCE_IMPORTED',
        'catalog_items',
        sourceSha256,
      ],
    );
    await client.query('COMMIT');
    console.log(JSON.stringify(summary));
  }
} catch (error) {
  if (apply) await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end().catch(() => {});
}
