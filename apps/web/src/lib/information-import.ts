import { z } from 'zod';

export const importDatasetDefinitions = [
  {
    dataset: 'SERVICES',
    sheet: 'Servicios',
    label: 'Servicios',
    idColumn: 'servicio_id',
    required: ['servicio_id', 'nombre_servicio', 'categoria', 'unidad_cobro', 'estatus'],
  },
  {
    dataset: 'SUPPLIERS',
    sheet: 'Proveedores',
    label: 'Proveedores',
    idColumn: 'proveedor_id',
    required: ['proveedor_id', 'nombre_proveedor', 'tipo_proveedor', 'estatus'],
  },
  {
    dataset: 'INSURERS',
    sheet: 'Seguros',
    label: 'Seguros',
    idColumn: 'seguro_id',
    required: ['seguro_id', 'aseguradora', 'plan_poliza', 'estatus'],
  },
  {
    dataset: 'PRODUCTS',
    sheet: 'Productos',
    label: 'Productos',
    idColumn: 'producto_id',
    required: ['producto_id', 'nombre_producto', 'tipo_producto', 'unidad_medida', 'estatus'],
  },
  {
    dataset: 'RATES',
    sheet: 'Tarifas_Coberturas',
    label: 'Tarifas y coberturas',
    idColumn: 'tarifa_id',
    required: [
      'tarifa_id',
      'servicio_id',
      'precio_convenio',
      'vigencia_desde',
      'vigencia_hasta',
      'estatus',
    ],
  },
  {
    dataset: 'SUPPLIER_PURCHASES',
    sheet: 'Compras_Proveedor',
    label: 'Compras por proveedor',
    idColumn: 'compra_id',
    required: ['compra_id', 'producto_id', 'proveedor_id', 'costo_unitario', 'estatus'],
  },
  {
    dataset: 'STAFF',
    sheet: 'Personal',
    label: 'Personal',
    idColumn: 'personal_id',
    required: ['personal_id', 'nombre_completo', 'funcion', 'estatus'],
  },
] as const;

export type ImportDataset = (typeof importDatasetDefinitions)[number]['dataset'];
export type ImportCellValue = string | number | boolean | null;
export type ImportedValues = Record<string, ImportCellValue>;

export const importDatasets = importDatasetDefinitions.map(({ dataset }) => dataset);
export const importDatasetSchema = z.enum(importDatasets);

const importCellValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const importedValuesSchema = z.record(z.string(), importCellValueSchema);
const importIssueSchema = z.object({
  sheet: z.string(),
  row: z.number().int().nonnegative(),
  column: z.string().optional(),
  message: z.string(),
});

export type ImportIssue = Readonly<{
  sheet: string;
  row: number;
  column?: string;
  message: string;
}>;

export type ImportPreviewSheet = Readonly<{
  dataset: ImportDataset;
  label: string;
  rows: number;
  creates: number;
  updates: number;
  samples: ImportedValues[];
}>;

export type ImportPreview = Readonly<{
  fileName: string;
  totalRows: number;
  creates: number;
  updates: number;
  ready: boolean;
  sheets: ImportPreviewSheet[];
  issues: ImportIssue[];
}>;

export type ImportBatchSummary = Readonly<{
  id: string;
  fileName: string;
  importedBy: string;
  importedAt: string;
  totalRows: number;
  counts: Partial<Record<ImportDataset, number>>;
}>;

export type ImportOverview = Readonly<{
  records: Partial<Record<ImportDataset, number>>;
  batches: ImportBatchSummary[];
}>;

export const importPreviewSchema = z.object({
  fileName: z.string(),
  totalRows: z.number().int().nonnegative(),
  creates: z.number().int().nonnegative(),
  updates: z.number().int().nonnegative(),
  ready: z.boolean(),
  sheets: z.array(
    z.object({
      dataset: importDatasetSchema,
      label: z.string(),
      rows: z.number().int().nonnegative(),
      creates: z.number().int().nonnegative(),
      updates: z.number().int().nonnegative(),
      samples: z.array(importedValuesSchema),
    }),
  ),
  issues: z.array(importIssueSchema),
});

export const importOverviewSchema = z.object({
  records: z.partialRecord(importDatasetSchema, z.number().int().nonnegative()),
  batches: z.array(
    z.object({
      id: z.string(),
      fileName: z.string(),
      importedBy: z.string(),
      importedAt: z.string(),
      totalRows: z.number().int().positive(),
      counts: z.partialRecord(importDatasetSchema, z.number().int().nonnegative()),
    }),
  ),
});

export type ParsedImportRecord = Readonly<{
  dataset: ImportDataset;
  id: string;
  sheet: string;
  row: number;
  values: ImportedValues;
}>;

export type ParsedWorkbookImport = Readonly<{
  fileName: string;
  records: ParsedImportRecord[];
  issues: ImportIssue[];
}>;
