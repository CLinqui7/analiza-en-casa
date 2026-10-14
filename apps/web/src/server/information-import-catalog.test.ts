import { describe, expect, it } from 'vitest';
import { importedCatalogItem } from './information-import-catalog';
describe('operational catalog projection', () => {
  it('keeps malformed supplier email out of the usable contact without losing its source', () => {
    const record = {
      dataset: 'SUPPLIERS' as const,
      id: 'qa-supplier',
      sheet: 'Proveedores',
      row: 6,
      values: { nombre_proveedor: 'QA', email: 'qa@invalid_domain.test', estatus: 'En revision' },
    };
    expect(importedCatalogItem(record, '2026-10-12')).not.toHaveProperty('email');
    expect(record.values.email).toBe('qa@invalid_domain.test');
  });
  it('preserves explicit zero and decimals but leaves unknown cost absent', () => {
    const item = importedCatalogItem(
      {
        dataset: 'SERVICES',
        id: 'qa-service',
        sheet: 'Servicios',
        row: 6,
        values: {
          nombre_servicio: 'QA',
          precio_base: 31.3528,
          moneda: 'USD',
          estatus: 'En revision',
        },
      },
      '2026-10-12',
    );
    expect(item).toMatchObject({
      category: 'SERVICES',
      salePriceExcludingTax: 31.3528,
      status: 'INACTIVE',
    });
    expect(item).not.toHaveProperty('costPrice');
  });
  it('preserves categories and allows confirmed zero without fabricating physical stock', () => {
    const item = importedCatalogItem(
      {
        dataset: 'PRODUCTS',
        id: 'qa-product',
        sheet: 'Productos',
        row: 6,
        values: {
          nombre_producto: 'QA',
          tipo_producto: 'Medicamento',
          precio_venta: 0,
          moneda: 'USD',
          estatus: 'Activo',
        },
      },
      '2026-10-12',
    );
    expect(item).toMatchObject({
      category: 'MEDICATIONS',
      salePriceExcludingTax: 0,
      status: 'INACTIVE',
    });
    expect(item).not.toHaveProperty('stock');
  });
  it('keeps unknown or foreign currencies inactive in the USD operational quote model', () => {
    const record = {
      dataset: 'SERVICES' as const,
      id: 'qa-currency',
      sheet: 'Servicios',
      row: 6,
      values: {
        nombre_servicio: 'QA',
        precio_base: 10,
        costo_unitario: 5,
        moneda: 'MXN',
        estatus: 'Activo',
      },
    };
    expect(importedCatalogItem(record, '2026-10-13')?.status).toBe('INACTIVE');
    expect(importedCatalogItem(record, '2026-10-13')).not.toHaveProperty('salePriceExcludingTax');
    expect(importedCatalogItem(record, '2026-10-13')).not.toHaveProperty('costPrice');
    expect(record.values.precio_base).toBe(10);
    const unspecified = { ...record, values: { ...record.values, moneda: null } };
    expect(importedCatalogItem(unspecified, '2026-10-13')).not.toHaveProperty(
      'salePriceExcludingTax',
    );
  });
  it('never converts rate or purchasing references into performed services or transactions', () => {
    expect(
      importedCatalogItem(
        { dataset: 'RATES', id: 'qa-rate', sheet: 'Tarifas_Coberturas', row: 6, values: {} },
        '2026-10-12',
      ),
    ).toBeNull();
    expect(
      importedCatalogItem(
        { dataset: 'STAFF', id: 'qa-staff', sheet: 'Personal', row: 6, values: {} },
        '2026-10-12',
      ),
    ).toBeNull();
  });
});
