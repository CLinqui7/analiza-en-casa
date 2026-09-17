import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  importDatasetDefinitions,
  type ImportDataset,
  type ImportIssue,
  type ImportOverview,
  type ImportPreview,
  type ParsedImportRecord,
  type ParsedWorkbookImport,
} from '@/lib/information-import';
import { parseInformationWorkbook } from '@/server/information-import-parser';
import { MongoAccessError, MongoInputError, type ServerActor } from '@/server/validation/patients';
import { transaction } from './postgres-pool';

const referenceRules: ReadonlyArray<readonly [ImportDataset, string, ImportDataset, string]> = [
  ['PRODUCTS', 'proveedor_preferido_id', 'SUPPLIERS', 'El proveedor preferido no existe.'],
  ['RATES', 'servicio_id', 'SERVICES', 'El servicio no existe.'],
  ['RATES', 'seguro_id', 'INSURERS', 'El seguro no existe.'],
  ['RATES', 'proveedor_id', 'SUPPLIERS', 'El proveedor no existe.'],
  ['SUPPLIER_PURCHASES', 'producto_id', 'PRODUCTS', 'El producto no existe.'],
  ['SUPPLIER_PURCHASES', 'proveedor_id', 'SUPPLIERS', 'El proveedor no existe.'],
];

function requireAdministrator(actor: ServerActor) {
  if (actor.role !== 'ADMIN') throw new MongoAccessError();
}

function recordKey(dataset: ImportDataset, id: string) {
  return `${dataset}:${id.toUpperCase()}`;
}

async function currentKeys(client: PoolClient, organizationId: string) {
  const rows = (
    await client.query<{ dataset: ImportDataset; record_id: string }>(
      'SELECT dataset,record_id FROM analiza.import_records WHERE organization_id=$1',
      [organizationId],
    )
  ).rows;
  return new Set(rows.map((row) => recordKey(row.dataset, row.record_id)));
}

function appendReferenceIssues(
  parsed: ParsedWorkbookImport,
  keys: ReadonlySet<string>,
): ImportIssue[] {
  const issues = [...parsed.issues];
  const available = new Set(keys);
  for (const record of parsed.records) {
    if (record.id) available.add(recordKey(record.dataset, record.id));
  }
  for (const [dataset, column, target, message] of referenceRules) {
    for (const record of parsed.records.filter((candidate) => candidate.dataset === dataset)) {
      const value = record.values[column];
      if (value === null || value === '') continue;
      const referencedId = String(value);
      if (!available.has(recordKey(target, referencedId))) {
        issues.push({ sheet: record.sheet, row: record.row, column, message });
      }
    }
  }
  return issues.slice(0, 200);
}

function previewFromParsed(
  parsed: ParsedWorkbookImport,
  existing: ReadonlySet<string>,
): ImportPreview {
  const issues = appendReferenceIssues(parsed, existing);
  const sheets = importDatasetDefinitions.map((definition) => {
    const records = parsed.records.filter((record) => record.dataset === definition.dataset);
    const updates = records.filter((record) =>
      existing.has(recordKey(record.dataset, record.id)),
    ).length;
    return {
      dataset: definition.dataset,
      label: definition.label,
      rows: records.length,
      creates: records.length - updates,
      updates,
      samples: records.slice(0, 3).map((record) => record.values),
    };
  });
  const totalRows = parsed.records.length;
  const updates = sheets.reduce((sum, sheet) => sum + sheet.updates, 0);
  return {
    fileName: parsed.fileName,
    totalRows,
    creates: totalRows - updates,
    updates,
    ready: totalRows > 0 && issues.length === 0,
    sheets,
    issues,
  };
}

function importedCounts(records: ParsedImportRecord[]) {
  return Object.fromEntries(
    importDatasetDefinitions.map(({ dataset }) => [
      dataset,
      records.filter((record) => record.dataset === dataset).length,
    ]),
  );
}

export class PostgresInformationImportRepository {
  constructor(private readonly pool: Pool) {}

  async overview(actor: ServerActor): Promise<ImportOverview> {
    requireAdministrator(actor);
    return transaction(this.pool, actor, async (client) => {
      const recordRows = (
        await client.query<{ dataset: ImportDataset; count: number }>(
          `SELECT dataset,count(*)::int AS count
           FROM analiza.import_records WHERE organization_id=$1 GROUP BY dataset`,
          [actor.organizationId],
        )
      ).rows;
      const batches = (
        await client.query<{
          id: string;
          file_name: string;
          imported_by: string;
          imported_at: Date;
          total_rows: number;
          counts: Partial<Record<ImportDataset, number>>;
        }>(
          `SELECT batch.id,batch.file_name,
           coalesce(nullif(account.display_name,''),account.email_normalized) AS imported_by,
           batch.imported_at,batch.total_rows,batch.counts
           FROM analiza.import_batches batch
           JOIN analiza.users account ON account.id=batch.imported_by
           WHERE batch.organization_id=$1 ORDER BY batch.imported_at DESC LIMIT 20`,
          [actor.organizationId],
        )
      ).rows;
      return {
        records: Object.fromEntries(recordRows.map((row) => [row.dataset, row.count])),
        batches: batches.map((batch) => ({
          id: batch.id,
          fileName: batch.file_name,
          importedBy: batch.imported_by,
          importedAt: batch.imported_at.toISOString(),
          totalRows: batch.total_rows,
          counts: batch.counts,
        })),
      };
    });
  }

  async preview(actor: ServerActor, fileName: string, bytes: Uint8Array): Promise<ImportPreview> {
    requireAdministrator(actor);
    const parsed = await parseInformationWorkbook(fileName, bytes);
    return transaction(this.pool, actor, async (client) =>
      previewFromParsed(parsed, await currentKeys(client, actor.organizationId)),
    );
  }

  async commit(actor: ServerActor, fileName: string, bytes: Uint8Array): Promise<ImportOverview> {
    requireAdministrator(actor);
    const parsed = await parseInformationWorkbook(fileName, bytes);
    return transaction(this.pool, actor, async (client) => {
      const preview = previewFromParsed(parsed, await currentKeys(client, actor.organizationId));
      if (!preview.ready) {
        throw new MongoInputError(
          preview.issues[0]?.message ?? 'La plantilla no contiene registros válidos.',
        );
      }
      const batchId = randomUUID();
      const counts = importedCounts(parsed.records);
      await client.query(
        `INSERT INTO analiza.import_batches
         (organization_id,id,file_name,imported_by,total_rows,counts)
         VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
        [
          actor.organizationId,
          batchId,
          fileName,
          actor.userId,
          parsed.records.length,
          JSON.stringify(counts),
        ],
      );
      await client.query(
        `INSERT INTO analiza.import_records
         (organization_id,dataset,record_id,batch_id,source_sheet,source_row,body,imported_by)
         SELECT $1,row.dataset,row.record_id,$2,row.source_sheet,row.source_row,row.body,row.imported_by
         FROM jsonb_to_recordset($3::jsonb) AS row(
           dataset text,record_id text,source_sheet text,source_row integer,body jsonb,imported_by text
         )
         ON CONFLICT(organization_id,dataset,record_id) DO UPDATE SET
           batch_id=EXCLUDED.batch_id,source_sheet=EXCLUDED.source_sheet,
           source_row=EXCLUDED.source_row,body=EXCLUDED.body,
           imported_by=EXCLUDED.imported_by,updated_at=now()`,
        [
          actor.organizationId,
          batchId,
          JSON.stringify(
            parsed.records.map((record) => ({
              dataset: record.dataset,
              record_id: record.id,
              source_sheet: record.sheet,
              source_row: record.row,
              body: record.values,
              imported_by: actor.userId,
            })),
          ),
        ],
      );

      const products = parsed.records
        .filter((record) => record.dataset === 'PRODUCTS')
        .map((record) => ({
          id: record.id,
          sku: String(record.values.sku_codigo || record.id),
          name: String(record.values.nombre_producto),
          status: String(record.values.estatus).toLowerCase() === 'activo' ? 'ACTIVE' : 'INACTIVE',
          createdAt: new Date().toISOString(),
        }));
      if (products.length) {
        await client.query(
          `INSERT INTO analiza.catalog_items(organization_id,id,body)
           SELECT $1,item.id,item.body
           FROM jsonb_to_recordset($2::jsonb) AS item(id text,body jsonb)
           ON CONFLICT(organization_id,id) DO UPDATE SET body=EXCLUDED.body`,
          [
            actor.organizationId,
            JSON.stringify(products.map((product) => ({ id: product.id, body: product }))),
          ],
        );
      }

      await client.query(
        'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
        [
          actor.organizationId,
          randomUUID(),
          actor.userId,
          'information.imported',
          'import_batches',
          batchId,
        ],
      );

      const recordRows = (
        await client.query<{ dataset: ImportDataset; count: number }>(
          `SELECT dataset,count(*)::int AS count
           FROM analiza.import_records WHERE organization_id=$1 GROUP BY dataset`,
          [actor.organizationId],
        )
      ).rows;
      return {
        records: Object.fromEntries(recordRows.map((row) => [row.dataset, row.count])),
        batches: [
          {
            id: batchId,
            fileName,
            importedBy: actor.userId,
            importedAt: new Date().toISOString(),
            totalRows: parsed.records.length,
            counts,
          },
        ],
      };
    });
  }
}
