'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Purchase } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel } from '@analiza/ui';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';
const schema = z.object({
  catalogItemId: z.string().min(1, 'Seleccione un ítem de catálogo.'),
  reference: z.string().trim().min(1, 'Ingrese una referencia de compra.'),
  note: z.string().trim(),
  quantity: z.number().positive('La cantidad debe ser mayor que cero.'),
  unitCost: z.number().nonnegative('El costo no puede ser negativo.'),
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
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      catalogItemId: catalogItems[0]?.id ?? '',
      reference: '',
      note: '',
      quantity: 1,
      unitCost: catalogItems[0]?.costPrice ?? 0,
    },
  });
  useEffect(() => {
    const current = form.getValues('catalogItemId');
    if (!catalogItems.some((item) => item.id === current) && catalogItems[0]) {
      form.setValue('catalogItemId', catalogItems[0].id, { shouldValidate: true });
      form.setValue('unitCost', catalogItems[0].costPrice ?? 0, { shouldValidate: true });
    }
  }, [catalogItems, form]);
  const itemNames = useMemo(
    () => new Map(catalogItems.map((item) => [item.id, item.name])),
    [catalogItems],
  );
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
      catalogItemId: catalogItems[0]?.id ?? '',
      reference: '',
      note: '',
      quantity: 1,
      unitCost: catalogItems[0]?.costPrice ?? 0,
    });
  }
  async function submit(values: Form) {
    if (!catalogItems.some((item) => item.id === values.catalogItemId)) return;
    const saved = await addPurchase({
      id: crypto.randomUUID(),
      catalogItemId: values.catalogItemId,
      reference: values.reference,
      note: values.note || undefined,
      quantity: values.quantity,
      unitCost: values.unitCost,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
    } satisfies Purchase);
    if (!saved) return;
    setMessage('Compra sintética guardada como borrador con evidencia de auditoría.');
    close();
  }
  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Inventario</p>
          <h1>Compras</h1>
          <p>
            Listado factual de borradores sintéticos. No crea recepción, stock, proveedor, factura,
            costo, impuestos ni estados financieros sin reglas aprobadas.
          </p>
        </div>
        {can('purchases:write') ? (
          <Button
            data-action-id="PURCHASE-CREATE"
            disabled={!catalogItems.length}
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
                  <td>Borrador sintético</td>
                  <td>
                    <code>{purchase.reference}</code>
                    <p className="field-help">{purchase.note ?? 'Sin nota documentada'}</p>
                  </td>
                  <td>
                    {purchase.unitCost === undefined
                      ? 'No documentado'
                      : `USD ${((purchase.quantity ?? 1) * purchase.unitCost).toFixed(2)}`}
                  </td>
                  <td>No documentado</td>
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
        description="Este registro no ejecuta una recepción ni cambia inventario."
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
        title="Nueva compra sintética"
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
                  catalogItems.find((item) => item.id === event.target.value)?.costPrice ?? 0,
                  { shouldValidate: true },
                );
              }}
            >
              {catalogItems.map((item) => (
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
          <label>
            Nota (opcional)
            <textarea {...form.register('note')} rows={3} />
          </label>
        </form>
      </Dialog>
      <Dialog
        description="Sólo se muestran los campos persistidos. No se infieren proveedor, factura, impuestos, recepción ni total."
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
          </dl>
        ) : null}
      </Dialog>
    </div>
  );
}
