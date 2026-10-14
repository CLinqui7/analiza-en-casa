import { createHash } from 'node:crypto';
import type { ImportDataset, ImportedValues, ParsedImportRecord } from '@/lib/information-import';

type Sheet = Readonly<{ sheet: string; data: unknown[][] }>;
const sheetDatasets: Record<string, ImportDataset> = {
  SERVICIOS: 'SERVICES',
  INSUMOS: 'PRODUCTS',
  MEDICAMENTOS: 'PRODUCTS',
  'EQUIPO E INSTRUMENTAL': 'PRODUCTS',
  PROVEEDORES: 'SUPPLIERS',
};
const normalized = (value: unknown) =>
  String(value ?? '')
    .trim()
    .normalize('NFC');
const cell = (value: unknown): string | number | null => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return normalized(value) || null;
};

/** Stable identity uses the declared source entity, never its row number or filename. */
export function officialCatalogId(sheet: string, name: string, taxId?: unknown) {
  const identity = [sheet, normalized(name).toLocaleLowerCase('es-SV'), normalized(taxId)].join(
    '\0',
  );
  return `official-${createHash('sha256').update(identity).digest('hex').slice(0, 32)}`;
}

/** Approved catalog candidates stay inactive until missing commercial fields are confirmed. */
export function parseOfficialCatalogSheets(sheets: readonly Sheet[]): ParsedImportRecord[] | null {
  if (!Object.keys(sheetDatasets).every((name) => sheets.some((sheet) => sheet.sheet === name)))
    return null;
  const records: ParsedImportRecord[] = [];
  for (const { sheet, data } of sheets) {
    const dataset = sheetDatasets[sheet];
    if (!dataset) continue;
    let group: string | null = null;
    for (let index = 0; index < data.length; index++) {
      const row = data[index];
      if (normalized(row[0]).toUpperCase() === 'ITEM ID AUTOMATICO') {
        group = normalized(row[1]);
        continue;
      }
      if (!group || !normalized(row[1])) continue;
      const name = normalized(row[1]);
      const id = officialCatalogId(sheet, name, dataset === 'SUPPLIERS' ? row[2] : undefined);
      const source: ImportedValues = Object.fromEntries(
        row.map((value, i) => [`source_column_${i + 1}`, cell(value)]),
      );
      const values: ImportedValues = {
        ...source,
        estatus: 'En revision',
        source_classification: 'APPROVED_BUSINESS_CATALOG',
        source_group: group,
        review_reason: 'Confirmar campos comerciales y vigencia antes de activar.',
      };
      if (dataset === 'SERVICES')
        Object.assign(values, {
          servicio_id: id,
          nombre_servicio: name,
          categoria: group,
          descripcion: null,
          unidad_cobro: null,
          precio_base: cell(row[3]),
          moneda: null,
          // Source zeros are retained as evidence, not asserted as confirmed real costs.
          costo_unitario: typeof row[2] === 'number' && row[2] > 0 ? row[2] : null,
        });
      if (dataset === 'PRODUCTS')
        Object.assign(values, {
          producto_id: id,
          nombre_producto: name,
          tipo_producto:
            sheet === 'INSUMOS'
              ? 'Insumo medico'
              : sheet === 'MEDICAMENTOS'
                ? 'Medicamento'
                : 'Equipo',
          unidad_medida: null,
          costo_unitario: null,
          precio_venta: null,
          moneda: null,
          principio_activo: sheet === 'MEDICAMENTOS' ? cell(row[2]) : null,
          marca_laboratorio:
            sheet === 'MEDICAMENTOS'
              ? cell(row[4])
              : sheet === 'EQUIPO E INSTRUMENTAL'
                ? cell(row[3])
                : null,
          concentracion: sheet === 'MEDICAMENTOS' ? cell(row[5]) : null,
          presentacion: sheet === 'MEDICAMENTOS' ? cell(row[6]) : null,
          via_administracion: sheet === 'MEDICAMENTOS' ? cell(row[7]) : null,
        });
      if (dataset === 'SUPPLIERS')
        Object.assign(values, {
          proveedor_id: id,
          nombre_proveedor: name,
          tipo_proveedor: null,
          ruc_nit: cell(row[2]),
          registro_fiscal: cell(row[3]),
          especialidad: cell(row[4]),
          direccion: cell(row[5]),
          telefono: cell(row[6]),
          email: cell(row[7]),
          contacto_principal: cell(row[8]),
          condicion_pago: cell(row[9]),
        });
      records.push({ dataset, id, sheet, row: index + 1, values });
    }
  }
  return records;
}
