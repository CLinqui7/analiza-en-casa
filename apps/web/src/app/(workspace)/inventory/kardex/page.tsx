'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type InventoryMovement } from '@analiza/contracts';
import { canRecordMovement } from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import '../stock.css';
import { inventoryLedger } from '@/lib/inventory-ledger';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';
import { useOperations } from '@/lib/use-operations';

const demoItemCatalog: Record<string, { name: string; sku: string }> = {
  'inventory-demo-kit': { name: 'Kit operativo demo', sku: 'KIT-DEMO-001' },
  'inventory-demo-supplies': { name: 'Insumos demo', sku: 'INS-DEMO-001' },
};
const demoWarehouses: Record<string, string> = {
  'warehouse-demo-central': 'Bodega central demo',
  'warehouse-demo-north': 'Bodega norte demo',
};
const movementFormSchema = z.object({
  itemId: z.string().min(1, 'Seleccione un ítem.'),
  warehouseId: z.string().min(1, 'Seleccione una bodega.'),
  kind: z.enum(['ENTRY', 'EXIT', 'RETURN']),
  quantity: z.coerce.number().int().positive('La cantidad debe ser un entero positivo.'),
});
type MovementFormInput = z.input<typeof movementFormSchema>;
type MovementForm = z.output<typeof movementFormSchema>;
type Filters = {
  itemId: string;
  from: string;
  to: string;
  warehouseId: string;
  kind: string;
  reference: string;
};

const kindLabel: Record<InventoryMovement['kind'], string> = {
  ENTRY: 'Entrada',
  EXIT: 'Salida',
  TRANSFER: 'Transferencia',
  RETURN: 'Devolución',
  ADJUSTMENT: 'Ajuste',
};

function direction(movement: InventoryMovement) {
  if (movement.kind === 'ENTRY' || movement.kind === 'RETURN') return 'in';
  if (movement.kind === 'TRANSFER') return movement.transferDirection === 'IN' ? 'in' : 'out';
  if (movement.kind === 'EXIT') return 'out';
  return movement.adjustmentDirection === 'OUT' ? 'out' : 'in';
}

export default function KardexPage() {
  const {
    addInventoryMovement,
    inventoryMovements,
    catalogItems,
    patients,
    purchases,
    providerMode,
  } = useWorkspace();
  const operations = useOperations();
  const itemCatalog = useMemo(
    () => ({
      ...(providerMode === 'mock' ? demoItemCatalog : {}),
      ...Object.fromEntries(
        catalogItems
          .filter(
            (item) =>
              item.status === 'ACTIVE' &&
              ['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT'].includes(item.category ?? ''),
          )
          .map((item) => [item.id, { name: item.name, sku: item.sku }]),
      ),
    }),
    [catalogItems, providerMode],
  );
  const warehouses: Record<string, string> = {
    ...(providerMode === 'mock' ? demoWarehouses : {}),
    ...Object.fromEntries(
      inventoryMovements
        .filter((item) => item.warehouseId)
        .map((item) => [
          item.warehouseId!,
          item.warehouseId === 'central' ? 'Bodega central' : item.warehouseId!,
        ]),
    ),
    // Keep the configured label authoritative, including for inactive warehouses that
    // still appear in the immutable movement history.
    ...Object.fromEntries(operations.warehouses.map((warehouse) => [warehouse.id, warehouse.name])),
  };
  const activeWarehouses = operations.warehouses.filter(
    (warehouse) => warehouse.status === 'ACTIVE',
  );
  const { can, session } = useAuth();
  const [page, setPage] = useState(0);
  const [request, setRequest] = useState(() => ({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }));
  const [isOpen, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    itemId: '',
    from: '',
    to: '',
    warehouseId: '',
    kind: '',
    reference: '',
  });
  const names = useMemo(
    () => new Map([...patients, ...operations.deliveryPatients].map((p) => [p.id, p.fullName])),
    [patients, operations.deliveryPatients],
  );
  const allRows = useMemo(
    () =>
      inventoryLedger(
        inventoryMovements,
        operations.traceRecords,
        operations.inventoryLedgerReceipts,
        purchases,
        operations.homeCustodies,
        operations.clinicalRecords,
      ),
    [
      inventoryMovements,
      operations.traceRecords,
      operations.inventoryLedgerReceipts,
      purchases,
      operations.homeCustodies,
      operations.clinicalRecords,
    ],
  );
  const itemIds = useMemo(
    () => [...new Set([...Object.keys(itemCatalog), ...allRows.map((m) => m.itemId)])],
    [allRows, itemCatalog],
  );
  const activeItemIds = Object.keys(itemCatalog);
  const rows = allRows.filter((row) => {
    const date = row.createdAt.slice(0, 10);
    return (
      (!filters.itemId || row.itemId === filters.itemId) &&
      (!filters.from || date >= filters.from) &&
      (!filters.to || date <= filters.to) &&
      (!filters.warehouseId || row.warehouseId === filters.warehouseId) &&
      (!filters.kind || row.kind === filters.kind) &&
      (!filters.reference ||
        `${row.purchaseDocumentNumber ?? ''} ${row.reference ?? ''} ${row.reason} ${names.get(row.patientId ?? '') ?? ''}`
          .toLocaleLowerCase('es')
          .includes(filters.reference.toLocaleLowerCase('es')))
    );
  });
  const summary = useMemo(() => {
    let incoming = 0;
    let outgoing = 0;
    for (const row of allRows) {
      if (row.delta >= 0) incoming += row.delta;
      else outgoing -= row.delta;
    }
    const balance = incoming - outgoing;
    return { incoming, outgoing, balance };
  }, [allRows]);
  const form = useForm<MovementFormInput, unknown, MovementForm>({
    resolver: zodResolver(movementFormSchema),
    defaultValues: {
      itemId: itemIds[0] ?? '',
      warehouseId:
        providerMode === 'mock' ? Object.keys(demoWarehouses)[0] : (activeWarehouses[0]?.id ?? ''),
      kind: 'ENTRY',
      quantity: 1,
    },
  });
  const lastPage = Math.max(0, Math.ceil(rows.length / 50) - 1);
  const visiblePage = Math.min(page, lastPage);

  function closeDialog() {
    setOpen(false);
    form.reset();
  }
  function updateFilter(name: keyof Filters, value: string) {
    setPage(0);
    setFilters((current) => ({ ...current, [name]: value }));
  }
  function resetFilters() {
    setPage(0);
    setFilters({ itemId: '', from: '', to: '', warehouseId: '', kind: '', reference: '' });
  }
  async function submit(values: MovementForm) {
    const movement: InventoryMovement = {
      ...request,
      itemId: values.itemId,
      warehouseId: values.warehouseId,
      kind: values.kind,
      quantity: values.quantity,
      reason: `${kindLabel[values.kind]} manual`,
      user: session?.role ?? 'Sistema demo',
    };
    if (!canRecordMovement(inventoryMovements, movement)) {
      form.setError('quantity', {
        type: 'validate',
        message:
          'El movimiento dejaría un saldo negativo; corrija la cantidad o registre una entrada auditada.',
      });
      return;
    }
    if (!(await addInventoryMovement(movement))) {
      form.setError('quantity', {
        message: 'No se guardó el movimiento. Revise el artículo, las existencias y la conexión.',
      });
      return;
    }
    setResult('Movimiento persistido. El saldo se recalculó desde el historial cronológico.');
    closeDialog();
  }

  return (
    <div className="page-stack inventory-ledger-page">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Analiza en Casa · Inventario</p>
          <h1>Kárdex de inventario</h1>
          <p>
            Consulte las recepciones físicas, las salidas y el saldo disponible por ítem y bodega.
          </p>
        </div>
        <div className="action-row">
          <Link className="button button-secondary" href="/inventory/traceability">
            Control de lotes y series
          </Link>
          {can('inventory:write') ? (
            <Button
              data-action-id="INVENTORY-MOVEMENT-CREATE"
              disabled={
                !activeItemIds.length ||
                (providerMode !== 'mock' && (!operations.connected || !activeWarehouses.length))
              }
              onClick={() => {
                setResult(null);
                setRequest({ id: crypto.randomUUID(), createdAt: new Date().toISOString() });
                form.setValue('itemId', activeItemIds[0] ?? '');
                form.setValue(
                  'warehouseId',
                  providerMode === 'mock'
                    ? Object.keys(demoWarehouses)[0]
                    : (activeWarehouses[0]?.id ?? ''),
                );
                setOpen(true);
              }}
              type="button"
            >
              <span aria-hidden="true">＋</span> Registrar movimiento
            </Button>
          ) : null}
        </div>
      </header>
      {result ? (
        <p className="notice success" role="status">
          {result}
        </p>
      ) : null}
      <section aria-label="Resumen de inventario" className="inventory-ledger-metrics">
        <article>
          <span className="inventory-ledger-metric-icon incoming" aria-hidden="true">
            ↙
          </span>
          <div>
            <small>Entradas a disponible</small>
            <strong>{summary.incoming}</strong>
            <span>unidades registradas</span>
          </div>
        </article>
        <article>
          <span className="inventory-ledger-metric-icon outgoing" aria-hidden="true">
            ↗
          </span>
          <div>
            <small>Salidas de disponible</small>
            <strong>{summary.outgoing}</strong>
            <span>unidades registradas</span>
          </div>
        </article>
        <article>
          <span className="inventory-ledger-metric-icon balance" aria-hidden="true">
            ≋
          </span>
          <div>
            <small>Saldo disponible</small>
            <strong>{summary.balance}</strong>
            <span>en todos los ítems</span>
          </div>
        </article>
        <article>
          <span className="inventory-ledger-metric-icon trace" aria-hidden="true">
            #
          </span>
          <div>
            <small>Trazabilidad</small>
            <strong>{allRows.length}</strong>
            <span>movimientos auditables</span>
          </div>
        </article>
      </section>
      <Panel className="inventory-ledger-filter-panel">
        <div className="table-heading inventory-ledger-filter-heading">
          <div>
            <h2>Filtros del historial</h2>
            <p>Filtre por ítem, fecha, bodega, tipo, documento o paciente.</p>
          </div>
          <StatusTag>{rows.length} visibles</StatusTag>
        </div>
        <div className="inventory-ledger-filter-grid">
          <label>
            Ítem
            <select
              data-action-id="KARDEX-FILTER-ITEM"
              onChange={(event) => updateFilter('itemId', event.target.value)}
              value={filters.itemId}
            >
              <option value="">Todos los ítems</option>
              {itemIds.map((id) => (
                <option key={id} value={id}>
                  {itemCatalog[id]?.name ?? id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input
              data-action-id="KARDEX-FILTER-FROM"
              onChange={(event) => updateFilter('from', event.target.value)}
              type="date"
              value={filters.from}
            />
          </label>
          <label>
            Hasta
            <input
              data-action-id="KARDEX-FILTER-TO"
              onChange={(event) => updateFilter('to', event.target.value)}
              type="date"
              value={filters.to}
            />
          </label>
          <label>
            Bodega
            <select
              data-action-id="KARDEX-FILTER-WAREHOUSE"
              onChange={(event) => updateFilter('warehouseId', event.target.value)}
              value={filters.warehouseId}
            >
              <option value="">Todas</option>
              {Object.entries(warehouses).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select
              data-action-id="KARDEX-FILTER-TYPE"
              onChange={(event) => updateFilter('kind', event.target.value)}
              value={filters.kind}
            >
              <option value="">Todos</option>
              {Object.entries(kindLabel).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Documento o paciente
            <input
              data-action-id="KARDEX-FILTER-REFERENCE"
              onChange={(event) => updateFilter('reference', event.target.value)}
              placeholder="Número o nombre"
              type="search"
              value={filters.reference}
            />
          </label>
          <Button
            className="button-secondary inventory-ledger-reset"
            data-action-id="KARDEX-FILTER-RESET"
            onClick={resetFilters}
            type="button"
          >
            Limpiar filtros
          </Button>
        </div>
      </Panel>
      <Panel className="inventory-ledger-table-panel">
        <div className="table-heading">
          <div>
            <h2>Detalle del Kárdex</h2>
            <p>
              Una recepción en cuarentena se suma al disponible cuando se libera el lote o la serie.
            </p>
          </div>
          <span className="inventory-ledger-live">
            <i aria-hidden="true" /> Historial actualizado
          </span>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="inventory-ledger-table stock-cards">
              <thead>
                <tr>
                  <th>Fecha / hora</th>
                  <th>Ítem</th>
                  <th>Bodega</th>
                  <th>Paciente</th>
                  <th>Movimiento</th>
                  <th>Entrada disponible</th>
                  <th>Salida disponible</th>
                  <th>Saldo disponible</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(visiblePage * 50, (visiblePage + 1) * 50).map((row) => {
                  const rowDirection = direction(row);
                  const date = new Date(row.createdAt);
                  const movementLabel = `${kindLabel[row.kind]}${
                    row.kind === 'ADJUSTMENT'
                      ? ` ${row.adjustmentDirection === 'OUT' ? '−' : '+'}`
                      : ''
                  }`;
                  return (
                    <tr key={row.id}>
                      <td data-stock-label="Fecha">
                        <strong>{date.toLocaleDateString('es-SV')}</strong>
                        <small>
                          {date.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}
                        </small>
                      </td>
                      <td data-stock-label="Ítem">
                        <strong>{itemCatalog[row.itemId]?.name ?? row.itemId}</strong>
                        <small>{row.traceNumber ?? itemCatalog[row.itemId]?.sku}</small>
                      </td>
                      <td data-stock-label="Bodega">
                        {warehouses[row.warehouseId ?? ''] ??
                          row.warehouseId ??
                          'Sin bodega registrada'}
                      </td>
                      <td data-stock-label="Paciente">
                        {row.patientId ? (names.get(row.patientId) ?? 'Paciente vinculado') : '—'}
                      </td>
                      <td data-stock-label="Movimiento">
                        <StatusTag
                          tone={
                            row.heldReceipt
                              ? 'warning'
                              : rowDirection === 'in'
                                ? 'success'
                                : 'neutral'
                          }
                        >
                          {row.heldReceipt ? row.reason : movementLabel}
                        </StatusTag>
                        {row.heldReceipt && <small>{row.quantity} unidades recibidas</small>}
                      </td>
                      <td data-stock-label="Entrada disponible" className="inventory-ledger-in">
                        {row.delta > 0 ? '+' + row.delta : '—'}
                      </td>
                      <td data-stock-label="Salida disponible" className="inventory-ledger-out">
                        {row.delta < 0 ? '−' + Math.abs(row.delta) : '—'}
                      </td>
                      <td data-stock-label="Saldo disponible">
                        <strong>{row.balance}</strong>
                      </td>
                      <td data-stock-label="Responsable">
                        {row.purchaseDocumentNumber ?? row.user ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            detail="Ajuste los filtros o registre un movimiento."
            title="Sin movimientos"
          />
        )}
        {lastPage > 0 && (
          <nav className="action-row" aria-label="Páginas del Kárdex">
            <Button
              className="button-secondary"
              disabled={!visiblePage}
              onClick={() => setPage(visiblePage - 1)}
            >
              Anterior
            </Button>
            <span>
              Página {visiblePage + 1} de {lastPage + 1}
            </span>
            <Button
              className="button-secondary"
              disabled={visiblePage >= lastPage}
              onClick={() => setPage(visiblePage + 1)}
            >
              Siguiente
            </Button>
          </nav>
        )}
      </Panel>
      <Dialog
        description="Cada registro queda en el historial y el saldo se deriva cronológicamente."
        footer={
          <>
            <Button className="button-secondary" onClick={closeDialog} type="button">
              Cancelar
            </Button>
            <Button form="movement-form" type="submit" disabled={form.formState.isSubmitting}>
              Guardar movimiento
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isOpen}
        title="Registrar movimiento de inventario"
      >
        <form
          className="form-grid inventory-movement-form"
          id="movement-form"
          noValidate
          onSubmit={form.handleSubmit(submit)}
        >
          <label>
            Ítem
            <select {...form.register('itemId')}>
              {activeItemIds.map((id) => (
                <option key={id} value={id}>
                  {itemCatalog[id]?.name ?? id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bodega
            <select {...form.register('warehouseId')}>
              {(providerMode === 'mock'
                ? Object.entries(demoWarehouses)
                : activeWarehouses.map((warehouse) => [warehouse.id, warehouse.name] as const)
              ).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo de movimiento
            <select {...form.register('kind')}>
              <option value="ENTRY">Entrada</option>
              <option value="EXIT">Salida</option>
              <option value="RETURN">Devolución</option>
            </select>
          </label>
          <label>
            Cantidad
            <input {...form.register('quantity')} min="1" type="number" />
            {form.formState.errors.quantity ? (
              <span className="field-error">{form.formState.errors.quantity.message}</span>
            ) : null}
          </label>
        </form>
      </Dialog>
    </div>
  );
}
