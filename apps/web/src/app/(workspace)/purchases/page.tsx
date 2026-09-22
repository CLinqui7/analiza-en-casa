'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Purchase } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel } from '@analiza/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';
const schema = z.object({
  catalogItemId: z.string().min(1, 'Seleccione un ítem de catálogo.'),
  supplierCatalogItemId: z.string().min(1, 'Seleccione un proveedor.'),
  reference: z.string().trim().min(1, 'Ingrese una referencia de compra.'),
  note: z.string().trim(),
  quantity: z.number().positive('La cantidad debe ser mayor que cero.'),
  unitCost: z.number().nonnegative('El costo no puede ser negativo.'),
  expirationDate: z.string(),
  lotNumber: z.string().trim(),
  serialNumber: z.string().trim(),
});
type Form = z.infer<typeof schema>;
export default function PurchasesPage() {
  const { addPurchase, catalogItems, error, purchases } = useWorkspace();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Purchase | null>(null);
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
    () =>
      catalogItems.filter((item) => item.status === 'ACTIVE' && item.category === 'PROVIDERS'),
    [catalogItems],
  );
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      catalogItemId: purchasableItems[0]?.id ?? '',
      supplierCatalogItemId: suppliers[0]?.id ?? '',
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
  }, [form, purchasableItems, suppliers]);
  const itemNames = useMemo(
    () => new Map(catalogItems.map((item) => [item.id, item.name])),
    [catalogItems],
  );
  const selectedCatalogItemId = useWatch({ control: form.control, name: 'catalogItemId' });
  const selectedItem = purchasableItems.find((item) => item.id === selectedCatalogItemId);
  const visible = useMemo(
    () =>
      purchases.filter((purchase) =>
        `${purchase.reference} ${itemNames.get(purchase.catalogItemId) ?? ''}`
          .toLocaleLowerCase('es-SV')
          .includes(query.toLocaleLowerCase('es-SV')),
      ),
    [itemNames, purchases, query],
  );
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  function close() {
    setOpen(false);
    form.reset({
      catalogItemId: purchasableItems[0]?.id ?? '',
      supplierCatalogItemId: suppliers[0]?.id ?? '',
      reference: '',
      note: '',
      quantity: 1,
      unitCost: purchasableItems[0]?.costPrice ?? 0,
      expirationDate: '',
      lotNumber: '',
      serialNumber: '',
    });
  }
  async function submit(values: Form) {
    const catalogItem = purchasableItems.find((item) => item.id === values.catalogItemId);
    if (!catalogItem) return;
    if (!suppliers.some((item) => item.id === values.supplierCatalogItemId)) {
      form.setError('supplierCatalogItemId', { message: 'Seleccione un proveedor activo.' });
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
    const saved = await addPurchase({
      id: crypto.randomUUID(),
      catalogItemId: values.catalogItemId,
      supplierCatalogItemId: values.supplierCatalogItemId,
      reference: values.reference,
      note: values.note || undefined,
      quantity: values.quantity,
      unitCost: values.unitCost,
      expirationDate: values.expirationDate || undefined,
      lotNumber: values.lotNumber || undefined,
      serialNumber: values.serialNumber || undefined,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
    } satisfies Purchase);
    if (!saved) return;
    setMessage('Compra guardada como borrador con proveedor y trazabilidad de inventario.');
    close();
  }
  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Inventario</p>
          <h1>Compras</h1>
          <p>
            Registra borradores de compra con proveedor, productos inventariados y trazabilidad de
            lote, vencimiento o serie.
          </p>
        </div>
        {can('purchases:write') ? (
          <Button
            data-action-id="PURCHASE-CREATE"
            disabled={!purchasableItems.length || !suppliers.length}
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
      {can('purchases:write') && (!suppliers.length || !purchasableItems.length) ? (
        <div className="notice" role="status">
          <strong>Antes de registrar una compra:</strong>{' '}
          {!suppliers.length ? 'agrega al menos un proveedor activo' : ''}
          {!suppliers.length && !purchasableItems.length ? ' y ' : ''}
          {!purchasableItems.length
            ? 'agrega un medicamento, insumo o equipo activo'
            : ''}{' '}
          en <Link href="/catalogs/operational">Catálogos operativos</Link>.
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
            disabled
            type="button"
          >
            Excel
          </Button>
        </div>
        <p className="field-help" id="purchase-export-help">
          La exportación requiere formato, columnas, permisos y minimización aprobados (CH13-Q012).
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
                    <Button
                      className="button-secondary"
                      data-action-id="PURCHASE-DETAIL-OPEN"
                      onClick={() => setSelected(purchase)}
                      type="button"
                    >
                      Abrir
                    </Button>
                  </td>
                  <td>Compra</td>
                  <td>
                    <code>{purchase.reference}</code>
                    <p className="field-help">{purchase.note ?? 'Sin nota documentada'}</p>
                  </td>
                  <td>{itemNames.get(purchase.supplierCatalogItemId ?? '') ?? 'No documentado'}</td>
                  <td>
                    {purchase.unitCost === undefined
                      ? 'No documentado'
                      : `USD ${((purchase.quantity ?? 1) * purchase.unitCost).toFixed(2)}`}
                  </td>
                  <td>No documentado</td>
                  <td>{new Date(purchase.createdAt).toLocaleDateString('es-SV')}</td>
                  <td>Borrador</td>
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
            <select
              {...form.register('catalogItemId')}
              onChange={(event) => {
                form.setValue('catalogItemId', event.target.value, { shouldValidate: true });
                form.setValue(
                  'unitCost',
                  purchasableItems.find((item) => item.id === event.target.value)?.costPrice ?? 0,
                  { shouldValidate: true },
                );
              }}
            >
              {purchasableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} · {item.name}
                </option>
              ))}
            </select>
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
            Cantidad
            <input
              min="0.01"
              step="0.01"
              type="number"
              {...form.register('quantity', { valueAsNumber: true })}
            />
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
                  <span className="field-error">{form.formState.errors.expirationDate.message}</span>
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
              <dd>
                {itemNames.get(selected.supplierCatalogItemId ?? '') ?? 'No documentado'}
              </dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>Borrador</dd>
            </div>
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
    </div>
  );
}
