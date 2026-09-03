'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type InventoryMovement } from '@analiza/contracts';
import { canRecordMovement, deriveKardex } from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';

const itemCatalog: Record<string, { name: string; sku: string }> = {
  'inventory-demo-kit': { name: 'Kit operativo demo', sku: 'KIT-DEMO-001' },
  'inventory-demo-supplies': { name: 'Insumos demo', sku: 'INS-DEMO-001' },
};
const warehouses: Record<string, string> = {
  'warehouse-demo-central': 'Bodega central demo',
  'warehouse-demo-north': 'Bodega norte demo',
};
const movementFormSchema = z.object({
  itemId: z.string().min(1, 'Seleccione un ítem.'),
  warehouseId: z.string().min(1, 'Seleccione una bodega.'),
  kind: z.enum(['ENTRY', 'EXIT', 'TRANSFER', 'RETURN', 'ADJUSTMENT']),
  adjustmentDirection: z.enum(['IN', 'OUT']).optional(),
  quantity: z.coerce.number().int().positive('La cantidad debe ser un entero positivo.'),
  reference: z.string().trim(),
  reason: z.string().trim().min(1, 'Indique el motivo del movimiento.'),
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
  if (movement.kind === 'EXIT' || movement.kind === 'TRANSFER') return 'out';
  return movement.adjustmentDirection === 'OUT' ? 'out' : 'in';
}

export default function KardexPage() {
  const { addInventoryMovement, inventoryMovements } = useWorkspace();
  const { can, session } = useAuth();
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
  const itemIds = useMemo(
    () => [
      ...new Set([
        ...Object.keys(itemCatalog),
        ...inventoryMovements.map((movement) => movement.itemId),
      ]),
    ],
    [inventoryMovements],
  );
  const allRows = useMemo(
    () =>
      itemIds
        .flatMap((itemId) => deriveKardex(inventoryMovements, itemId))
        .sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
        ),
    [inventoryMovements, itemIds],
  );
  const rows = allRows.filter((row) => {
    const date = row.createdAt.slice(0, 10);
    return (
      (!filters.itemId || row.itemId === filters.itemId) &&
      (!filters.from || date >= filters.from) &&
      (!filters.to || date <= filters.to) &&
      (!filters.warehouseId || row.warehouseId === filters.warehouseId) &&
      (!filters.kind || row.kind === filters.kind) &&
      (!filters.reference ||
        `${row.reference ?? ''} ${row.reason}`
          .toLocaleLowerCase('es')
          .includes(filters.reference.toLocaleLowerCase('es')))
    );
  });
  const form = useForm<MovementFormInput, unknown, MovementForm>({
    resolver: zodResolver(movementFormSchema),
    defaultValues: {
      itemId: itemIds[0] ?? '',
      warehouseId: Object.keys(warehouses)[0],
      kind: 'ENTRY',
      quantity: 1,
      reference: '',
      reason: '',
    },
  });
  const kind = useWatch({ control: form.control, name: 'kind' });

  function closeDialog() {
    setOpen(false);
    form.reset();
  }
  function updateFilter(name: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
  }
  function resetFilters() {
    setFilters({ itemId: '', from: '', to: '', warehouseId: '', kind: '', reference: '' });
  }
  function submit(values: MovementForm) {
    const movement: InventoryMovement = {
      id: crypto.randomUUID(),
      itemId: values.itemId,
      warehouseId: values.warehouseId,
      kind: values.kind,
      adjustmentDirection:
        values.kind === 'ADJUSTMENT' ? (values.adjustmentDirection ?? 'IN') : undefined,
      quantity: values.quantity,
      reference: values.reference || undefined,
      reason: values.reason,
      user: session?.role ?? 'Sistema demo',
      createdAt: new Date().toISOString(),
    };
    if (!canRecordMovement(inventoryMovements, movement)) {
      form.setError('quantity', {
        type: 'validate',
        message:
          'El movimiento dejaría un saldo negativo; corrija la cantidad o registre una entrada auditada.',
      });
      return;
    }
    addInventoryMovement(movement);
    setResult('Movimiento persistido. El saldo se recalculó desde el historial cronológico.');
    closeDialog();
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Inventario</p>
          <h1>Kárdex</h1>
          <p>Historial cronológico reproducible por ítem; no permite edición directa del saldo.</p>
        </div>
        {can('inventory:write') ? (
          <Button
            data-action-id="INVENTORY-MOVEMENT-CREATE"
            onClick={() => {
              setResult(null);
              setOpen(true);
            }}
            type="button"
          >
            Registrar movimiento
          </Button>
        ) : null}
      </header>
      {result ? (
        <p className="notice success" role="status">
          {result}
        </p>
      ) : null}
      <Panel>
        <div className="filter-grid">
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
            Referencia
            <input
              data-action-id="KARDEX-FILTER-REFERENCE"
              onChange={(event) => updateFilter('reference', event.target.value)}
              value={filters.reference}
            />
          </label>
        </div>
        <Button
          className="button-secondary"
          data-action-id="KARDEX-FILTER-RESET"
          onClick={resetFilters}
          type="button"
        >
          Limpiar filtros
        </Button>
      </Panel>
      <Panel>
        <div className="table-heading">
          <h2>Movimientos</h2>
          <StatusTag>{rows.length} visibles</StatusTag>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha / hora</th>
                  <th>Ítem</th>
                  <th>SKU</th>
                  <th>Bodega</th>
                  <th>Referencia</th>
                  <th>Tipo</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Saldo</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.createdAt).toLocaleString('es-SV')}</td>
                    <td>{itemCatalog[row.itemId]?.name ?? row.itemId}</td>
                    <td>{itemCatalog[row.itemId]?.sku ?? 'Sin SKU'}</td>
                    <td>{warehouses[row.warehouseId ?? ''] ?? row.warehouseId ?? 'Sin bodega'}</td>
                    <td>{row.reference ?? row.reason}</td>
                    <td>
                      {kindLabel[row.kind]}
                      {row.kind === 'ADJUSTMENT'
                        ? ` ${row.adjustmentDirection === 'OUT' ? '−' : '+'}`
                        : ''}
                    </td>
                    <td>{direction(row) === 'in' ? row.quantity : '—'}</td>
                    <td>{direction(row) === 'out' ? row.quantity : '—'}</td>
                    <td>{row.balance}</td>
                    <td>{row.user ?? 'Sistema'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            detail="Ajuste los filtros o registre un movimiento."
            title="Sin movimientos"
          />
        )}
      </Panel>
      <Dialog
        description="Cada registro queda en el historial y el saldo se deriva cronológicamente."
        footer={
          <>
            <Button className="button-secondary" onClick={closeDialog} type="button">
              Cancelar
            </Button>
            <Button form="movement-form" type="submit">
              Guardar movimiento
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isOpen}
        title="Registrar movimiento de inventario"
      >
        <form
          className="form-grid"
          id="movement-form"
          noValidate
          onSubmit={form.handleSubmit(submit)}
        >
          <label>
            Ítem
            <select {...form.register('itemId')}>
              {itemIds.map((id) => (
                <option key={id} value={id}>
                  {itemCatalog[id]?.name ?? id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bodega
            <select {...form.register('warehouseId')}>
              {Object.entries(warehouses).map(([id, name]) => (
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
              <option value="TRANSFER">Transferencia</option>
              <option value="RETURN">Devolución</option>
              <option value="ADJUSTMENT">Ajuste</option>
            </select>
          </label>
          {kind === 'ADJUSTMENT' ? (
            <label>
              Dirección del ajuste
              <select {...form.register('adjustmentDirection')}>
                <option value="IN">Ajuste +</option>
                <option value="OUT">Ajuste −</option>
              </select>
            </label>
          ) : null}
          <label>
            Cantidad
            <input {...form.register('quantity')} min="1" type="number" />
            {form.formState.errors.quantity ? (
              <span className="field-error">{form.formState.errors.quantity.message}</span>
            ) : null}
          </label>
          <label>
            Referencia
            <input {...form.register('reference')} />
          </label>
          <label>
            Motivo
            <input {...form.register('reason')} />
            {form.formState.errors.reason ? (
              <span className="field-error">{form.formState.errors.reason.message}</span>
            ) : null}
          </label>
        </form>
      </Dialog>
    </div>
  );
}
