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
import { useOperations } from '@/lib/use-operations';
const schema = z.object({
  catalogItemId: z.string().min(1, 'Seleccione un ítem de catálogo.'),
  supplierCatalogItemId: z.string().min(1, 'Seleccione un proveedor.'),
  warehouseId: z.string().min(1, 'Seleccione una bodega de destino.'),
  reference: z.string().trim().min(1, 'Ingrese una referencia de compra.').max(200),
  note: z.string().trim(),
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
  const { addPurchase, catalogItems, error, purchases, refreshWorkspace } = useWorkspace();
  const { can } = useAuth();
  const {
    warehouses,
    connected: warehouseConnected,
    error: warehouseError,
    busy: receiptBusy,
    execute: executeReceipt,
  } = useOperations();
  const [open, setOpen] = useState(false);
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
      note: '',
      quantity: 1,
      unitCost: purchasableItems[0]?.costPrice ?? 0,
      expirationDate: '',
      lotNumber: '',
      serialNumber: '',
    },
  });
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
  const selectedItem = purchasableItems.find((item) => item.id === selectedCatalogItemId);
  const purchaseCatalogOptions = useMemo(
    () =>
      purchasableItems.map((item) => ({
        value: item.id,
        label: `${item.sku} · ${item.name}`,
      })),
    [purchasableItems],
  );
  const visible = useMemo(
    () =>
      purchases.filter((purchase) =>
        `${purchase.reference} ${itemNames.get(purchase.catalogItemId) ?? ''} ${warehouseNames.get(purchase.warehouseId ?? '') ?? ''}`
          .toLocaleLowerCase('es-SV')
          .includes(query.toLocaleLowerCase('es-SV')),
      ),
    [itemNames, purchases, query, warehouseNames],
  );
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  async function exportPurchasesXlsx() {
    const { createXlsxWorkbook } = await import('@/lib/xlsx');
    const workbookBytes = createXlsxWorkbook(
      [
        { key: 'reference', label: 'Referencia', width: 26 },
        { key: 'item', label: 'Ítem', width: 36 },
        { key: 'supplier', label: 'Proveedor', width: 30 },
        { key: 'warehouse', label: 'Bodega', width: 26 },
        { key: 'quantity', label: 'Cantidad' },
        { key: 'unitCost', label: 'Costo unitario' },
        { key: 'total', label: 'Total' },
        { key: 'status', label: 'Estado' },
        { key: 'createdAt', label: 'Fecha de creación', width: 22 },
      ],
      visible.map((purchase) => ({
        reference: purchase.reference,
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
        status: purchase.status === 'RECEIVED' ? 'Recibida en cuarentena' : 'Borrador',
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
    form.reset({
      catalogItemId: purchasableItems[0]?.id ?? '',
      supplierCatalogItemId: suppliers[0]?.id ?? '',
      warehouseId: activeWarehouses[0]?.id ?? '',
      reference: '',
      note: '',
      quantity: 1,
      unitCost: purchasableItems[0]?.costPrice ?? 0,
      expirationDate: '',
      lotNumber: '',
      serialNumber: '',
    });
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
  async function submit(values: Form) {
    const catalogItem = purchasableItems.find((item) => item.id === values.catalogItemId);
    if (!catalogItem) return;
    if (!suppliers.some((item) => item.id === values.supplierCatalogItemId)) {
      form.setError('supplierCatalogItemId', { message: 'Seleccione un proveedor activo.' });
      return;
    }
    if (!activeWarehouses.some((warehouse) => warehouse.id === values.warehouseId)) {
      form.setError('warehouseId', { message: 'Seleccione una bodega activa.' });
      return;
    }
    if (['MEDICATIONS', 'SUPPLIES'].includes(catalogItem.category ?? '')) {
      if (!values.expirationDate) {
        form.setError('expirationDate', { message: 'Indique la fecha de vencimiento.' });
        return;
      }
      if (!values.lotNumber) {
        form.setError('lotNumber', { message: 'Indique el lote.' });
        return;
      }
    }
    if (catalogItem.category === 'EQUIPMENT' && !values.serialNumber) {
      form.setError('serialNumber', { message: 'Indique el número de serie.' });
      return;
    }
    if (catalogItem.category === 'EQUIPMENT' && values.quantity !== 1) {
      form.setError('quantity', {
        message: 'Cada equipo con número de serie se registra por unidad.',
      });
      return;
    }
    const purchase = normalizePurchaseTraceability(
      {
        id: crypto.randomUUID(),
        catalogItemId: values.catalogItemId,
        supplierCatalogItemId: values.supplierCatalogItemId,
        warehouseId: values.warehouseId,
        reference: values.reference,
        note: values.note || undefined,
        quantity: values.quantity,
        unitCost: values.unitCost,
        expirationDate: values.expirationDate || undefined,
        lotNumber: values.lotNumber || undefined,
        serialNumber: values.serialNumber || undefined,
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
      } satisfies Purchase,
      catalogItem.category,
    );
    const saved = await addPurchase(purchase);
    if (!saved) return;
    setMessage('Compra guardada como borrador con bodega de destino y trazabilidad de inventario.');
    close();
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
            en Lotes y series.
          </p>
        </div>
        {can('purchases:write') ? (
          <Button
            data-action-id="PURCHASE-CREATE"
            disabled={!purchasableItems.length || !suppliers.length || !activeWarehouses.length}
            onClick={() => {
              setMessage(null);
              setOpen(true);
            }}
            type="button"
          >
            Nueva compra
          </Button>
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
          Descarga las compras visibles según la búsqueda actual en un archivo XLSX. No incluye
          adjuntos ni datos clínicos.
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
                  'Número',
                  'Proveedor',
                  'Total',
                  '# Factura',
                  'Fecha',
                  'Estado',
                  'Registro PT',
                ].map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((purchase) => (
                <tr key={purchase.id}>
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
                      {can('purchases:write') &&
                      can('inventory:write') &&
                      purchase.status === 'DRAFT' &&
                      purchase.warehouseId ? (
                        <Button
                          className="button-secondary"
                          data-action-id="PURCHASE-RECEIVE"
                          disabled={!warehouseConnected || receiptBusy}
                          onClick={() => {
                            setReceiptError(null);
                            setReceiptSelection({ purchase, receivedAt: new Date().toISOString() });
                          }}
                          type="button"
                        >
                          Recibir
                        </Button>
                      ) : null}
                    </div>
                  </td>
                  <td>Compra</td>
                  <td>
                    <code>{purchase.reference}</code>
                    <p className="field-help">{purchase.note ?? 'Sin nota documentada'}</p>
                    <p className="field-help">
                      Bodega:{' '}
                      {purchase.warehouseId
                        ? (warehouseNames.get(purchase.warehouseId) ?? purchase.warehouseId)
                        : 'Sin bodega asignada'}
                    </p>
                  </td>
                  <td>{itemNames.get(purchase.supplierCatalogItemId ?? '') ?? 'No documentado'}</td>
                  <td>
                    {purchase.unitCost === undefined
                      ? 'No documentado'
                      : `USD ${((purchase.quantity ?? 1) * purchase.unitCost).toFixed(2)}`}
                  </td>
                  <td>No documentado</td>
                  <td>{new Date(purchase.createdAt).toLocaleDateString('es-SV')}</td>
                  <td>{purchase.status === 'RECEIVED' ? 'Recibida en cuarentena' : 'Borrador'}</td>
                  <td>No documentado</td>
                </tr>
              ))}
              {!visible.length ? (
                <tr>
                  <td colSpan={9}>
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
            {visible.length} registros
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
        description="Registra el borrador y la trazabilidad de la compra; no descuenta ni recibe inventario automáticamente."
        footer={
          <>
            <Button className="button-secondary" onClick={close} type="button">
              Cancelar
            </Button>
            <Button disabled={form.formState.isSubmitting} form="purchase-form" type="submit">
              {form.formState.isSubmitting ? 'Guardando…' : 'Guardar borrador'}
            </Button>
          </>
        }
        onClose={close}
        open={open}
        title="Nueva compra"
      >
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
              step="0.01"
              type="number"
              {...form.register('unitCost', { valueAsNumber: true })}
            />
            <span className="field-help">Se completa con el costo definido en Catálogos.</span>
            {form.formState.errors.unitCost ? (
              <span className="field-error">{form.formState.errors.unitCost.message}</span>
            ) : null}
          </label>
          <label>
            Referencia de compra
            <input {...form.register('reference')} />
            {form.formState.errors.reference ? (
              <span className="field-error">{form.formState.errors.reference.message}</span>
            ) : null}
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
        description="Detalle persistido del borrador de compra."
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
        title="Detalle de compra sintética"
      >
        {selected ? (
          <dl className="detail-grid">
            <div>
              <dt>Referencia</dt>
              <dd>{selected.reference}</dd>
            </div>
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
              <dt>Estado</dt>
              <dd>{selected.status === 'RECEIVED' ? 'Recibida en cuarentena' : 'Borrador'}</dd>
            </div>
            {selected.receivedAt ? (
              <div>
                <dt>Recepción física</dt>
                <dd>{new Date(selected.receivedAt).toLocaleString('es-SV')}</dd>
              </div>
            ) : null}
            <div>
              <dt>Cantidad y costo</dt>
              <dd>
                {selected.quantity ?? 1} × USD {(selected.unitCost ?? 0).toFixed(2)} = USD{' '}
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
                {selected.lotNumber || 'Sin lote'} · {selected.expirationDate || 'Sin vencimiento'}
              </dd>
            </div>
            <div>
              <dt>Número de serie</dt>
              <dd>{selected.serialNumber || 'No aplica'}</dd>
            </div>
          </dl>
        ) : null}
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
