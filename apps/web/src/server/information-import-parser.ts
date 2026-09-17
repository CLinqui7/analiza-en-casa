import readWorkbook from 'read-excel-file/node';
import {
  importDatasetDefinitions,
  type ImportCellValue,
  type ImportIssue,
  type ImportedValues,
  type ParsedImportRecord,
  type ParsedWorkbookImport,
} from '@/lib/information-import';

const MAX_IMPORT_ROWS = 2_000;
const MAX_ISSUES = 200;

const expectedHeaders: Record<(typeof importDatasetDefinitions)[number]['dataset'], string[]> = {
  SERVICES: [
    'servicio_id',
    'nombre_servicio',
    'categoria',
    'descripcion',
    'unidad_cobro',
    'duracion_minutos',
    'precio_base',
    'moneda',
    'requiere_autorizacion',
    'requiere_orden_medica',
    'aplica_a',
    'estatus',
    'notas',
    'validacion_minima',
  ],
  SUPPLIERS: [
    'proveedor_id',
    'nombre_proveedor',
    'tipo_proveedor',
    'estatus',
    'contacto_principal',
    'telefono',
    'email',
    'direccion',
    'ciudad',
    'pais',
    'ruc_nit',
    'especialidad',
    'horario_atencion',
    'contrato_vigente',
    'vigencia_desde',
    'vigencia_hasta',
    'notas',
    'validacion_minima',
  ],
  INSURERS: [
    'seguro_id',
    'aseguradora',
    'plan_poliza',
    'tipo_plan',
    'estatus',
    'contacto_autorizaciones',
    'telefono',
    'email',
    'requiere_autorizacion',
    'copago_default',
    'deducible_default',
    'moneda',
    'vigencia_desde',
    'vigencia_hasta',
    'notas',
    'validacion_minima',
  ],
  PRODUCTS: [
    'producto_id',
    'nombre_producto',
    'tipo_producto',
    'sku_codigo',
    'unidad_medida',
    'proveedor_preferido_id',
    'costo_unitario',
    'precio_venta',
    'moneda',
    'inventariable',
    'stock_minimo',
    'requiere_receta',
    'estatus',
    'notas',
    'validacion_minima',
  ],
  RATES: [
    'tarifa_id',
    'servicio_id',
    'seguro_id',
    'proveedor_id',
    'precio_convenio',
    'moneda',
    'cobertura_tipo',
    'cobertura_valor',
    'copago',
    'requiere_autorizacion',
    'vigencia_desde',
    'vigencia_hasta',
    'estatus',
    'notas',
    'validacion_minima',
  ],
  SUPPLIER_PURCHASES: [
    'compra_id',
    'producto_id',
    'proveedor_id',
    'costo_unitario',
    'moneda',
    'plazo_entrega_dias',
    'cantidad_minima',
    'vigencia_desde',
    'vigencia_hasta',
    'estatus',
    'notas',
    'validacion_minima',
  ],
  STAFF: [
    'personal_id',
    'nombre_completo',
    'funcion',
    'registro_profesional',
    'anos_experiencia',
    'correo',
    'telefono',
    'disponibilidad',
    'zona_cobertura',
    'estatus',
    'notas',
    'validacion_minima',
  ],
};

const numericColumns = new Set([
  'duracion_minutos',
  'precio_base',
  'copago_default',
  'deducible_default',
  'costo_unitario',
  'precio_venta',
  'stock_minimo',
  'precio_convenio',
  'cobertura_valor',
  'copago',
  'plazo_entrega_dias',
  'cantidad_minima',
  'anos_experiencia',
]);
const integerColumns = new Set([
  'duracion_minutos',
  'stock_minimo',
  'plazo_entrega_dias',
  'cantidad_minima',
  'anos_experiencia',
]);
const dateColumns = new Set(['vigencia_desde', 'vigencia_hasta']);
const emailColumns = new Set(['email', 'correo']);
const statusValues = new Set(['activo', 'inactivo', 'en revision', 'en revisión']);

function cleanCell(value: unknown): ImportCellValue {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  return String(value).trim() || null;
}

function pushIssue(issues: ImportIssue[], issue: ImportIssue) {
  if (issues.length < MAX_ISSUES) issues.push(issue);
}

function validateValue(
  issues: ImportIssue[],
  sheet: string,
  row: number,
  column: string,
  value: ImportCellValue,
) {
  if (value === null) return;
  if (numericColumns.has(column)) {
    if (
      typeof value !== 'number' ||
      value < 0 ||
      (integerColumns.has(column) && !Number.isInteger(value))
    ) {
      pushIssue(issues, {
        sheet,
        row,
        column,
        message: integerColumns.has(column)
          ? 'Debe ser un número entero mayor o igual a cero.'
          : 'Debe ser un número mayor o igual a cero.',
      });
    }
  }
  if (
    dateColumns.has(column) &&
    (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
  ) {
    pushIssue(issues, { sheet, row, column, message: 'Debe ser una fecha válida.' });
  }
  if (
    emailColumns.has(column) &&
    (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
  ) {
    pushIssue(issues, { sheet, row, column, message: 'El correo no es válido.' });
  }
  if (
    column === 'estatus' &&
    (typeof value !== 'string' || !statusValues.has(value.toLowerCase()))
  ) {
    pushIssue(issues, {
      sheet,
      row,
      column,
      message: 'Use Activo, Inactivo o En revision.',
    });
  }
}

export async function parseInformationWorkbook(
  fileName: string,
  bytes: Uint8Array,
): Promise<ParsedWorkbookImport> {
  let sheets: Awaited<ReturnType<typeof readWorkbook>>;
  try {
    sheets = await readWorkbook(Buffer.from(bytes));
  } catch {
    return {
      fileName,
      records: [],
      issues: [{ sheet: 'Archivo', row: 0, message: 'No pudimos leer el documento Excel.' }],
    };
  }

  const issues: ImportIssue[] = [];
  const records: ParsedImportRecord[] = [];
  const seenIds = new Set<string>();
  const sheetsByName = new Map(sheets.map((sheet) => [sheet.sheet, sheet.data]));

  for (const definition of importDatasetDefinitions) {
    const rows = sheetsByName.get(definition.sheet);
    if (!rows) {
      pushIssue(issues, {
        sheet: definition.sheet,
        row: 0,
        message: 'Falta esta hoja requerida de la plantilla.',
      });
      continue;
    }
    const headers = expectedHeaders[definition.dataset];
    const uploadedHeaders = (rows[4] ?? []).map((value) => String(value ?? '').trim());
    if (
      headers.length !== uploadedHeaders.length ||
      headers.some((header, index) => uploadedHeaders[index] !== header)
    ) {
      pushIssue(issues, {
        sheet: definition.sheet,
        row: 5,
        message: 'Los encabezados no coinciden con la plantilla oficial.',
      });
      continue;
    }

    for (let index = 5; index < rows.length; index++) {
      const raw = rows[index] ?? [];
      const values: ImportedValues = Object.fromEntries(
        headers
          .filter((header) => header !== 'validacion_minima')
          .map((header, columnIndex) => [header, cleanCell(raw[columnIndex])]),
      );
      if (Object.values(values).every((value) => value === null)) continue;
      if (records.length >= MAX_IMPORT_ROWS) {
        pushIssue(issues, {
          sheet: definition.sheet,
          row: index + 1,
          message: `El archivo supera el máximo de ${MAX_IMPORT_ROWS} registros.`,
        });
        break;
      }

      for (const column of definition.required) {
        if (values[column] === null) {
          pushIssue(issues, {
            sheet: definition.sheet,
            row: index + 1,
            column,
            message: 'Este campo es obligatorio.',
          });
        }
      }
      for (const [column, value] of Object.entries(values)) {
        validateValue(issues, definition.sheet, index + 1, column, value);
      }
      const rawId = values[definition.idColumn];
      const id = typeof rawId === 'string' ? rawId : rawId === null ? '' : String(rawId);
      if (id.length > 120) {
        pushIssue(issues, {
          sheet: definition.sheet,
          row: index + 1,
          column: definition.idColumn,
          message: 'El ID no puede superar 120 caracteres.',
        });
      }
      const uniqueKey = `${definition.dataset}:${id.toUpperCase()}`;
      if (id && seenIds.has(uniqueKey)) {
        pushIssue(issues, {
          sheet: definition.sheet,
          row: index + 1,
          column: definition.idColumn,
          message: 'El ID está repetido dentro del archivo.',
        });
      }
      if (id) seenIds.add(uniqueKey);
      records.push({
        dataset: definition.dataset,
        id,
        sheet: definition.sheet,
        row: index + 1,
        values,
      });
    }
  }

  if (!records.length && !issues.length) {
    issues.push({
      sheet: 'Archivo',
      row: 0,
      message: 'La plantilla no contiene registros para importar.',
    });
  }
  return { fileName, records, issues };
}
