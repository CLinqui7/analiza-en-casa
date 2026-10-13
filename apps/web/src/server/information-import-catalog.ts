import { catalogItemSchema, type CatalogItem } from '@analiza/contracts';
import type { ParsedImportRecord } from '@/lib/information-import';

/** Project approved fields into operational catalogs; never create stock or clinical rules. */
export function importedCatalogItem(
  record: ParsedImportRecord,
  createdAt: string,
): CatalogItem | null {
  const values = record.values;
  const nameColumn = {
    SERVICES: 'nombre_servicio',
    SUPPLIERS: 'nombre_proveedor',
    INSURERS: 'aseguradora',
    PRODUCTS: 'nombre_producto',
  }[record.dataset as 'SERVICES' | 'SUPPLIERS' | 'INSURERS' | 'PRODUCTS'];
  if (!nameColumn) return null;
  const productCategories: Record<string, CatalogItem['category']> = {
    Medicamento: 'MEDICATIONS',
    'Insumo medico': 'SUPPLIES',
    Equipo: 'EQUIPMENT',
  };
  const category =
    record.dataset === 'PRODUCTS'
      ? productCategories[String(values.tipo_producto)]
      : record.dataset === 'SUPPLIERS'
        ? 'PROVIDERS'
        : record.dataset === 'INSURERS'
          ? 'INSURERS'
          : 'SERVICES';
  const price = record.dataset === 'SERVICES' ? values.precio_base : values.precio_venta;
  const cost = values.costo_unitario;
  const email =
    typeof values.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)
      ? values.email
      : undefined;
  const raw = {
    id: record.id,
    sku: String(values.sku_codigo || record.id),
    name: String(values[nameColumn]),
    category,
    status: String(values.estatus).toLowerCase() === 'activo' ? 'ACTIVE' : 'INACTIVE',
    createdAt,
    ...(typeof price === 'number' ? { salePriceExcludingTax: price } : {}),
    ...(typeof cost === 'number' ? { costPrice: cost } : {}),
    ...(record.dataset === 'SUPPLIERS'
      ? {
          ...(email ? { email } : {}),
          ...(typeof values.telefono === 'string' && values.telefono.length <= 50
            ? { landlinePhone: values.telefono }
            : {}),
          ...(typeof values.contacto_principal === 'string' &&
          values.contacto_principal.length <= 200
            ? { contactName: values.contacto_principal }
            : {}),
        }
      : {}),
  };
  return catalogItemSchema.parse(raw);
}
