'use client';

import type {
  CatalogItem,
  InventoryMovement,
  InventoryTraceRecord,
  Warehouse,
  WarehouseTransfer,
} from '@analiza/contracts';
import { currentInventoryBalance } from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useMemo, useState } from 'react';
import { expiredTraceQuantity } from '@/lib/inventory-traceability';

type Execute = (command: unknown) => Promise<boolean>;

export function WarehouseManagement({
  warehouses,
  query,
  setQuery,
  canWrite,
  connected,
  busy,
  error,
  execute,
}: {
  warehouses: Warehouse[];
  query: string;
  setQuery: (value: string) => void;
  canWrite: boolean;
  connected: boolean;
  busy: boolean;
  error: string | null;
  execute: Execute;
}) {
  const [status, setStatus] = useState<'ALL' | Warehouse['status']>('ALL');
  const [editing, setEditing] = useState<Warehouse | 'NEW' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const rows = warehouses.filter(
    (warehouse) =>
      (status === 'ALL' || warehouse.status === status) &&
      `${warehouse.code} ${warehouse.name} ${warehouse.description ?? ''}`
        .toLocaleLowerCase('es')
        .includes(query.toLocaleLowerCase('es')),
  );
  const selected = editing === 'NEW' ? null : editing;

  async function save(formData: FormData) {
    const name = String(formData.get('name') ?? '').trim();
    const code = String(formData.get('code') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const nextStatus = String(formData.get('status') ?? 'ACTIVE');
    if (!name || code.length < 2) {
      setFormError('Indique un nombre y un código de al menos dos caracteres.');
      return;
    }
    const ok = await execute({
      command: 'warehouse.save',
      warehouse: {
        id: selected?.id ?? crypto.randomUUID(),
        name,
        code,
        description: description || undefined,
        status: selected ? nextStatus : 'ACTIVE',
      },
    });
    if (ok) {
      setEditing(null);
      setFormError(null);
    }
  }

  return (
    <>
      <Panel>
        <div className="table-heading">
          <div>
            <h2>Bodegas</h2>
            <p className="field-help" id="inventory-warehouses-active-help">
              Cada código es único. Una bodega sólo puede desactivarse cuando su existencia total es
              cero; el historial permanece auditable.
            </p>
          </div>
          {canWrite ? (
            <Button
              data-action-id="INVENTORY-WAREHOUSE-CREATE"
              disabled={!connected || busy}
              onClick={() => {
                setFormError(null);
                setEditing('NEW');
              }}
              type="button"
            >
              Nueva bodega
            </Button>
          ) : null}
        </div>
        {!connected ? (
          <p className="notice warning">Conecte el servidor para administrar bodegas.</p>
        ) : null}
        {error ? (
          <p className="notice warning" role="alert">
            {error}
          </p>
        ) : null}
        <div className="filter-grid">
          <label>
            Estado
            <select
              aria-describedby="inventory-warehouses-active-help"
              aria-label="Estado de bodegas"
              data-action-id="INVENTORY-WAREHOUSES-ACTIVE-FILTER"
              onChange={(event) => setStatus(event.target.value as typeof status)}
              value={status}
            >
              <option value="ALL">Todas</option>
              <option value="ACTIVE">Activas</option>
              <option value="INACTIVE">Inactivas</option>
            </select>
          </label>
          <label>
            Buscar bodegas
            <input
              data-action-id="INVENTORY-WAREHOUSES-SEARCH"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar código, nombre o descripción"
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
                <th>Código</th>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Actualización</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((warehouse) => (
                <tr key={warehouse.id}>
                  <td>
                    {canWrite ? (
                      <Button
                        className="button-secondary"
                        data-action-id="INVENTORY-WAREHOUSE-EDIT"
                        disabled={!connected || busy}
                        onClick={() => {
                          setFormError(null);
                          setEditing(warehouse);
                        }}
                        type="button"
                      >
                        Editar
                      </Button>
                    ) : (
                      'Solo lectura'
                    )}
                  </td>
                  <td>
                    <code>{warehouse.code}</code>
                  </td>
                  <td>{warehouse.name}</td>
                  <td>{warehouse.description || 'Sin descripción'}</td>
                  <td>
                    <StatusTag tone={warehouse.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {warehouse.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                    </StatusTag>
                  </td>
                  <td>{new Date(warehouse.updatedAt).toLocaleDateString('es-SV')}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      detail={
                        query || status !== 'ALL'
                          ? query
                            ? `No hay bodegas que coincidan con “${query}”.`
                            : 'Cambie el filtro de estado para ver otras bodegas.'
                          : 'Cree la primera bodega para registrar existencias y traslados.'
                      }
                      title="Sin bodegas"
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
      <Dialog
        description="El código identifica la bodega dentro de la organización. Desactivarla no elimina su historial."
        footer={
          <>
            <Button className="button-secondary" onClick={() => setEditing(null)} type="button">
              Cancelar
            </Button>
            <Button disabled={busy} form="warehouse-form" type="submit">
              Guardar bodega
            </Button>
          </>
        }
        onClose={() => setEditing(null)}
        open={editing !== null}
        title={selected ? 'Editar bodega' : 'Nueva bodega'}
      >
        <form action={save} className="form-grid" id="warehouse-form">
          <label>
            Código
            <input defaultValue={selected?.code ?? ''} maxLength={40} name="code" required />
          </label>
          <label>
            Nombre
            <input defaultValue={selected?.name ?? ''} maxLength={120} name="name" required />
          </label>
          <label className="full-field">
            Descripción
            <textarea
              defaultValue={selected?.description ?? ''}
              maxLength={500}
              name="description"
            />
          </label>
          {selected ? (
            <label>
              Estado
              <select defaultValue={selected.status} name="status">
                <option value="ACTIVE">Activa</option>
                <option value="INACTIVE">Inactiva</option>
              </select>
            </label>
          ) : null}
          {formError ? <p className="field-error full-field">{formError}</p> : null}
        </form>
      </Dialog>
    </>
  );
}

export function InventoryTransferDialog({
  open,
  onClose,
  warehouses,
  items,
  movements,
  traceRecords,
  busy,
  error,
  execute,
  refreshWorkspace,
}: {
  open: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  items: CatalogItem[];
  movements: InventoryMovement[];
  traceRecords: InventoryTraceRecord[];
  busy: boolean;
  error: string | null;
  execute: Execute;
  refreshWorkspace: () => Promise<boolean>;
}) {
  const activeWarehouses = warehouses.filter((warehouse) => warehouse.status === 'ACTIVE');
  const inventoryItems = items.filter(
    (item) =>
      item.status === 'ACTIVE' &&
      ['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT'].includes(item.category ?? ''),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [itemId, setItemId] = useState('');
  const available = useMemo(
    () =>
      itemId && sourceWarehouseId
        ? currentInventoryBalance(movements, itemId, sourceWarehouseId) -
          expiredTraceQuantity(traceRecords, itemId, sourceWarehouseId)
        : 0,
    [itemId, movements, sourceWarehouseId, traceRecords],
  );

  async function transfer(formData: FormData) {
    const source = String(formData.get('sourceWarehouseId') ?? '');
    const destination = String(formData.get('destinationWarehouseId') ?? '');
    const selectedItem = String(formData.get('itemId') ?? '');
    const quantity = Number(formData.get('quantity'));
    const reason = String(formData.get('reason') ?? '').trim();
    const reference = String(formData.get('reference') ?? '').trim();
    if (!selectedItem || !source || !destination || source === destination || !reason) {
      setFormError('Seleccione un ítem, dos bodegas distintas e indique el motivo.');
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > available) {
      setFormError(
        `La cantidad debe ser entera y no superar la existencia disponible (${available}).`,
      );
      return;
    }
    const id = crypto.randomUUID();
    const payload: WarehouseTransfer = {
      id,
      idempotencyKey: id,
      itemId: selectedItem,
      sourceWarehouseId: source,
      destinationWarehouseId: destination,
      quantity,
      reason,
      reference: reference || undefined,
      occurredAt: new Date().toISOString(),
    };
    if (await execute({ command: 'inventory.transfer', transfer: payload })) {
      await refreshWorkspace();
      setFormError(null);
      setSourceWarehouseId('');
      setItemId('');
      onClose();
    }
  }

  return (
    <Dialog
      description="El traslado registra una salida y una entrada atómicas; nunca cambia el total global."
      footer={
        <>
          <Button className="button-secondary" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button disabled={busy} form="inventory-transfer-form" type="submit">
            Confirmar traslado
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Trasladar existencias"
    >
      <form action={transfer} className="form-grid" id="inventory-transfer-form">
        <label className="full-field">
          Ítem
          <select
            name="itemId"
            onChange={(event) => setItemId(event.target.value)}
            required
            value={itemId}
          >
            <option value="">Seleccione…</option>
            {inventoryItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sku} · {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bodega de origen
          <select
            name="sourceWarehouseId"
            onChange={(event) => setSourceWarehouseId(event.target.value)}
            required
            value={sourceWarehouseId}
          >
            <option value="">Seleccione…</option>
            {activeWarehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <span className="field-help">Disponible: {available}</span>
        </label>
        <label>
          Bodega de destino
          <select name="destinationWarehouseId" required>
            <option value="">Seleccione…</option>
            {activeWarehouses
              .filter((warehouse) => warehouse.id !== sourceWarehouseId)
              .map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Cantidad
          <input max={Math.max(available, 1)} min="1" name="quantity" required type="number" />
        </label>
        <label>
          Referencia (opcional)
          <input maxLength={200} name="reference" />
        </label>
        <label className="full-field">
          Motivo
          <input maxLength={500} name="reason" required />
        </label>
        {formError ? <p className="field-error full-field">{formError}</p> : null}
        {!formError && error ? <p className="field-error full-field">{error}</p> : null}
      </form>
    </Dialog>
  );
}
