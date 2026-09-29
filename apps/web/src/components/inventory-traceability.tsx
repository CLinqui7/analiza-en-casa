'use client';

import type { CatalogItem, InventoryTraceRecord, Warehouse } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useMemo, useState } from 'react';
import {
  inventoryTraceEffectiveStatus,
  inventoryTraceQuantity,
  type InventoryTraceEffectiveStatus as EffectiveStatus,
} from '@/lib/inventory-traceability';

type Execute = (command: unknown) => Promise<boolean>;

const statusLabels: Record<EffectiveStatus, string> = {
  QUARANTINED: 'En cuarentena',
  AVAILABLE: 'Liberado',
  BLOCKED: 'Bloqueado',
  REJECTED: 'Rechazado',
  EXPIRED: 'Vencido',
  DEPLETED: 'Agotado',
};

export function InventoryTraceability({
  records,
  items,
  warehouses,
  canWrite,
  connected,
  busy,
  error,
  execute,
  refreshWorkspace,
}: {
  records: InventoryTraceRecord[];
  items: CatalogItem[];
  warehouses: Warehouse[];
  canWrite: boolean;
  connected: boolean;
  busy: boolean;
  error: string | null;
  execute: Execute;
  refreshWorkspace: () => Promise<boolean>;
}) {
  const [kind, setKind] = useState<'LOT' | 'SERIAL'>('LOT');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | EffectiveStatus>('ALL');
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [selected, setSelected] = useState<InventoryTraceRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const activeWarehouses = warehouses.filter((warehouse) => warehouse.status === 'ACTIVE');
  const providers = items.filter(
    (item) => item.status === 'ACTIVE' && item.category === 'PROVIDERS',
  );
  const traceItems = items.filter(
    (item) =>
      item.status === 'ACTIVE' &&
      (kind === 'SERIAL'
        ? item.category === 'EQUIPMENT'
        : ['MEDICATIONS', 'SUPPLIES'].includes(item.category ?? '')),
  );
  const itemNames = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, `${item.sku} · ${item.name}`])),
    [items],
  );
  const providerNames = useMemo(
    () => Object.fromEntries(providers.map((item) => [item.id, item.name])),
    [providers],
  );
  const warehouseNames = useMemo(
    () => Object.fromEntries(warehouses.map((warehouse) => [warehouse.id, warehouse.name])),
    [warehouses],
  );
  const rows = records.filter((record) => {
    const effective = inventoryTraceEffectiveStatus(record);
    return (
      record.kind === kind &&
      (status === 'ALL' || status === effective) &&
      `${record.number} ${itemNames[record.itemId] ?? record.itemId} ${providerNames[record.supplierCatalogItemId] ?? ''} ${record.receiptReference}`
        .toLocaleLowerCase('es')
        .includes(query.toLocaleLowerCase('es'))
    );
  });
  const issueItems = items.filter(
    (item) =>
      item.status === 'ACTIVE' &&
      records.some(
        (record) =>
          record.itemId === item.id &&
          inventoryTraceEffectiveStatus(record) === 'AVAILABLE' &&
          inventoryTraceQuantity(record) > 0,
      ),
  );

  async function receive(formData: FormData) {
    const itemId = String(formData.get('itemId') ?? '');
    const warehouseId = String(formData.get('warehouseId') ?? '');
    const supplierCatalogItemId = String(formData.get('supplierCatalogItemId') ?? '');
    const number = String(formData.get('number') ?? '').trim();
    const quantity = kind === 'SERIAL' ? 1 : Number(formData.get('quantity'));
    const manufacturedOn = String(formData.get('manufacturedOn') ?? '');
    const expiresOn = String(formData.get('expiresOn') ?? '');
    const receiptReference = String(formData.get('receiptReference') ?? '').trim();
    const reason = String(formData.get('reason') ?? '').trim();
    if (
      !itemId ||
      !warehouseId ||
      !supplierCatalogItemId ||
      !number ||
      !receiptReference ||
      !reason ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      (kind === 'LOT' && !expiresOn)
    ) {
      setFormError('Complete los datos obligatorios de la recepción.');
      return;
    }
    if (manufacturedOn && expiresOn && manufacturedOn > expiresOn) {
      setFormError('El vencimiento debe ser posterior a la fabricación.');
      return;
    }
    const id = crypto.randomUUID();
    const ok = await execute({
      command: 'inventory.trace.receive',
      receipt: {
        id,
        idempotencyKey: id,
        kind,
        itemId,
        warehouseId,
        supplierCatalogItemId,
        number,
        quantity,
        manufacturedOn: manufacturedOn || undefined,
        expiresOn: kind === 'LOT' ? expiresOn : undefined,
        receiptReference,
        reason,
        receivedAt: new Date().toISOString(),
      },
    });
    if (ok) {
      setReceiptOpen(false);
      setFormError(null);
    }
  }

  async function changeStatus(formData: FormData) {
    if (!selected) return;
    const nextStatus = String(formData.get('status')) as 'AVAILABLE' | 'BLOCKED' | 'REJECTED';
    const reason = String(formData.get('reason') ?? '').trim();
    if (!reason) {
      setFormError('Indique el motivo del cambio de estado.');
      return;
    }
    const id = crypto.randomUUID();
    const ok = await execute({
      command: 'inventory.trace.status',
      change: {
        id,
        recordId: selected.id,
        status: nextStatus,
        reason,
        occurredAt: new Date().toISOString(),
        idempotencyKey: id,
      },
    });
    if (ok) {
      await refreshWorkspace();
      setSelected(null);
      setFormError(null);
    }
  }

  async function issue(formData: FormData) {
    const itemId = String(formData.get('itemId') ?? '');
    const warehouseId = String(formData.get('warehouseId') ?? '');
    const quantity = Number(formData.get('quantity'));
    const reference = String(formData.get('reference') ?? '').trim();
    const reason = String(formData.get('reason') ?? '').trim();
    if (
      !itemId ||
      !warehouseId ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !reference ||
      !reason
    ) {
      setFormError('Seleccione artículo y bodega, e indique cantidad, referencia y motivo.');
      return;
    }
    const id = crypto.randomUUID();
    const ok = await execute({
      command: 'inventory.trace.issue',
      issue: {
        id,
        idempotencyKey: id,
        itemId,
        warehouseId,
        quantity,
        reference,
        reason,
        occurredAt: new Date().toISOString(),
      },
    });
    if (ok) {
      await refreshWorkspace();
      setIssueOpen(false);
      setFormError(null);
    }
  }

  const selectedExpired = Boolean(
    selected?.expiresOn && selected.expiresOn < new Date().toISOString().slice(0, 10),
  );
  const allowedStatuses = selected
    ? selected.qualityStatus === 'QUARANTINED'
      ? selectedExpired
        ? (['BLOCKED', 'REJECTED'] as const)
        : (['AVAILABLE', 'BLOCKED', 'REJECTED'] as const)
      : selected.qualityStatus === 'AVAILABLE'
        ? (['BLOCKED', 'REJECTED'] as const)
        : selected.qualityStatus === 'BLOCKED'
          ? selectedExpired
            ? (['REJECTED'] as const)
            : (['AVAILABLE', 'REJECTED'] as const)
          : []
    : [];

  return (
    <>
      <Panel>
        <div className="table-heading">
          <div>
            <h2>Lotes y números de serie</h2>
            <p className="field-help" id="inventory-trace-help">
              Toda recepción inicia en cuarentena. Sólo lo liberado y vigente entra al disponible;
              las salidas y traslados seleccionan FEFO para lotes y FIFO para series.
            </p>
          </div>
          {canWrite ? (
            <div className="action-row">
              <Button
                className="button-secondary"
                data-action-id="INVENTORY-TRACE-ISSUE"
                disabled={!connected || busy || !issueItems.length}
                onClick={() => {
                  setFormError(null);
                  setIssueOpen(true);
                }}
                type="button"
              >
                Registrar salida
              </Button>
              <Button
                data-action-id="INVENTORY-TRACE-RECEIVE"
                disabled={!connected || busy || !activeWarehouses.length}
                onClick={() => {
                  setFormError(null);
                  setReceiptOpen(true);
                }}
                type="button"
              >
                Nueva recepción
              </Button>
            </div>
          ) : null}
        </div>
        {!connected ? (
          <p className="notice warning">Conecte el servidor para administrar trazabilidad.</p>
        ) : null}
        {error ? (
          <p className="notice warning" role="alert">
            {error}
          </p>
        ) : null}
        <div aria-label="Tipo de trazabilidad" className="tabs" role="tablist">
          <Button
            aria-selected={kind === 'LOT'}
            className={kind === 'LOT' ? 'tab active' : 'tab'}
            data-action-id="INVENTORY-LOTS-TAB"
            onClick={() => setKind('LOT')}
            role="tab"
            type="button"
          >
            Lotes
          </Button>
          <Button
            aria-selected={kind === 'SERIAL'}
            className={kind === 'SERIAL' ? 'tab active' : 'tab'}
            data-action-id="INVENTORY-SERIALS-TAB"
            onClick={() => setKind('SERIAL')}
            role="tab"
            type="button"
          >
            Nros de serie
          </Button>
        </div>
        <div className="filter-grid">
          <label>
            Estado
            <select
              onChange={(event) => setStatus(event.target.value as typeof status)}
              value={status}
            >
              <option value="ALL">Todos</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Buscar
            <input
              data-action-id="INVENTORY-TRACE-SEARCH"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Número, artículo, proveedor o recepción"
              type="search"
              value={query}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Acciones</th>
                <th>Número</th>
                <th>Artículo</th>
                <th>Proveedor / recepción</th>
                <th>Existencias por bodega</th>
                <th>Fabricación</th>
                <th>Vencimiento</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((record) => {
                const effective = inventoryTraceEffectiveStatus(record);
                return (
                  <tr key={record.id}>
                    <td>
                      {canWrite && allowedActions(record).length ? (
                        <Button
                          className="button-secondary"
                          data-action-id="INVENTORY-TRACE-STATUS"
                          disabled={!connected || busy}
                          onClick={() => {
                            setFormError(null);
                            setSelected(record);
                          }}
                          type="button"
                        >
                          Cambiar estado
                        </Button>
                      ) : (
                        'Solo lectura'
                      )}
                    </td>
                    <td>
                      <code>{record.number}</code>
                    </td>
                    <td>{itemNames[record.itemId] ?? record.itemId}</td>
                    <td>
                      {providerNames[record.supplierCatalogItemId] ?? record.supplierCatalogItemId}
                      <br />
                      <small>{record.receiptReference}</small>
                    </td>
                    <td>
                      {record.balances
                        .filter((balance) => balance.quantity > 0)
                        .map((balance) => (
                          <div key={balance.warehouseId}>
                            {warehouseNames[balance.warehouseId] ?? balance.warehouseId}:{' '}
                            {balance.quantity}
                          </div>
                        ))}
                      {inventoryTraceQuantity(record) === 0 ? '0' : null}
                    </td>
                    <td>{record.manufacturedOn ?? 'No indicada'}</td>
                    <td>{record.expiresOn ?? 'No aplica'}</td>
                    <td>
                      <StatusTag
                        tone={
                          effective === 'AVAILABLE'
                            ? 'success'
                            : effective === 'REJECTED' || effective === 'EXPIRED'
                              ? 'danger'
                              : effective === 'QUARANTINED' || effective === 'BLOCKED'
                                ? 'warning'
                                : 'neutral'
                        }
                      >
                        {statusLabels[effective]}
                      </StatusTag>
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      detail={
                        query || status !== 'ALL'
                          ? 'Cambie los filtros para ver otros registros.'
                          : 'Registre una recepción para iniciar la trazabilidad.'
                      }
                      title={kind === 'LOT' ? 'Sin lotes' : 'Sin números de serie'}
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Dialog
        description="La recepción queda en cuarentena y todavía no aumenta el inventario disponible."
        footer={
          <>
            <Button
              className="button-secondary"
              onClick={() => setReceiptOpen(false)}
              type="button"
            >
              Cancelar
            </Button>
            <Button disabled={busy} form="trace-receipt-form" type="submit">
              Registrar recepción
            </Button>
          </>
        }
        onClose={() => setReceiptOpen(false)}
        open={receiptOpen}
        title={kind === 'LOT' ? 'Recibir lote' : 'Recibir equipo serializado'}
      >
        <form action={receive} className="form-grid" id="trace-receipt-form">
          <label className="full-field">
            Artículo
            <select name="itemId" required defaultValue="">
              <option value="" disabled>
                Seleccione
              </option>
              {traceItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} · {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bodega
            <select name="warehouseId" required defaultValue="">
              <option value="" disabled>
                Seleccione
              </option>
              {activeWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} · {warehouse.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Proveedor
            <select name="supplierCatalogItemId" required defaultValue="">
              <option value="" disabled>
                Seleccione
              </option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {kind === 'LOT' ? 'Número de lote' : 'Número de serie'}
            <input maxLength={120} name="number" required />
          </label>
          {kind === 'LOT' ? (
            <label>
              Cantidad
              <input min="1" max="1000000" name="quantity" required type="number" />
            </label>
          ) : (
            <label>
              Cantidad
              <input name="quantity" readOnly type="number" value="1" />
            </label>
          )}
          <label>
            Fecha de fabricación
            <input name="manufacturedOn" type="date" />
          </label>
          {kind === 'LOT' ? (
            <label>
              Fecha de vencimiento
              <input name="expiresOn" required type="date" />
            </label>
          ) : null}
          <label>
            Referencia de recepción
            <input maxLength={200} name="receiptReference" required />
          </label>
          <label className="full-field">
            Motivo / observación
            <textarea maxLength={500} name="reason" required />
          </label>
          {formError ? <p className="field-error full-field">{formError}</p> : null}
        </form>
      </Dialog>

      <Dialog
        description={
          selected
            ? `${selected.kind === 'LOT' ? 'Lote' : 'Serie'} ${selected.number}. Los cambios quedan auditados y no reescriben la recepción.`
            : ''
        }
        footer={
          <>
            <Button className="button-secondary" onClick={() => setSelected(null)} type="button">
              Cancelar
            </Button>
            <Button
              disabled={busy || !allowedStatuses.length}
              form="trace-status-form"
              type="submit"
            >
              Confirmar estado
            </Button>
          </>
        }
        onClose={() => setSelected(null)}
        open={Boolean(selected)}
        title="Cambiar estado de calidad"
      >
        <form action={changeStatus} className="form-grid" id="trace-status-form">
          <label>
            Nuevo estado
            <select name="status" required>
              {allowedStatuses.map((value) => (
                <option key={value} value={value}>
                  {statusLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="full-field">
            Motivo
            <textarea maxLength={500} name="reason" required />
          </label>
          {selected?.expiresOn && selected.expiresOn < new Date().toISOString().slice(0, 10) ? (
            <p className="notice warning full-field">
              El lote está vencido: no puede liberarse, pero sí bloquearse o rechazarse.
            </p>
          ) : null}
          {formError ? <p className="field-error full-field">{formError}</p> : null}
        </form>
      </Dialog>

      <Dialog
        description="El servidor asigna automáticamente los lotes con vencimiento más próximo; para series usa la recepción más antigua."
        footer={
          <>
            <Button className="button-secondary" onClick={() => setIssueOpen(false)} type="button">
              Cancelar
            </Button>
            <Button disabled={busy} form="trace-issue-form" type="submit">
              Confirmar salida
            </Button>
          </>
        }
        onClose={() => setIssueOpen(false)}
        open={issueOpen}
        title="Registrar salida FEFO / FIFO"
      >
        <form action={issue} className="form-grid" id="trace-issue-form">
          <label className="full-field">
            Artículo
            <select name="itemId" required defaultValue="">
              <option value="" disabled>
                Seleccione
              </option>
              {issueItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} · {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bodega
            <select name="warehouseId" required defaultValue="">
              <option value="" disabled>
                Seleccione
              </option>
              {activeWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} · {warehouse.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cantidad
            <input min="1" max="1000000" name="quantity" required type="number" />
          </label>
          <label>
            Referencia
            <input maxLength={200} name="reference" required />
          </label>
          <label className="full-field">
            Motivo
            <textarea maxLength={500} name="reason" required />
          </label>
          {formError ? <p className="field-error full-field">{formError}</p> : null}
        </form>
      </Dialog>
    </>
  );
}

function allowedActions(record: InventoryTraceRecord) {
  if (record.qualityStatus === 'REJECTED' || inventoryTraceQuantity(record) === 0) return [];
  if (record.qualityStatus === 'QUARANTINED') return ['AVAILABLE', 'BLOCKED', 'REJECTED'];
  if (record.qualityStatus === 'AVAILABLE') return ['BLOCKED', 'REJECTED'];
  return ['AVAILABLE', 'REJECTED'];
}
