'use client';

import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import type { HomeCustody } from '@analiza/contracts';
import { useAuth, useWorkspace } from '@/components/providers';
import { useOperations } from '@/lib/use-operations';
import { custodyReturns, stockByWarehouse } from '@/lib/inventory-ledger';
import '../stock.css';

const dateFormatter = new Intl.DateTimeFormat('es-SV', { dateStyle: 'short', timeStyle: 'short' });
const formatDate = (value: string) => dateFormatter.format(new Date(value));
type LocationForm = { custody?: HomeCustody; key: string; date: string };

export default function EquipmentLocationsPage() {
  const operations = useOperations();
  const { catalogItems, inventoryMovements, patients, refreshWorkspace } = useWorkspace();
  const { can } = useAuth();
  const [form, setForm] = useState<LocationForm | null>(null);
  const [itemId, setItemId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState('');
  const names = useMemo(
    () => new Map([...patients, ...operations.deliveryPatients].map((p) => [p.id, p.fullName])),
    [patients, operations.deliveryPatients],
  );
  const equipment = useMemo(
    () => new Map(catalogItems.filter((i) => i.category === 'EQUIPMENT').map((i) => [i.id, i])),
    [catalogItems],
  );
  const warehouses = useMemo(
    () => new Map(operations.warehouses.map((w) => [w.id, w])),
    [operations.warehouses],
  );
  const stock = useMemo(
    () => stockByWarehouse(inventoryMovements, operations.traceRecords, operations.homeCustodies),
    [inventoryMovements, operations.traceRecords, operations.homeCustodies],
  );
  const available = stock.filter(
    (p) =>
      p.available > 0 &&
      equipment.get(p.itemId)?.status === 'ACTIVE' &&
      warehouses.get(p.warehouseId)?.status === 'ACTIVE',
  );
  const availableIds = new Set(available.map((p) => p.itemId));
  const limit = form?.custody
    ? form.custody.quantity - form.custody.returnedQuantity
    : (available.find((p) => p.itemId === itemId && p.warehouseId === warehouseId)?.available ?? 0);
  const custodies = useMemo(
    () => operations.homeCustodies.filter((c) => equipment.has(c.itemId)),
    [operations.homeCustodies, equipment],
  );
  const events = useMemo(
    () =>
      custodies
        .flatMap((c) => [
          { key: `loan:${c.id}`, date: c.sentAt, custody: c, type: 'loan', quantity: c.quantity },
          ...custodyReturns(c).map((r) => ({
            key: `return:${c.id}:${r.id}`,
            date: r.receivedAt,
            custody: c,
            type: 'return',
            quantity: r.quantity,
          })),
        ])
        .sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key)),
    [custodies],
  );
  const rows = events.filter(
    (row) =>
      (!type || row.type === type) &&
      [
        names.get(row.custody.patientId),
        equipment.get(row.custody.itemId)?.name,
        warehouses.get(row.custody.warehouseId)?.name,
      ]
        .join(' ')
        .toLocaleLowerCase('es')
        .includes(search.trim().toLocaleLowerCase('es')),
  );
  const lastPage = Math.max(0, Math.ceil(rows.length / 50) - 1);
  const currentPage = Math.min(page, lastPage);
  const held = custodies
    .filter((c) => c.status === 'OPEN')
    .reduce((sum, c) => sum + c.quantity - c.returnedQuantity, 0);
  const canWrite = can('inventory:write');
  function start(custody?: HomeCustody) {
    setItemId('');
    setWarehouseId('');
    setMessage('');
    setForm({
      custody,
      key: crypto.randomUUID(),
      date: new Date().toISOString(),
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || operations.busy) return;
    const data = new FormData(event.currentTarget);
    const quantity = Number(data.get('quantity'));
    const saved = form.custody
      ? await operations.execute({
          command: 'home.equipment.return',
          receipt: { id: form.key, custodyId: form.custody.id, quantity, receivedAt: form.date },
        })
      : await operations.execute({
          command: 'home.equipment.loan',
          dispatch: {
            id: form.key,
            idempotencyKey: form.key,
            patientId: String(data.get('patientId')),
            itemId,
            warehouseId,
            quantity,
            sentAt: form.date,
            reference: form.key,
          },
        });
    if (saved) {
      setMessage(
        form.custody
          ? 'Devolución registrada. El equipo recibido queda en cuarentena.'
          : 'Préstamo registrado. El equipo ya figura a cargo del paciente.',
      );
      setForm(null);
      await refreshWorkspace();
    }
  }
  return (
    <div className="page-stack inventory-ledger-page equipment-locations">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Inventario y compras</p>
          <h1>Ubicación de equipo e instrumentos por paciente</h1>
          <p>Registre un préstamo y confirme las unidades que devuelve el paciente.</p>
        </div>
        {canWrite && (
          <Button
            data-action-id="HOME-DISPATCH-CREATE"
            disabled={!operations.connected || operations.busy}
            onClick={() => start()}
          >
            Registrar nueva ubicación
          </Button>
        )}
      </header>
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      {!form && operations.error && (
        <p className="notice warning" role="alert">
          {operations.error}
        </p>
      )}
      <Panel className="inventory-ledger-table-panel">
        <div className="table-heading">
          <h2>Movimientos de equipo</h2>
          <StatusTag>{held} unidades en préstamo</StatusTag>
        </div>
        <div className="filter-grid">
          <label>
            Buscar paciente, equipo o bodega
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <label>
            Tipo de movimiento
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Todos</option>
              <option value="loan">Préstamo</option>
              <option value="return">Devolución</option>
            </select>
          </label>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="inventory-ledger-table stock-cards">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Ítem</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Bodega</th>
                  <th>Paciente</th>
                  {canWrite && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {rows.slice(currentPage * 50, (currentPage + 1) * 50).map((row) => (
                  <tr key={row.key}>
                    <td data-stock-label="Fecha">{formatDate(row.date)}</td>
                    <td data-stock-label="Ítem">
                      <strong>{equipment.get(row.custody.itemId)?.name}</strong>
                      <small>{equipment.get(row.custody.itemId)?.sku}</small>
                    </td>
                    <td data-stock-label="Tipo">
                      <StatusTag tone={row.type === 'loan' ? 'neutral' : 'success'}>
                        {row.type === 'loan' ? 'Préstamo' : 'Devolución'}
                      </StatusTag>
                    </td>
                    <td data-stock-label="Cantidad">{row.quantity}</td>
                    <td data-stock-label="Bodega">
                      {warehouses.get(row.custody.warehouseId)?.name ?? row.custody.warehouseId}
                    </td>
                    <td data-stock-label="Paciente">
                      {names.get(row.custody.patientId) ?? 'Paciente vinculado'}
                    </td>
                    {canWrite && (
                      <td data-stock-label="Acciones">
                        {row.type === 'loan' && row.custody.status === 'OPEN' ? (
                          <Button
                            className="button-secondary"
                            disabled={!operations.connected || operations.busy}
                            onClick={() => start(row.custody)}
                          >
                            Registrar devolución
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Sin movimientos de equipo"
            detail={
              type || search
                ? 'Cambie los filtros para ver otros movimientos.'
                : 'Los préstamos y sus devoluciones aparecerán aquí.'
            }
          />
        )}
        {lastPage > 0 && (
          <nav aria-label="Páginas de movimientos" className="action-row">
            <Button
              className="button-secondary"
              disabled={!currentPage}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </Button>
            <span>
              Página {currentPage + 1} de {lastPage + 1}
            </span>
            <Button
              className="button-secondary"
              disabled={currentPage >= lastPage}
              onClick={() => setPage(currentPage + 1)}
            >
              Siguiente
            </Button>
          </nav>
        )}
      </Panel>
      {operations.homeCustodies.some((c) => !equipment.has(c.itemId)) && (
        <div>
          <Link className="button button-secondary" href="/inventory/home-deliveries/history">
            Entregas anteriores de otros artículos
          </Link>
        </div>
      )}
      <Dialog
        open={Boolean(form)}
        onClose={() => {
          if (!operations.busy) setForm(null);
        }}
        title={form?.custody ? 'Registrar devolución' : 'Registrar nueva ubicación'}
        footer={
          <>
            <Button
              className="button-secondary"
              disabled={operations.busy}
              onClick={() => setForm(null)}
            >
              Cancelar
            </Button>
            <Button type="submit" form="equipment-form" disabled={operations.busy || limit < 1}>
              {operations.busy ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        {form && (
          <form key={form.key} id="equipment-form" onSubmit={submit} className="form-grid">
            <label>
              Tipo de movimiento
              <input readOnly value={form.custody ? 'Devolución' : 'Préstamo'} />
            </label>
            <label>
              Paciente
              {form.custody ? (
                <input readOnly value={names.get(form.custody.patientId) ?? 'Paciente vinculado'} />
              ) : (
                <select name="patientId" defaultValue="" required>
                  <option value="" disabled>
                    Seleccione un paciente
                  </option>
                  {operations.deliveryPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label>
              Ítem
              {form.custody ? (
                <input readOnly value={equipment.get(form.custody.itemId)?.name ?? ''} />
              ) : (
                <select
                  value={itemId}
                  onChange={(e) => {
                    setItemId(e.target.value);
                    setWarehouseId('');
                  }}
                  required
                >
                  <option value="">Seleccione un equipo</option>
                  {[...equipment.values()]
                    .filter((i) => availableIds.has(i.id))
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.sku} · {i.name}
                      </option>
                    ))}
                </select>
              )}
            </label>
            <label>
              Bodega
              {form.custody ? (
                <input readOnly value={warehouses.get(form.custody.warehouseId)?.name ?? ''} />
              ) : (
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  required
                >
                  <option value="">Seleccione una bodega</option>
                  {available
                    .filter((p) => p.itemId === itemId)
                    .map((p) => (
                      <option key={p.warehouseId} value={p.warehouseId}>
                        {warehouses.get(p.warehouseId)?.name} · {p.available} disponibles
                      </option>
                    ))}
                </select>
              )}
            </label>
            <label>
              Cantidad
              <input
                name="quantity"
                type="number"
                step={1}
                min={1}
                max={limit}
                defaultValue={1}
                required
              />
              {form.custody && <small>En poder del paciente: {limit}</small>}
            </label>
            {!form.custody && !available.length && (
              <p className="notice full-field">
                No hay equipos disponibles para préstamo en bodegas activas.
              </p>
            )}
            {operations.error && (
              <p className="field-error full-field" role="alert">
                {operations.error}
              </p>
            )}
          </form>
        )}
      </Dialog>
    </div>
  );
}
