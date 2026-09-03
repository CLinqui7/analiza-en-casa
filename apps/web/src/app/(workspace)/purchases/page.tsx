'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Purchase } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel } from '@analiza/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';
const schema = z.object({
  catalogItemId: z.string().min(1, 'Seleccione un ítem de catálogo.'),
  reference: z.string().trim().min(1, 'Ingrese una referencia de compra.'),
  note: z.string().trim(),
});
type Form = z.infer<typeof schema>;
export default function PurchasesPage() {
  const { addPurchase, catalogItems, purchases } = useWorkspace();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { catalogItemId: catalogItems[0]?.id ?? '', reference: '', note: '' },
  });
  const visible = purchases.filter((purchase) =>
    `${purchase.reference} ${catalogItems.find((item) => item.id === purchase.catalogItemId)?.name ?? ''}`
      .toLocaleLowerCase('es-SV')
      .includes(query.toLocaleLowerCase('es-SV')),
  );
  function close() {
    setOpen(false);
    form.reset({ catalogItemId: catalogItems[0]?.id ?? '', reference: '', note: '' });
  }
  function submit(values: Form) {
    if (!catalogItems.some((item) => item.id === values.catalogItemId)) return;
    addPurchase({
      id: crypto.randomUUID(),
      catalogItemId: values.catalogItemId,
      reference: values.reference,
      note: values.note || undefined,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
    } satisfies Purchase);
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
            <select aria-label="Registros por página" disabled value="10">
              <option value="10">10</option>
            </select>
          </label>
          <label>
            Buscar compras
            <input
              data-action-id="PURCHASE-LIST-SEARCH"
              onChange={(event) => setQuery(event.target.value)}
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
              {visible.map((purchase) => (
                <tr key={purchase.id}>
                  <td>—</td>
                  <td>Borrador sintético</td>
                  <td>
                    <code>{purchase.reference}</code>
                    <p className="field-help">{purchase.note ?? 'Sin nota documentada'}</p>
                  </td>
                  <td>No documentado</td>
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
        <p className="field-help">Mostrando página 0 de 0 · Anterior · Siguiente</p>
      </Panel>
      <Dialog
        description="Este registro no ejecuta una recepción ni cambia inventario."
        footer={
          <>
            <Button className="button-secondary" onClick={close} type="button">
              Cancelar
            </Button>
            <Button form="purchase-form" type="submit">
              Guardar borrador
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
            <select {...form.register('catalogItemId')}>
              {catalogItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} · {item.name}
                </option>
              ))}
            </select>
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
    </div>
  );
}
