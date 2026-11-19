import type { Page } from '@playwright/test';

/** Rehydrate pre-order purchase drafts as an upgrade would, then exercise only public controls. */
export async function loadLegacyPurchases(
  page: Page,
  reference: string,
  invoiceNumber: string,
  serials: string[],
  note?: string,
) {
  const records = serials.map((serialNumber, i) => ({
    id: `qa-legacy-${serialNumber}`,
    catalogItemId: 'catalog-demo-kit',
    supplierCatalogItemId: 'catalog-demo-provider-qa',
    reference,
    invoiceNumber,
    invoiceGroupId: `qa-group-${invoiceNumber}`,
    warehouseId: 'central',
    quantity: 1,
    unitCost: 2.5,
    taxRates: { iva: 0.13, perception: 0 },
    status: 'DRAFT',
    serialNumber,
    createdAt: `2026-10-06T09:00:0${i}.000Z`,
    note,
  }));
  await page.evaluate((data) => {
    localStorage.setItem('analiza.en.casa.workspace.v3.purchases', JSON.stringify(data));
  }, records);
  await page.reload();
}
