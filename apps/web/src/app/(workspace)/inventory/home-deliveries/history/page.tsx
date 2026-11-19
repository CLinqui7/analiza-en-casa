'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useAuth, useWorkspace } from '@/components/providers';
import { useOperations } from '@/lib/use-operations';
import type { HomeCustody } from '@analiza/contracts';

const dateTime = (value: string) =>
  new Date(value).toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' });

export default function HomeDeliveriesPage() {
  const operations = useOperations();
  const { catalogItems } = useWorkspace();
  const { can } = useAuth();
  const [dialog, setDialog] = useState<'close' | null>(null);
  const [selected, setSelected] = useState<HomeCustody | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [message, setMessage] = useState('');
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [commandAt, setCommandAt] = useState(() => new Date().toISOString());
  const names = new Map(
    operations.deliveryPatients.map((patient) => [patient.id, patient.fullName]),
  );
  const itemNames = new Map(catalogItems.map((item) => [item.id, item.name]));
  const warehouseNames = new Map(
    operations.warehouses.map((warehouse) => [warehouse.id, warehouse.name]),
  );
  const equipmentIds = new Set(
    catalogItems.filter((item) => item.category === 'EQUIPMENT').map((item) => item.id),
  );
  const legacyRows = operations.homeCustodies.filter((row) => !equipmentIds.has(row.itemId));
  const search = query.trim().toLocaleLowerCase('es-SV');
  const rows = legacyRows.filter(
    (row) =>
      (status === 'ALL' || row.status === status) &&
      [names.get(row.patientId), itemNames.get(row.itemId), row.reference]
        .join(' ')
        .toLocaleLowerCase('es-SV')
        .includes(search),
  );
  const open = legacyRows.filter((row) => row.status === 'OPEN');
  const held = legacyRows
    .filter((row) => row.status === 'CLOSED')
    .reduce((sum, row) => sum + row.returnedQuantity, 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const okay =
      selected &&
      (await operations.execute({
        command: 'home.close',
        closure: {
          custodyId: selected.id,
          returnedQuantity: Number(values.get('returnedQuantity')),
          receivedAt: commandAt,
          conditionNote: String(values.get('conditionNote')).trim(),
          idempotencyKey: key,
        },
      }));
    if (!okay) return;
    setDialog(null);
    setSelected(null);
    setKey(crypto.randomUUID());
    setMessage('Cierre registrado. Las unidades recibidas quedan en cuarentena.');
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Inventario · Custodia domiciliaria</p>
          <h1>Historial de entregas anteriores</h1>
          <p>
            Despachos a pacientes, seguimiento de lo enviado y cierre con devolución física en
            cuarentena.
          </p>
        </div>
        <Link className="button button-secondary" href="/inventory/home-deliveries">
          Volver a ubicación de equipo
        </Link>
      </header>
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      {operations.error ? (
        <p className="notice warning" role="alert">
          {operations.error}
        </p>
      ) : null}
      <section className="studio-metrics" aria-label="Resumen de custodia domiciliaria">
        <Panel>
          <article>
            <div>
              <small>Despachos abiertos</small>
              <strong>{open.length}</strong>
              <p>Requieren conciliación o cierre</p>
            </div>
          </article>
        </Panel>
        <Panel>
          <article>
            <div>
              <small>Unidades en casas</small>
              <strong>{open.reduce((sum, row) => sum + row.quantity, 0)}</strong>
              <p>Fuera de las bodegas</p>
            </div>
          </article>
        </Panel>
        <Panel>
          <article>
            <div>
              <small>Devueltas en cuarentena</small>
              <strong>{held}</strong>
              <p>No disponibles para volver a entregar</p>
            </div>
          </article>
        </Panel>
      </section>
      <Panel>
        <div className="table-heading">
          <h2>Historial por paciente</h2>
          <StatusTag>{rows.length} registros</StatusTag>
        </div>
        <div className="studio-toolbar">
          <label>
            Buscar paciente, artículo o referencia
            <input
              aria-label="Buscar despacho domiciliario"
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              value={query}
            />
          </label>
          <label>
            Estado
            <select
              aria-label="Filtrar estado de despacho"
              onChange={(event) => setStatus(event.target.value as typeof status)}
              value={status}
            >
              <option value="ALL">Todos</option>
              <option value="OPEN">Abiertos</option>
              <option value="CLOSED">Cerrados</option>
            </select>
          </label>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente / dirección</th>
                  <th>Artículo</th>
                  <th>Bodega</th>
                  <th>Enviado</th>
                  <th>Devuelto</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {dateTime(row.sentAt)}
                      <small style={{ display: 'block' }}>{row.reference}</small>
                    </td>
                    <td>
                      <strong>{names.get(row.patientId) ?? 'Paciente'}</strong>
                      <small style={{ display: 'block' }}>{row.addressLine}</small>
                    </td>
                    <td>{itemNames.get(row.itemId) ?? row.itemId}</td>
                    <td>{warehouseNames.get(row.warehouseId) ?? row.warehouseId}</td>
                    <td>{row.quantity}</td>
                    <td>{row.returnedQuantity}</td>
                    <td>
                      <StatusTag tone={row.status === 'OPEN' ? 'warning' : 'success'}>
                        {row.status === 'OPEN' ? 'En casa' : 'Cerrado'}
                      </StatusTag>
                    </td>
                    <td>
                      {row.status === 'OPEN' && can('inventory:write') ? (
                        <Button
                          className="button-secondary"
                          data-action-id="HOME-DISPATCH-CLOSE"
                          onClick={() => {
                            setSelected(row);
                            setKey(crypto.randomUUID());
                            setCommandAt(new Date().toISOString());
                            setDialog('close');
                          }}
                        >
                          Cerrar y recibir
                        </Button>
                      ) : row.returnedQuantity ? (
                        'En cuarentena'
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Sin despachos en este filtro"
            detail="Un traslado entre bodegas sigue registrándose en Movimientos; aquí se documenta la custodia en casa."
          />
        )}
      </Panel>
      <p className="notice" role="note">
        Al cerrar, la diferencia entre enviado y devuelto queda como «no devuelto»: no se presume
        administración ni consumo. Los artículos devueltos requieren liberación de calidad antes de
        volver a estar disponibles.
      </p>
      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title="Cerrar custodia domiciliaria"
        description="Indique las unidades recibidas para su revisión."
        footer={
          <>
            <Button className="button-secondary" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button disabled={operations.busy} form="home-delivery-form" type="submit">
              {operations.busy ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form
          className="form-grid"
          id="home-delivery-form"
          onSubmit={(event) => void submit(event)}
        >
          <p className="notice full">
            {selected
              ? `${names.get(selected.patientId) ?? 'Paciente'} · ${itemNames.get(selected.itemId) ?? selected.itemId} · ${selected.quantity} unidades enviadas`
              : ''}
          </p>
          <label>
            Unidades físicamente devueltas
            <input
              name="returnedQuantity"
              type="number"
              min="0"
              max={selected?.quantity ?? 0}
              step="1"
              defaultValue="0"
              required
            />
          </label>
          <label className="full">
            Estado observado de la devolución
            <textarea
              name="conditionNote"
              rows={2}
              maxLength={1000}
              placeholder="Describa empaque o condición visible si hay devolución"
            />
          </label>
          {operations.error ? (
            <p className="field-error full" role="alert">
              {operations.error}
            </p>
          ) : null}
        </form>
      </Dialog>
    </div>
  );
}
