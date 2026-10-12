import type { Quote } from '@analiza/contracts';
import { quoteMedicalFeeOptions } from '@/lib/quote-medical-fees';

type CatalogPrice = Readonly<{
  id: string;
  category: string;
  status: string;
  salePriceExcludingTax?: number;
}>;
type DoctorFee = Readonly<{ id: string; medicalFee?: number }>;

const catalogCategory: Record<Exclude<Quote['items'][number]['category'], 'FEES'>, string> = {
  SERVICES: 'SERVICES',
  STUDIES: 'LABORATORY',
  MEDICATIONS: 'MEDICATIONS',
  SUPPLIES: 'SUPPLIES',
  EQUIPMENT: 'EQUIPMENT',
  EXTRAS: 'PHYSIOTHERAPY',
  IMAGING: 'IMAGING',
};

/** Historical lines keep their original price; only new or repriced lines use today's catalog. */
export function quoteCatalogPriceError(
  quote: Quote,
  catalogItems: readonly CatalogPrice[],
  doctors: readonly DoctorFee[],
  previous?: Quote | null,
): string | null {
  const items = new Map(catalogItems.map((entry) => [entry.id, entry]));
  const doctorIds = new Set(doctors.map((entry) => entry.id));
  for (const line of quote.items) {
    const old = previous?.items.find((entry) => entry.id === line.id);
    if (
      old &&
      old.category === line.category &&
      old.inventoryItemId === line.inventoryItemId &&
      old.doctorId === line.doctorId &&
      old.unitPrice === line.unitPrice
    )
      continue;
    if (line.category === 'FEES') {
      if (!line.doctorId || !doctorIds.has(line.doctorId))
        return 'Seleccione un médico registrado para el honorario.';
      if (!(quoteMedicalFeeOptions as readonly number[]).includes(line.unitPrice))
        return 'Seleccione un honorario permitido entre USD 0 y USD 300 para esta cotización.';
      continue;
    }
    const catalog = line.inventoryItemId ? items.get(line.inventoryItemId) : undefined;
    if (
      !catalog ||
      catalog.status !== 'ACTIVE' ||
      catalog.category !== catalogCategory[line.category] ||
      typeof catalog.salePriceExcludingTax !== 'number' ||
      !Number.isFinite(catalog.salePriceExcludingTax) ||
      line.unitPrice !== catalog.salePriceExcludingTax
    )
      return 'El precio de venta debe coincidir con un ítem activo del catálogo.';
  }
  return null;
}
