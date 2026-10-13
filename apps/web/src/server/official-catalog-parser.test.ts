import { describe, expect, it } from 'vitest';
import { officialCatalogId, parseOfficialCatalogSheets } from './official-catalog-parser';

const fixture = () => [
  {
    sheet: 'SERVICIOS',
    data: [
      ['ITEM ID AUTOMATICO', 'Grupo sintético', 'Costo', 'Venta'],
      [null, 'Servicio sintético', 0, 31.3528],
    ],
  },
  {
    sheet: 'INSUMOS',
    data: [['Título'], ['ITEM ID AUTOMATICO', 'Descripción'], [null, 'Insumo sintético']],
  },
  {
    sheet: 'MEDICAMENTOS',
    data: [['Título'], ['ITEM ID AUTOMATICO', 'Descripción'], [null, 'Medicamento sintético']],
  },
  {
    sheet: 'EQUIPO E INSTRUMENTAL',
    data: [[], ['ITEM ID AUTOMATICO', 'Descripción'], [null, 'Equipo sintético']],
  },
  {
    sheet: 'PROVEEDORES',
    data: [[], ['ITEM ID AUTOMATICO', 'Descripción'], [null, 'Proveedor sintético', 'QA-001']],
  },
];
describe('approved catalog candidates', () => {
  it('preserves source precision and pending zero costs, without importing section headings', () => {
    const records = parseOfficialCatalogSheets(fixture())!;
    expect(records).toHaveLength(5);
    expect(records[0].values).toMatchObject({
      precio_base: 31.3528,
      costo_unitario: null,
      source_column_3: 0,
      estatus: 'En revision',
      moneda: null,
    });
  });
  it('does not manufacture clinical details, prices, stock or individual equipment', () => {
    const records = parseOfficialCatalogSheets(fixture())!;
    expect(records[2].values).toMatchObject({
      concentracion: null,
      precio_venta: null,
      principio_activo: null,
    });
    expect(records.every((record) => !('stock' in record.values))).toBe(true);
    expect(records[3].dataset).toBe('PRODUCTS');
  });
  it('identifies entities independently of row/file while separating suppliers and products', () => {
    expect(officialCatalogId('INSUMOS', '  QA  ')).toBe(officialCatalogId('INSUMOS', 'qa'));
    expect(officialCatalogId('PROVEEDORES', 'qa', 'QA-001')).not.toBe(
      officialCatalogId('PROVEEDORES', 'qa', 'QA-002'),
    );
    const sheets = fixture();
    const original = parseOfficialCatalogSheets(sheets)![1];
    sheets[1].data.splice(2, 0, []);
    expect(parseOfficialCatalogSheets(sheets)![1].id).toBe(original.id);
  });
});
