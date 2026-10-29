'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Purchase } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel } from '@analiza/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { SearchableSelect } from '@/components/common/searchable-select';
import { useAuth, useWorkspace } from '@/components/providers';
import { normalizePurchaseTraceability } from '@/lib/purchase-catalog';
import { invoiceVoidSource } from '@/lib/purchase-invoice-groups';
import { purchaseTotals } from '@/lib/purchase-totals';
import { purchaseOrderSchema, type PurchaseOrder } from '@/lib/purchase-order';
import { useOperations } from '@/lib/use-operations';
const schema = z.object({
  catalogItemId: z.string().min(1, 'Seleccione un ítem de catálogo.'),
  supplierCatalogItemId: z.string().min(1, 'Seleccione un proveedor.'),
  warehouseId: z.string().min(1, 'Seleccione una bodega de destino.'),
  reference: z.string().trim().min(1, 'Ingrese una referencia de compra.').max(200),
  invoiceNumber: z.string().trim().max(100, 'Use un máximo de 100 caracteres.'),
  purchaseOrderId: z.string().trim(),
  note: z.string().trim(),
  usefulLife: z.string().trim().max(120),
  isFixedAsset: z.boolean(),
  quantity: z
    .number()
    .int('La cantidad debe ser un número entero.')
    .positive('La cantidad debe ser mayor que cero.'),
  unitCost: z.number().nonnegative('El costo no puede ser negativo.'),
  expirationDate: z.string(),
  lotNumber: z.string().trim(),
  serialNumber: z.string().trim(),
});
type Form = z.infer<typeof schema>;
export default function PurchasesPage() {
  const {
    addPurchase,
    addPurchaseBatch,
    updatePurchase,
    cancelPurchase,
    voidPurchaseInvoice,
    catalogItems,
    error,
    purchases,
    refreshWorkspace,
    providerMode,
  } = useWorkspace();
  const { can } = useAuth();
  const {
    warehouses,
    connected: warehouseConnected,
    error: warehouseError,
    busy: receiptBusy,
    execute: executeReceipt,
  } = useOperations();
  const [open, setOpen] = useState(false);
  const [queuedLines, setQueuedLines] = useState<Purchase[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [applyPerception, setApplyPerception] = useState(false);
  const [invoiceGroupId, setInvoiceGroupId] = useState(() => crypto.randomUUID());
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [cancelling, setCancelling] = useState<Purchase | null>(null);
  const [voidingInvoice, setVoidingInvoice] = useState<Purchase | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [receiptSelection, setReceiptSelection] = useState<{
    purchase: Purchase;
    receivedAt: string;
  } | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const purchasableItems = useMemo(
    () =>
      catalogItems.filter(
        (item) =>
          item.status === 'ACTIVE' &&
          ['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT'].includes(item.category ?? ''),
      ),
    [catalogItems],
  );
  const suppliers = useMemo(
    () => catalogItems.filter((item) => item.status === 'ACTIVE' && item.category === 'PROVIDERS'),
    [catalogItems],
  );
  const activeWarehouses = useMemo(
    () =>
      warehouseConnected
        ? warehouses.filter((warehouse) => warehouse.status === 'ACTIVE')
        : [{ id: 'central', name: 'central (demo)', status: 'ACTIVE' as const }],
    [warehouseConnected, warehouses],
  );
  const warehouseNames = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name])),
    [warehouses],
  );
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      catalogItemId: purchasableItems[0]?.id ?? '',
      supplierCatalogItemId: suppliers[0]?.id ?? '',
      warehouseId: activeWarehouses[0]?.id ?? '',
      reference: '',
      invoiceNumber: '',
      purchaseOrderId: '',
      note: '',
      usefulLife: '',
      isFixedAsset: false,
      quantity: 1,
      unitCost: purchasableItems[0]?.costPrice ?? 0,
      expirationDate: '',
      lotNumber: '',
      serialNumber: '',
    },
  });
  useEffect(() => {
    if (providerMode !== 'postgresql') return;
    let active = true;
    void fetch('/api/purchase-orders', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const payload = (await response.json()) as { orders: unknown[] };
        if (active) setOrders(payload.orders.map((entry) => purchaseOrderSchema.parse(entry)));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [providerMode]);
  useEffect(() => {
    const current = form.getValues('catalogItemId');
    if (!purchasableItems.some((item) => item.id === current) && purchasableItems[0]) {
      form.setValue('catalogItemId', purchasableItems[0].id, { shouldValidate: true });
      form.setValue('unitCost', purchasableItems[0].costPrice ?? 0, { shouldValidate: true });
    }
    const currentSupplier = form.getValues('supplierCatalogItemId');
    if (!suppliers.some((item) => item.id === currentSupplier) && suppliers[0]) {
      form.setValue('supplierCatalogItemId', suppliers[0].id, { shouldValidate: true });
    }
    const currentWarehouse = form.getValues('warehouseId');
    if (!activeWarehouses.some((warehouse) => warehouse.id === currentWarehouse)) {
      form.setValue('warehouseId', activeWarehouses[0]?.id ?? '', { shouldValidate: true });
    }
  }, [activeWarehouses, form, purchasableItems, suppliers]);
  const itemNames = useMemo(
    () => new Map(catalogItems.map((item) => [item.id, item.name])),
    [catalogItems],
  );
  const selectedCatalogItemId = useWatch({ control: form.control, name: 'catalogItemId' });
  const selectedSupplierId = useWatch({ control: form.control, name: 'supplierCatalogItemId' });
  const selectedItem = purchasableItems.find((item) => item.id === selectedCatalogItemId);
  const purchaseCatalogOptions = useMemo(
    () =>
      purchasableItems.map((item) => ({
        value: item.id,
        label: `${item.sku} · ${item.name}`,
      })),
    [purchasableItems],
  );
  const purchaseGroups = useMemo(() => {
    const groups = new Map<string, Purchase[]>();
    for (const purchase of purchases) {
      // The invoice number alone is not an identity: different suppliers can reuse it.
      const key = purchase.invoiceGroupId
        ? `invoice:${purchase.invoiceGroupId}`
        : `line:${purchase.id}`;
      const lines = groups.get(key);
      if (lines) lines.push(purchase);
      else groups.set(key, [purchase]);
    }
    return [...groups.values()];
  }, [purchases]);
  const visible = useMemo(
    () =>
      purchaseGroups.filter((lines) =>
        lines.some((purchase) =>
          `${purchase.reference} ${purchase.invoiceNumber ?? ''} ${itemNames.get(purchase.catalogItemId) ?? ''} ${warehouseNames.get(purchase.warehouseId ?? '') ?? ''}`
            .toLocaleLowerCase('es-SV')
            .includes(query.toLocaleLowerCase('es-SV')),
        ),
      ),
    [itemNames, purchaseGroups, query, warehouseNames],
  );
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const invoiceLines = (purchase: Purchase) =>
    purchaseGroups.find((lines) => lines.some((line) => line.id === purchase.id)) ?? [purchase];
  const invoiceStatus = (lines: Purchase[]) => {
    if (lines.every((line) => line.invoiceVoidedAt)) return 'Factura anulada';
    if (lines.every((line) => line.status === 'CANCELLED')) return 'Anulada';
    if (lines.every((line) => line.status === 'RECEIVED')) return 'Recepción registrada';
    if (lines.some((line) => line.status === 'RECEIVED')) return 'Recepción parcial';
    return 'Borrador';
  };
  async function exportPurchasesXlsx() {
    const { createXlsxWorkbook } = await import('@/lib/xlsx');
    const workbookBytes = createXlsxWorkbook(
      [
        { key: 'reference', label: 'Referencia', width: 26 },
        { key: 'invoiceNumber', label: 'Número de factura', width: 24 },
        { key: 'item', label: 'Ítem', width: 36 },
        { key: 'supplier', label: 'Proveedor', width: 30 },
        { key: 'warehouse', label: 'Bodega', width: 26 },
        { key: 'quantity', label: 'Cantidad' },
        { key: 'unitCost', label: 'Costo unitario' },
        { key: 'total', label: 'Total' },
        { key: 'status', label: 'Estado' },
        { key: 'createdAt', label: 'Fecha de creación', width: 22 },
      ],
      visible
        .flatMap((lines) => lines)
        .map((purchase) => ({
          reference: purchase.reference,
          invoiceNumber: purchase.invoiceNumber ?? '',
          item: itemNames.get(purchase.catalogItemId) ?? purchase.catalogItemId,
          supplier: itemNames.get(purchase.supplierCatalogItemId ?? '') ?? 'No documentado',
          warehouse: purchase.warehouseId
            ? (warehouseNames.get(purchase.warehouseId) ?? purchase.warehouseId)
            : 'Sin bodega asignada',
          quantity: purchase.quantity ?? '',
          unitCost: purchase.unitCost ?? '',
          total:
            purchase.unitCost === undefined
              ? ''
              : ((purchase.quantity ?? 1) * purchase.unitCost).toFixed(2),
          status:
            purchase.status === 'RECEIVED'
              ? 'Recepción registrada'
              : purchase.status === 'CANCELLED'
                ? 'Anulada'
                : 'Borrador',
          createdAt: purchase.createdAt.slice(0, 10),
        })),
      'Compras',
    );
    const blob = new Blob([workbookBytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const anchor = document.createElement('a');
    anchor.download = 'compras-filtradas.xlsx';
    anchor.href = URL.createObjectURL(blob);
    document.body.append(anchor);
    anchor.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(anchor.href);
      anchor.remove();
    }, 1000);
  }
  function close() {
    setOpen(false);
    setEditing(null);
    setQueuedLines([]);
    setApplyPerception(false);
    setInvoiceGroupId(crypto.randomUUID());
    form.reset({
      catalogItemId: purchasableItems[0]?.id ?? '',
      supplierCatalogItemId: suppliers[0]?.id ?? '',
      warehouseId: activeWarehouses[0]?.id ?? '',
      reference: '',
      invoiceNumber: '',
      purchaseOrderId: '',
      note: '',
      usefulLife: '',
      isFixedAsset: false,
      quantity: 1,
      unitCost: purchasableItems[0]?.costPrice ?? 0,
      expirationDate: '',
      lotNumber: '',
      serialNumber: '',
    });
  }
  function edit(purchase: Purchase) {
    if (purchase.status !== 'DRAFT') return;
    setEditing(purchase);
    setQueuedLines([]);
    setApplyPerception(purchase.taxRates?.perception === 0.01);
    setInvoiceGroupId(purchase.invoiceGroupId ?? crypto.randomUUID());
    form.reset({
      catalogItemId: purchase.catalogItemId,
      supplierCatalogItemId: purchase.supplierCatalogItemId ?? '',
      warehouseId: purchase.warehouseId ?? '',
      reference: purchase.reference,
      invoiceNumber: purchase.invoiceNumber ?? '',
      purchaseOrderId: purchase.purchaseOrderId ?? '',
      note: purchase.note ?? '',
      usefulLife: purchase.usefulLife ?? '',
      isFixedAsset: purchase.isFixedAsset ?? false,
      quantity: purchase.quantity ?? 1,
      unitCost: purchase.unitCost ?? 0,
      expirationDate: purchase.expirationDate ?? '',
      lotNumber: purchase.lotNumber ?? '',
      serialNumber: purchase.serialNumber ?? '',
    });
    setOpen(true);
  }
  function selectCatalogItem(itemId: string) {
    const item = purchasableItems.find((candidate) => candidate.id === itemId);
    form.setValue('catalogItemId', item?.id ?? '', { shouldValidate: true });
    form.setValue('unitCost', item?.costPrice ?? 0, { shouldValidate: true });
    if (item?.category === 'EQUIPMENT') {
      form.setValue('expirationDate', '');
      form.setValue('lotNumber', '');
      form.clearErrors(['expirationDate', 'lotNumber']);
    } else if (item?.category === 'MEDICATIONS' || item?.category === 'SUPPLIES') {
      form.setValue('serialNumber', '');
      form.clearErrors('serialNumber');
    }
  }
  function makePurchase(values: Form): Purchase | null {
    const catalogItem = purchasableItems.find((item) => item.id === values.catalogItemId);
    if (!catalogItem) return null;
    if (!suppliers.some((item) => item.id === values.supplierCatalogItemId)) {
      form.setError('supplierCatalogItemId', { message: 'Seleccione un proveedor activo.' });
      return null;
    }
    if (values.purchaseOrderId) {
      const order = orders.find((candidate) => candidate.id === values.purchaseOrderId);
      if (
        !order ||
        order.supplierCatalogItemId !== values.supplierCatalogItemId ||
        !order.items.some((line) => line.catalogItemId === values.catalogItemId)
      ) {
        form.setError('purchaseOrderId', {
          message: 'Seleccione una orden del mismo proveedor y artículo.',
        });
        return null;
      }
    }
    if (!activeWarehouses.some((warehouse) => warehouse.id === values.warehouseId)) {
      form.setError('warehouseId', { message: 'Seleccione una bodega activa.' });
      return null;
    }
    if (['MEDICATIONS', 'SUPPLIES'].includes(catalogItem.category ?? '')) {
      if (!values.expirationDate) {
        form.setError('expirationDate', { message: 'Indique la fecha de vencimiento.' });
        return null;
      }
      if (!values.lotNumber) {
        form.setError('lotNumber', { message: 'Indique el lote.' });
        return null;
      }
    }
    if (catalogItem.category === 'EQUIPMENT' && !values.serialNumber) {
      form.setError('serialNumber', { message: 'Indique el número de serie.' });
      return null;
    }
    if (catalogItem.category === 'EQUIPMENT' && values.quantity !== 1) {
      form.setError('quantity', {
        message: 'Cada equipo con número de serie se registra por unidad.',
      });
      return null;
    }
    return normalizePurchaseTraceability(
      {
        id: editing?.id ?? crypto.randomUUID(),
        catalogItemId: values.catalogItemId,
        supplierCatalogItemId: values.supplierCatalogItemId,
        warehouseId: values.warehouseId,
        reference: values.reference,
        invoiceNumber: values.invoiceNumber || undefined,
        invoiceGroupId: editing?.invoiceGroupId ?? invoiceGroupId,
        note: values.note || undefined,
        usefulLife: values.usefulLife || undefined,
        isFixedAsset: values.isFixedAsset,
        purchaseOrderId: values.purchaseOrderId || undefined,
        quantity: values.quantity,
        unitCost: values.unitCost,
        taxRates: editing
          ? editing.taxRates
          : { iva: 0.13, perception: applyPerception ? 0.01 : 0 },
        expirationDate: values.expirationDate || undefined,
        lotNumber: values.lotNumber || undefined,
        serialNumber: values.serialNumber || undefined,
        status: 'DRAFT',
        createdAt: editing?.createdAt ?? new Date().toISOString(),
      } satisfies Purchase,
      catalogItem.category,
    );
  }
  function queueLine(values: Form) {
    if (editing) return;
    if (!values.invoiceNumber.trim()) {
      form.setError('invoiceNumber', {
        message: 'Indique el número de factura para agregar varias líneas.',
      });
      return;
    }
    const first = queuedLines[0];
    if (
      first &&
      (values.invoiceNumber !== first.invoiceNumber ||
        values.reference !== first.reference ||
        values.supplierCatalogItemId !== first.supplierCatalogItemId ||
        (values.purchaseOrderId || undefined) !== first.purchaseOrderId ||
        values.warehouseId !== first.warehouseId)
    ) {
      form.setError('invoiceNumber', {
        message:
          'Todas las líneas deben conservar el número, referencia, proveedor y bodega de la misma factura.',
      });
      return;
    }
    const purchase = makePurchase(values);
    if (!purchase) return;
    if (first && first.taxRates?.perception !== purchase.taxRates?.perception) {
      form.setError('invoiceNumber', {
        message: 'Mantenga la misma selección de percepción para todas las líneas.',
      });
      return;
    }
    setQueuedLines((current) => [...current, purchase]);
    form.setValue('quantity', 1);
    form.setValue('lotNumber', '');
    form.setValue('serialNumber', '');
    form.setValue('expirationDate', '');
  }
  async function submit(values: Form) {
    const purchase = makePurchase(values);
    if (!purchase) return;
    const purchasesToSave = [...queuedLines, purchase];
    if (
      queuedLines.length &&
      purchasesToSave.some(
        (line) =>
          line.invoiceNumber !== queuedLines[0].invoiceNumber ||
          line.reference !== queuedLines[0].reference ||
          line.supplierCatalogItemId !== queuedLines[0].supplierCatalogItemId ||
          line.purchaseOrderId !== queuedLines[0].purchaseOrderId ||
          line.warehouseId !== queuedLines[0].warehouseId ||
          line.taxRates?.perception !== queuedLines[0].taxRates?.perception,
      )
    ) {
      form.setError('invoiceNumber', {
        message: 'Todas las líneas deben pertenecer a la misma factura, proveedor y bodega.',
      });
      return;
    }
    const saved = editing
      ? await updatePurchase(purchase)
      : purchasesToSave.length > 1
        ? await addPurchaseBatch(purchasesToSave)
        : await addPurchase(purchase);
    if (!saved) return;
    setMessage(
      editing
        ? 'Borrador de compra actualizado y auditado.'
        : purchasesToSave.length > 1
          ? `Factura guardada con ${purchasesToSave.length} líneas en una sola operación auditada.`
          : 'Compra guardada como borrador con bodega de destino y trazabilidad de inventario.',
    );
    close();
  }
  async function saveQueued() {
    if (!queuedLines.length) return;
    const saved =
      queuedLines.length > 1
        ? await addPurchaseBatch(queuedLines)
        : await addPurchase(queuedLines[0]);
    if (!saved) return;
    setMessage(`Factura guardada con ${queuedLines.length} línea(s) en borrador.`);
    close();
  }
  async function confirmCancellation(formData: FormData) {
    if (!cancelling) return;
    const reason = String(formData.get('reason') ?? '').trim();
    if (!reason) {
      setCancelError('Explique por qué se anula el borrador.');
      return;
    }
    if (!(await cancelPurchase(cancelling.id, reason))) {
      setCancelError('No se pudo anular el borrador. Revise su estado e inténtelo de nuevo.');
      return;
    }
    setCancelling(null);
    setCancelError(null);
    setMessage('Borrador anulado con motivo y auditoría. No afectó existencias.');
  }
  async function confirmInvoiceVoid(formData: FormData) {
    if (!voidingInvoice) return;
    const reason = String(formData.get('reason') ?? '').trim();
    if (!reason) {
      setCancelError('Explique por qué se anula la factura.');
      return;
    }
    if (!(await voidPurchaseInvoice(voidingInvoice.id, reason))) {
      setCancelError('No se pudo anular la factura. Revise su estado e inténtelo de nuevo.');
      return;
    }
    const cancelledDraft = voidingInvoice.status === 'DRAFT';
    setVoidingInvoice(null);
    setCancelError(null);
    setMessage(
      cancelledDraft
        ? 'Factura en borrador anulada completa y auditada. No afectó existencias.'
        : 'Factura anulada y auditada. La recepción física y el inventario se conservan; gestione la devolución por separado si corresponde.',
    );
  }
  async function receivePurchase(formData: FormData) {
    if (!receiptSelection) return;
    const { purchase, receivedAt } = receiptSelection;
    const reason = String(formData.get('reason') ?? '').trim();
    if (!reason) {
      setReceiptError('Indique el motivo de la recepción física.');
      return;
    }
    const item = catalogItems.find((candidate) => candidate.id === purchase.catalogItemId);
    const number = purchase.serialNumber ?? purchase.lotNumber;
    if (
      !item ||
      !purchase.warehouseId ||
      !purchase.supplierCatalogItemId ||
      !number ||
      !purchase.quantity ||
      !Number.isInteger(purchase.quantity)
    ) {
      setReceiptError('La compra no tiene todos los datos necesarios para una recepción trazada.');
      return;
    }
    const receiptId = `purchase-receipt:${purchase.id}`;
    const ok = await executeReceipt({
      command: 'inventory.trace.receive',
      receipt: {
        id: receiptId,
        idempotencyKey: receiptId,
        purchaseId: purchase.id,
        kind: item.category === 'EQUIPMENT' ? 'SERIAL' : 'LOT',
        itemId: purchase.catalogItemId,
        supplierCatalogItemId: purchase.supplierCatalogItemId,
        warehouseId: purchase.warehouseId,
        number,
        quantity: purchase.quantity,
        expiresOn: purchase.expirationDate,
        receiptReference: purchase.reference,
        reason,
        receivedAt,
      },
    });
    if (!ok) return;
    await refreshWorkspace();
    setReceiptSelection(null);
    setReceiptError(null);
    setMessage(
      'Compra recibida en la bodega indicada. El lote o serie permanece en cuarentena hasta su liberación.',
    );
  }
  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Inventario</p>
          <h1>Compras</h1>
          <p>
            Registra borradores de compra con proveedor, bodega de destino y trazabilidad de lote,
            vencimiento o serie. La recepción física se confirma desde el borrador y queda visible
            en Lotes y series. El listado agrupa las líneas que comparten una factura; abra una fila
            para consultar y gestionar cada producto.
          </p>
        </div>
        {can('purchases:write') ? (
          <div className="action-row">
            <Link className="action-link-button action-link-button--inline" href="/purchase-orders">
              Órdenes a proveedores
            </Link>
            <Button
              data-action-id="PURCHASE-CREATE"
              disabled={!purchasableItems.length || !suppliers.length || !activeWarehouses.length}
              onClick={() => {
                setMessage(null);
                setEditing(null);
                setQueuedLines([]);
                setInvoiceGroupId(crypto.randomUUID());
                form.reset();
                setOpen(true);
              }}
              type="button"
            >
              Nueva compra
            </Button>
          </div>
        ) : null}
      </header>
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      {!message && error ? (
        <p className="notice danger" role="alert">
          {error}
        </p>
      ) : null}
      {warehouseError ? (
        <p className="notice danger" role="alert">
          {warehouseError}
        </p>
      ) : null}
      {can('purchases:write') &&
      (!suppliers.length || !purchasableItems.length || !activeWarehouses.length) ? (
        <div className="notice" role="status">
          <strong>Antes de registrar una compra:</strong>{' '}
          {!suppliers.length ? 'agrega al menos un proveedor activo' : ''}
          {!suppliers.length && !purchasableItems.length ? ' y ' : ''}
          {!purchasableItems.length ? 'agrega un medicamento, insumo o equipo activo' : ''} en{' '}
          <Link
            className="action-link-button action-link-button--inline"
            href="/catalogs/operational"
          >
            Abrir catálogos operativos
          </Link>
          {!activeWarehouses.length ? ' y habilita una bodega en Inventario → Bodegas.' : '.'}
        </div>
      ) : null}
      <Panel>
        <div className="table-heading">
          <div>
            <h2>Listado</h2>
            <p className="field-help">
              Las columnas visibles sin datos fuente se muestran como No documentado.
            </p>
          </div>
          <Button
            aria-describedby="purchase-export-help"
            className="button-secondary"
            data-action-id="PURCHASE-LIST-EXPORT"
            disabled={!visible.length}
            onClick={() => void exportPurchasesXlsx()}
            type="button"
          >
            Excel
          </Button>
        </div>
        <p className="field-help" id="purchase-export-help">
          Descarga todas las líneas de las facturas visibles según la búsqueda actual en un archivo
          XLSX. No incluye adjuntos ni datos clínicos.
        </p>
        <div className="filter-grid">
          <label>
            Registros
            <select
              aria-label="Registros por página"
              data-action-id="PURCHASE-PAGE-SIZE"
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              value={pageSize}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
            </select>
          </label>
          <label>
            Buscar compras
            <input
              data-action-id="PURCHASE-LIST-SEARCH"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              type="search"
              value={query}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  'Acciones',
                  'Tipo',
                  'Ubicación / referencia',
                  'Proveedor',
                  'Total de compra',
                  'Número de factura',
                  'Fecha',
                  'Estado',
                ].map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((lines) => {
                const purchase = lines[0];
                const voidSource = invoiceVoidSource(lines);
                const totals = purchaseTotals(lines);
                return (
                  <tr key={purchase.invoiceGroupId ?? purchase.id}>
                    <td>
                      <div className="action-row">
                        <Button
                          className="button-secondary"
                          data-action-id="PURCHASE-DETAIL-OPEN"
                          onClick={() => setSelected(purchase)}
                          type="button"
                        >
                          Abrir
                        </Button>
                        <a
                          className="action-link-button action-link-button--inline"
                          data-action-id="PURCHASE-INVOICE-PDF"
                          href={`/api/purchases/${encodeURIComponent(purchase.invoiceGroupId ?? purchase.id)}/pdf`}
                        >
                          PDF
                        </a>
                        {lines.length === 1 &&
                        can('purchases:write') &&
                        purchase.status === 'DRAFT' ? (
                          <>
                            <Button
                              className="button-secondary"
                              data-action-id="PURCHASE-EDIT"
                              onClick={() => edit(purchase)}
                              type="button"
                            >
                              Editar
                            </Button>
                            <Button
                              className="button-secondary danger"
                              data-action-id="PURCHASE-CANCEL"
                              onClick={() => {
                                setCancelError(null);
                                setCancelling(purchase);
                              }}
                              type="button"
                            >
                              Anular
                            </Button>
                          </>
                        ) : null}
                        {lines.length > 1 &&
                        can('purchases:write') &&
                        lines.some((line) => line.status === 'DRAFT') ? (
                          <Button
                            className="button-secondary"
                            onClick={() => setSelected(purchase)}
                            type="button"
                          >
                            Editar líneas
                          </Button>
                        ) : null}
                        {can('purchases:write') && voidSource ? (
                          <Button
                            className="button-secondary danger"
                            data-action-id="PURCHASE-INVOICE-VOID"
                            onClick={() => {
                              setCancelError(null);
                              setVoidingInvoice(voidSource);
                            }}
                            type="button"
                          >
                            Anular factura
                          </Button>
                        ) : null}
                        {lines.length === 1 &&
                        can('purchases:write') &&
                        can('inventory:write') &&
                        purchase.status === 'DRAFT' &&
                        purchase.warehouseId ? (
                          <Button
                            className="button-secondary"
                            data-action-id="PURCHASE-RECEIVE"
                            disabled={!warehouseConnected || receiptBusy}
                            onClick={() => {
                              setReceiptError(null);
                              setReceiptSelection({
                                purchase,
                                receivedAt: new Date().toISOString(),
                              });
                            }}
                            type="button"
                          >
                            Recibir
                          </Button>
                        ) : null}
                        {lines.length > 1 &&
                        can('purchases:write') &&
                        can('inventory:write') &&
                        lines.some((line) => line.status === 'DRAFT' && line.warehouseId) ? (
                          <Button
                            className="button-secondary"
                            disabled={!warehouseConnected || receiptBusy}
                            onClick={() => setSelected(purchase)}
                            type="button"
                          >
                            Recibir líneas
                          </Button>
                        ) : null}
                      </div>
                    </td>
                    <td>Compra</td>
                    <td>
                      <code>{purchase.reference}</code>
                      <p className="field-help">{lines.length} línea(s) en esta factura</p>
                      <p className="field-help">{purchase.note ?? 'Sin nota documentada'}</p>
                      <p className="field-help">
                        Bodega:{' '}
                        {purchase.warehouseId
                          ? (warehouseNames.get(purchase.warehouseId) ?? purchase.warehouseId)
                          : 'Sin bodega asignada'}
                      </p>
                    </td>
                    <td>
                      {itemNames.get(purchase.supplierCatalogItemId ?? '') ?? 'No documentado'}
                    </td>
                    <td>
                      {totals
                        ? `USD ${totals.total.toFixed(2)}`
                        : lines.some((line) => line.unitCost === undefined)
                          ? 'No documentado'
                          : `USD ${lines.reduce((sum, line) => sum + (line.quantity ?? 1) * (line.unitCost ?? 0), 0).toFixed(2)}`}
                    </td>
                    <td>
                      {purchase.invoiceNumber
                        ? `${purchase.invoiceNumber}${lines.every((line) => line.invoiceVoidedAt) ? ' · Anulada' : ''}`
                        : 'No registrado'}
                    </td>
                    <td>{new Date(purchase.createdAt).toLocaleDateString('es-SV')}</td>
                    <td>{invoiceStatus(lines)}</td>
                  </tr>
                );
              })}
              {!visible.length ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      detail={
                        query
                          ? `No hay compras documentadas para “${query}”.`
                          : 'No hay compras documentadas en la organización demo.'
                      }
                      title="Sin compras documentadas"
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <nav aria-label="Paginación de compras" className="pagination">
          <Button
            className="button-secondary"
            data-action-id="PURCHASE-PAGE-PREVIOUS"
            disabled={currentPage === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            Anterior
          </Button>
          <span>
            Página {visible.length ? currentPage : 0} de {visible.length ? pages : 0} ·{' '}
            {visible.length} facturas/compras
          </span>
          <Button
            className="button-secondary"
            data-action-id="PURCHASE-PAGE-NEXT"
            disabled={!visible.length || currentPage === pages}
            onClick={() => setPage((current) => Math.min(pages, current + 1))}
            type="button"
          >
            Siguiente
          </Button>
        </nav>
      </Panel>
      <Dialog
        description="El borrador conserva la bodega y la trazabilidad; la recepción se confirma por separado."
        footer={
          <>
            <Button className="button-secondary" onClick={close} type="button">
              Cancelar
            </Button>
            {!editing ? (
              <Button
                className="button-secondary"
                data-action-id="PURCHASE-ADD-LINE"
                onClick={() => void form.handleSubmit(queueLine)()}
                type="button"
              >
                Añadir línea
              </Button>
            ) : null}
            {queuedLines.length ? (
              <Button
                data-action-id="PURCHASE-SAVE-INVOICE"
                onClick={() => void saveQueued()}
                type="button"
              >
                Guardar factura ({queuedLines.length})
              </Button>
            ) : (
              <Button disabled={form.formState.isSubmitting} form="purchase-form" type="submit">
                {form.formState.isSubmitting
                  ? 'Guardando…'
                  : editing
                    ? 'Guardar cambios'
                    : 'Guardar borrador'}
              </Button>
            )}
          </>
        }
        onClose={close}
        open={open}
        title={editing ? 'Editar compra' : 'Nueva compra'}
      >
        {editing && invoiceLines(editing).length > 1 ? (
          <p className="field-help">
            Esta línea pertenece a una factura con varias líneas. El número de factura, proveedor,
            referencia y bodega deben mantenerse iguales en toda la factura.
          </p>
        ) : null}
        {queuedLines.length ? (
          <div className="notice" role="status">
            <strong>
              Factura {queuedLines[0].invoiceNumber}: {queuedLines.length} línea(s) listas.
            </strong>
            <p>
              Agrega la línea actual antes de guardar. Las líneas se registran juntas o ninguna.
            </p>
            <ul>
              {queuedLines.map((line, index) => (
                <li key={line.id}>
                  {itemNames.get(line.catalogItemId) ?? line.catalogItemId} · {line.quantity} × USD{' '}
                  {(line.unitCost ?? 0).toFixed(4)}{' '}
                  <Button
                    className="button-secondary"
                    onClick={() =>
                      setQueuedLines((current) =>
                        current.filter((candidate) => candidate.id !== line.id),
                      )
                    }
                    type="button"
                  >
                    Quitar línea {index + 1}
                  </Button>
                </li>
              ))}
            </ul>
            {purchaseTotals(queuedLines) ? (
              <p>
                Subtotal: USD {purchaseTotals(queuedLines)!.subtotal.toFixed(2)} · IVA 13%: USD{' '}
                {purchaseTotals(queuedLines)!.iva.toFixed(2)} · Percepción: USD{' '}
                {purchaseTotals(queuedLines)!.perception.toFixed(2)} · Total: USD{' '}
                {purchaseTotals(queuedLines)!.total.toFixed(2)}
              </p>
            ) : null}
          </div>
        ) : null}
        <form
          className="form-grid"
          id="purchase-form"
          noValidate
          onSubmit={form.handleSubmit(submit)}
        >
          <label>
            Ítem de catálogo
            <SearchableSelect
              actionId="PURCHASE-CATALOG-SEARCH"
              ariaLabel="Ítem de catálogo"
              onChange={selectCatalogItem}
              options={purchaseCatalogOptions}
              placeholder="Escribe el inicio del código o de una palabra"
              value={selectedCatalogItemId ?? ''}
            />
            {form.formState.errors.catalogItemId ? (
              <span className="field-error">{form.formState.errors.catalogItemId.message}</span>
            ) : null}
          </label>
          <label>
            Proveedor
            <select {...form.register('supplierCatalogItemId')}>
              <option value="">Seleccione un proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            {form.formState.errors.supplierCatalogItemId ? (
              <span className="field-error">
                {form.formState.errors.supplierCatalogItemId.message}
              </span>
            ) : null}
          </label>
          <label>
            Orden de compra vinculada (opcional)
            <select {...form.register('purchaseOrderId')}>
              <option value="">Compra sin orden vinculada</option>
              {orders
                .filter(
                  (order) =>
                    order.supplierCatalogItemId === selectedSupplierId &&
                    order.items.some((line) => line.catalogItemId === selectedCatalogItemId),
                )
                .map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber}
                  </option>
                ))}
            </select>
            {form.formState.errors.purchaseOrderId ? (
              <span className="field-error">{form.formState.errors.purchaseOrderId.message}</span>
            ) : null}
          </label>
          <label>
            Bodega de destino
            <select {...form.register('warehouseId')}>
              <option value="">Seleccione una bodega</option>
              {activeWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            {form.formState.errors.warehouseId ? (
              <span className="field-error">{form.formState.errors.warehouseId.message}</span>
            ) : null}
          </label>
          <label>
            Cantidad
            <input
              min="1"
              step="1"
              max={selectedItem?.category === 'EQUIPMENT' ? 1 : 1000000}
              type="number"
              {...form.register('quantity', { valueAsNumber: true })}
            />
            {selectedItem?.category === 'EQUIPMENT' ? (
              <span className="field-help">Cada equipo se registra individualmente.</span>
            ) : null}
            {form.formState.errors.quantity ? (
              <span className="field-error">{form.formState.errors.quantity.message}</span>
            ) : null}
          </label>
          <label>
            Costo unitario
            <input
              min="0"
              step="0.0001"
              type="number"
              {...form.register('unitCost', { valueAsNumber: true })}
            />
            <span className="field-help">Se completa con el costo definido en Catálogos.</span>
            {form.formState.errors.unitCost ? (
              <span className="field-error">{form.formState.errors.unitCost.message}</span>
            ) : null}
          </label>
          <label>
            <input
              checked={applyPerception}
              data-action-id="PURCHASE-PERCEPTION"
              disabled={Boolean(editing)}
              onChange={(event) => setApplyPerception(event.target.checked)}
              type="checkbox"
            />{' '}
            Aplicar percepción del 1% a esta factura
            <span className="field-help">
              Los precios ingresados son sin IVA. El IVA solicitado del 13% se calcula
              automáticamente; la percepción se activa sólo cuando corresponda.
            </span>
          </label>
          <label>
            Referencia de compra
            <input {...form.register('reference')} />
            {form.formState.errors.reference ? (
              <span className="field-error">{form.formState.errors.reference.message}</span>
            ) : null}
          </label>
          <label>
            Número de factura (opcional)
            <input {...form.register('invoiceNumber')} maxLength={100} />
            {form.formState.errors.invoiceNumber ? (
              <span className="field-error">{form.formState.errors.invoiceNumber.message}</span>
            ) : null}
          </label>
          <label>
            Vida útil del artículo
            <input
              {...form.register('usefulLife')}
              data-action-id="PURCHASE-USEFUL-LIFE"
              maxLength={120}
              placeholder="Indique duración y unidad"
            />
          </label>
          <label>
            <input
              {...form.register('isFixedAsset')}
              data-action-id="PURCHASE-FIXED-ASSET"
              type="checkbox"
            />{' '}
            Registrar como activo fijo
          </label>
          {selectedItem?.category === 'MEDICATIONS' || selectedItem?.category === 'SUPPLIES' ? (
            <>
              <label>
                Fecha de vencimiento
                <input type="date" {...form.register('expirationDate')} />
                {form.formState.errors.expirationDate ? (
                  <span className="field-error">
                    {form.formState.errors.expirationDate.message}
                  </span>
                ) : null}
              </label>
              <label>
                Lote
                <input {...form.register('lotNumber')} />
                {form.formState.errors.lotNumber ? (
                  <span className="field-error">{form.formState.errors.lotNumber.message}</span>
                ) : null}
              </label>
            </>
          ) : null}
          {selectedItem?.category === 'EQUIPMENT' ? (
            <label>
              Número de serie
              <input {...form.register('serialNumber')} />
              {form.formState.errors.serialNumber ? (
                <span className="field-error">{form.formState.errors.serialNumber.message}</span>
              ) : null}
            </label>
          ) : null}
          <label>
            Nota (opcional)
            <textarea {...form.register('note')} rows={3} />
          </label>
        </form>
      </Dialog>
      <Dialog
        description="Detalle persistido de la factura y sus líneas. Cada recepción se registra por separado."
        footer={
          <Button
            className="button-secondary"
            data-action-id="PURCHASE-DETAIL-CLOSE"
            onClick={() => setSelected(null)}
            type="button"
          >
            Cerrar
          </Button>
        }
        onClose={() => setSelected(null)}
        open={Boolean(selected)}
        title="Detalle de factura o compra"
      >
        {selected ? (
          <>
            <dl className="detail-grid">
              <div>
                <dt>Referencia</dt>
                <dd>{selected.reference}</dd>
              </div>
              <div>
                <dt>Número de factura</dt>
                <dd>
                  {selected.invoiceNumber || 'No registrado'}
                  {selected.invoiceVoidedAt ? ' · Anulada' : ''}
                </dd>
              </div>
              {selected.invoiceGroupId ? (
                <div>
                  <dt>Factura completa</dt>
                  <dd>
                    {invoiceLines(selected).length} línea(s) · USD{' '}
                    {(
                      purchaseTotals(invoiceLines(selected))?.total ??
                      invoiceLines(selected).reduce(
                        (total, line) => total + (line.quantity ?? 1) * (line.unitCost ?? 0),
                        0,
                      )
                    ).toFixed(2)}
                  </dd>
                </div>
              ) : null}
              {purchaseTotals(invoiceLines(selected)) ? (
                <>
                  <div>
                    <dt>Subtotal sin IVA</dt>
                    <dd>USD {purchaseTotals(invoiceLines(selected))!.subtotal.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>IVA 13%</dt>
                    <dd>USD {purchaseTotals(invoiceLines(selected))!.iva.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>IVA percibido 1% (selección manual)</dt>
                    <dd>USD {purchaseTotals(invoiceLines(selected))!.perception.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd>USD {purchaseTotals(invoiceLines(selected))!.total.toFixed(2)}</dd>
                  </div>
                </>
              ) : null}
              {selected.invoiceVoidedAt ? (
                <div>
                  <dt>Anulación de factura</dt>
                  <dd>
                    {new Date(selected.invoiceVoidedAt).toLocaleString('es-SV')} ·{' '}
                    {selected.invoiceVoidReason}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Ítem de catálogo</dt>
                <dd>{itemNames.get(selected.catalogItemId) ?? selected.catalogItemId}</dd>
              </div>
              <div>
                <dt>Proveedor</dt>
                <dd>{itemNames.get(selected.supplierCatalogItemId ?? '') ?? 'No documentado'}</dd>
              </div>
              <div>
                <dt>Bodega de destino</dt>
                <dd>
                  {selected.warehouseId
                    ? (warehouseNames.get(selected.warehouseId) ?? selected.warehouseId)
                    : 'Sin bodega asignada'}
                </dd>
              </div>
              <div>
                <dt>Estado de esta línea</dt>
                <dd>
                  {selected.status === 'RECEIVED'
                    ? 'Recepción registrada'
                    : selected.status === 'CANCELLED'
                      ? 'Anulada'
                      : 'Borrador'}
                </dd>
              </div>
              {selected.cancelReason ? (
                <div>
                  <dt>Motivo de anulación</dt>
                  <dd>{selected.cancelReason}</dd>
                </div>
              ) : null}
              {selected.receivedAt ? (
                <div>
                  <dt>Recepción física</dt>
                  <dd>{new Date(selected.receivedAt).toLocaleString('es-SV')}</dd>
                </div>
              ) : null}
              <div>
                <dt>Cantidad y costo</dt>
                <dd>
                  {selected.quantity ?? 1} × USD {(selected.unitCost ?? 0).toFixed(4)} = USD{' '}
                  {((selected.quantity ?? 1) * (selected.unitCost ?? 0)).toFixed(2)}
                </dd>
              </div>
              <div>
                <dt>Fecha de creación</dt>
                <dd>{new Date(selected.createdAt).toLocaleString('es-SV')}</dd>
              </div>
              <div>
                <dt>Nota</dt>
                <dd>{selected.note || 'Sin nota documentada'}</dd>
              </div>
              <div>
                <dt>Lote / vencimiento</dt>
                <dd>
                  {selected.lotNumber || 'Sin lote'} ·{' '}
                  {selected.expirationDate || 'Sin vencimiento'}
                </dd>
              </div>
              <div>
                <dt>Número de serie</dt>
                <dd>{selected.serialNumber || 'No aplica'}</dd>
              </div>
            </dl>
            {invoiceLines(selected).length > 1 ? (
              <div className="table-wrap">
                <table>
                  <caption>Líneas de la factura</caption>
                  <thead>
                    <tr>
                      <th>Ítem</th>
                      <th>Cantidad</th>
                      <th>Costo</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceLines(selected).map((line) => (
                      <tr key={line.id}>
                        <td>{itemNames.get(line.catalogItemId) ?? line.catalogItemId}</td>
                        <td>{line.quantity ?? 1}</td>
                        <td>
                          {line.unitCost === undefined
                            ? 'No documentado'
                            : `USD ${((line.quantity ?? 1) * line.unitCost).toFixed(2)}`}
                        </td>
                        <td>
                          {line.status === 'RECEIVED'
                            ? 'Recibida'
                            : line.status === 'CANCELLED'
                              ? 'Anulada'
                              : 'Borrador'}
                        </td>
                        <td>
                          <div className="action-row">
                            <Button
                              className="button-secondary"
                              data-action-id="PURCHASE-LINE-DETAIL"
                              onClick={() => setSelected(line)}
                              type="button"
                            >
                              Ver línea
                            </Button>
                            {can('purchases:write') && line.status === 'DRAFT' ? (
                              <>
                                <Button
                                  className="button-secondary"
                                  data-action-id="PURCHASE-LINE-EDIT"
                                  onClick={() => {
                                    setSelected(null);
                                    edit(line);
                                  }}
                                  type="button"
                                >
                                  Editar línea
                                </Button>
                                <Button
                                  className="button-secondary danger"
                                  data-action-id="PURCHASE-LINE-CANCEL"
                                  onClick={() => {
                                    setSelected(null);
                                    setCancelError(null);
                                    setCancelling(line);
                                  }}
                                  type="button"
                                >
                                  Anular línea
                                </Button>
                              </>
                            ) : null}
                            {can('purchases:write') &&
                            can('inventory:write') &&
                            line.status === 'DRAFT' &&
                            line.warehouseId ? (
                              <Button
                                className="button-secondary"
                                data-action-id="PURCHASE-LINE-RECEIVE"
                                disabled={!warehouseConnected || receiptBusy}
                                onClick={() => {
                                  setSelected(null);
                                  setReceiptError(null);
                                  setReceiptSelection({
                                    purchase: line,
                                    receivedAt: new Date().toISOString(),
                                  });
                                }}
                                type="button"
                              >
                                Recibir línea
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : null}
      </Dialog>
      <Dialog
        description="Sólo se anula un borrador que aún no fue recibido. La anulación queda auditada."
        footer={
          <>
            <Button className="button-secondary" onClick={() => setCancelling(null)} type="button">
              Volver
            </Button>
            <Button form="purchase-cancel-form" type="submit">
              Confirmar anulación
            </Button>
          </>
        }
        onClose={() => setCancelling(null)}
        open={Boolean(cancelling)}
        title="Anular borrador de compra"
      >
        <form action={confirmCancellation} id="purchase-cancel-form">
          <label>
            Motivo de anulación
            <textarea maxLength={1000} name="reason" required rows={3} />
          </label>
          {cancelError ? (
            <p className="notice danger" role="alert">
              {cancelError}
            </p>
          ) : null}
        </form>
      </Dialog>
      <Dialog
        description={
          voidingInvoice?.status === 'DRAFT'
            ? 'Anula todas las líneas en borrador de esta factura en una operación. No afecta inventario.'
            : 'Anula únicamente el documento de factura. La compra recibida y sus lotes permanecen registrados; si hubo devolución física, debe registrarse por separado para conservar la trazabilidad.'
        }
        footer={
          <>
            <Button
              className="button-secondary"
              onClick={() => setVoidingInvoice(null)}
              type="button"
            >
              Volver
            </Button>
            <Button form="purchase-invoice-void-form" type="submit">
              Confirmar anulación de factura
            </Button>
          </>
        }
        onClose={() => setVoidingInvoice(null)}
        open={Boolean(voidingInvoice)}
        title="Anular factura"
      >
        <form action={confirmInvoiceVoid} id="purchase-invoice-void-form">
          <label>
            Motivo de anulación
            <textarea maxLength={1000} name="reason" required rows={3} />
          </label>
          {cancelError ? (
            <p className="notice danger" role="alert">
              {cancelError}
            </p>
          ) : null}
        </form>
      </Dialog>
      <Dialog
        description="Confirma la recepción física completa en la bodega del borrador. El lote o serie quedará en cuarentena y no se sumará al disponible hasta su liberación."
        footer={
          <>
            <Button
              className="button-secondary"
              onClick={() => setReceiptSelection(null)}
              type="button"
            >
              Cancelar
            </Button>
            <Button disabled={receiptBusy} form="purchase-receipt-form" type="submit">
              {receiptBusy ? 'Recibiendo…' : 'Confirmar recepción'}
            </Button>
          </>
        }
        onClose={() => setReceiptSelection(null)}
        open={Boolean(receiptSelection)}
        title="Recibir compra"
      >
        {receiptSelection ? (
          <form action={receivePurchase} className="form-grid" id="purchase-receipt-form">
            <p className="full-field">
              {receiptSelection.purchase.reference} ·{' '}
              {warehouseNames.get(receiptSelection.purchase.warehouseId ?? '') ??
                receiptSelection.purchase.warehouseId}
            </p>
            <label className="full-field">
              Motivo / constancia de recepción
              <textarea maxLength={500} name="reason" required rows={3} />
            </label>
            {receiptError ? (
              <p className="notice danger full-field" role="alert">
                {receiptError}
              </p>
            ) : null}
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}
