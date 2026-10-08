'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useAuth, useWorkspace } from '@/components/providers';
import { useOperations } from '@/lib/use-operations';
import type { HomeCustody } from '@analiza/contracts';

const dateTime = (value: string) =>
  new Date(value).toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' });

export default function HomeDeliveriesPage() {
  const operations = useOperations();
  const { catalogItems, hospitalizations } = useWorkspace();
  const { can } = useAuth();
  const [dialog, setDialog] = useState<'dispatch' | 'close' | null>(null);
  const [selected, setSelected] = useState<HomeCustody | null>(null);
  const [patientId, setPatientId] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [message, setMessage] = useState('');
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [commandAt, setCommandAt] = useState(() => new Date().toISOString());
  const items = useMemo(
    () =>
      catalogItems.filter(
        (item) =>
          item.status === 'ACTIVE' &&
          ['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT'].includes(item.category ?? ''),
      ),
    [catalogItems],
  );
  const names = new Map(
    operations.deliveryPatients.map((patient) => [patient.id, patient.fullName]),
  );
  const itemNames = new Map(catalogItems.map((item) => [item.id, item.name]));
  const warehouseNames = new Map(
    operations.warehouses.map((warehouse) => [warehouse.id, warehouse.name]),
  );
  const rows = operations.homeCustodies.filter(
    (row) =>
      (status === 'ALL' || row.status === status) &&
      `${names.get(row.patientId) ?? ''} ${itemNames.get(row.itemId) ?? ''} ${row.reference}`
        .toLocaleLowerCase('es-SV')
        .includes(query.trim().toLocaleLowerCase('es-SV')),
  );
  const open = operations.homeCustodies.filter((row) => row.status === 'OPEN');
  const held = operations.homeCustodies
    .filter((row) => row.status === 'CLOSED')
    .reduce((sum, row) => sum + row.returnedQuantity, 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const okay =
      dialog === 'dispatch'
        ? await operations.execute({
            command: 'home.dispatch',
            dispatch: {
              id: key,
              idempotencyKey: key,
              patientId,
              ...(values.get('caseId') ? { caseId: String(values.get('caseId')) } : {}),
              itemId: String(values.get('itemId')),
              warehouseId: String(values.get('warehouseId')),
              addressLine: addressLine.trim(),
              quantity: Number(values.get('quantity')),
              reference: String(values.get('reference')).trim(),
              note: String(values.get('note')).trim(),
              sentAt: commandAt,
            },
          })
        : selected &&
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
    setMessage(
      dialog === 'dispatch'
        ? 'Despacho registrado; las unidades salieron de la bodega y quedaron bajo custodia domiciliaria.'
        : 'Cierre registrado; lo devuelto quedó en cuarentena, sin aumentar el stock disponible.',
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Inventario · Custodia domiciliaria</p>
          <h1>Movimientos hacia casas</h1>
          <p>
            Despachos a pacientes, seguimiento de lo enviado y cierre con devolución física en
            cuarentena.
          </p>
        </div>
        {can('inventory:write') ? (
          <Button
            data-action-id="HOME-DISPATCH-CREATE"
            disabled={
              !operations.connected ||
              !items.length ||
              !operations.warehouses.some((item) => item.status === 'ACTIVE')
            }
            onClick={() => {
              setDialog('dispatch');
              setKey(crypto.randomUUID());
              setCommandAt(new Date().toISOString());
              setMessage('');
            }}
          >
            Registrar despacho
          </Button>
        ) : null}
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
        title={dialog === 'dispatch' ? 'Despacho a domicilio' : 'Cerrar custodia domiciliaria'}
        description={
          dialog === 'dispatch'
            ? 'Confirme paciente, dirección, artículo, bodega y cantidad. La salida se audita en el Kárdex.'
            : 'Indique sólo las unidades físicamente recibidas. Permanecerán en cuarentena.'
        }
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
          {dialog === 'dispatch' ? (
            <>
              <label className="full">
                Paciente
                <select
                  required
                  value={patientId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setPatientId(id);
                    setAddressLine(
                      operations.deliveryPatients.find((patient) => patient.id === id)
                        ?.addressLine ?? '',
                    );
                  }}
                >
                  <option value="">Seleccione un paciente</option>
                  {operations.deliveryPatients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full">
                Dirección de entrega
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  rows={2}
                  value={addressLine}
                  onChange={(event) => setAddressLine(event.target.value)}
                />
                <span className="field-help">
                  Se guarda una copia de la dirección usada en este despacho.
                </span>
              </label>
              <label className="full">
                Hospitalización relacionada (opcional)
                <select name="caseId">
                  <option value="">Entrega directa al paciente</option>
                  {hospitalizations
                    .filter((item) => item.patientId === patientId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id} · {item.startDate}
                      </option>
                    ))}
                </select>
                <span className="field-help">
                  Si la entrega pertenece a un caso, vincúlelo para conservar trazabilidad.
                </span>
              </label>
              <label>
                Artículo
                <select name="itemId" required>
                  <option value="">Seleccione un artículo</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Bodega de origen
                <select name="warehouseId" required>
                  <option value="">Seleccione una bodega</option>
                  {operations.warehouses
                    .filter((warehouse) => warehouse.status === 'ACTIVE')
                    .map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Cantidad <input name="quantity" type="number" min="1" step="1" required />
              </label>
              <label>
                Referencia / acuse <input name="reference" maxLength={200} required />
              </label>
              <label className="full">
                Nota administrativa (opcional) <textarea name="note" rows={2} maxLength={1000} />
              </label>
            </>
          ) : (
            <>
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
            </>
          )}
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
