'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { quoteDisplayCode } from '@analiza/domain';
import { useAuth } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';
import type { ReceivedOrderEntry, ReceivedOrderInbox } from '@/lib/quote-fulfillment';

export default function ReceivedOrdersPage() {
  const { can } = useAuth();
  const [inbox, setInbox] = useState<ReceivedOrderInbox | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const request = useRef<AbortController | null>(null);
  const [selected, setSelected] = useState<ReceivedOrderEntry | null>(null);
  const [nurseId, setNurseId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => () => request.current?.abort(), []);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/received-orders?page=${page}&search=${encodeURIComponent(search)}`,
        {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        },
      );
      const payload = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(payload.error || 'No se pudo consultar los pedidos.');
      setInbox(payload);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar los pedidos.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [page, search]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  function open(entry: ReceivedOrderEntry) {
    setSelected(entry);
    setNurseId('');
    setQuantity(Math.max(0, entry.quantity - entry.delivered));
    setKey(crypto.randomUUID());
    setError('');
  }
  async function deliver() {
    if (!selected || !nurseId || quantity <= 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/received-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
        body: JSON.stringify({
          quoteId: selected.quoteId,
          lineId: selected.lineId,
          nursingResourceId: nurseId,
          quantity,
          idempotencyKey: key,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo registrar la entrega.');
      setMessage(
        'Entrega registrada con la enfermera seleccionada. No se modificaron las existencias.',
      );
      setSelected(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo registrar la entrega.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-stack fulfillment-page">
      <header className="fulfillment-hero">
        <div>
          <p className="eyebrow">Inventario y compras</p>
          <h1>Pedidos recibidos</h1>
          <p>
            Medicamentos e insumos de las cotizaciones, con seguimiento de entrega a enfermería.
          </p>
        </div>
        <div className="fulfillment-count">
          <strong>{inbox?.total ?? '—'}</strong>
          <span>líneas de pedido</span>
        </div>
      </header>
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      {error && !selected ? (
        <p className="notice danger" role="alert">
          {error}
        </p>
      ) : null}
      <Panel>
        <div className="order-search">
          <label htmlFor="received-order-patient">
            Buscar paciente por nombre o DUI
            <input
              id="received-order-patient"
              type="search"
              value={query}
              maxLength={200}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nombre completo o documento"
            />
          </label>
          {query ? (
            <Button
              className="button-secondary"
              onClick={() => {
                setQuery('');
                setSearch('');
                setPage(1);
              }}
            >
              Limpiar búsqueda
            </Button>
          ) : null}
        </div>
        <div className="table-heading">
          <h2>Productos por entregar</h2>
          <Button className="button-secondary" disabled={loading} onClick={() => void load()}>
            Actualizar
          </Button>
        </div>
        {loading ? (
          <p role="status">Consultando pedidos…</p>
        ) : inbox?.entries.length ? (
          <div className="table-wrap">
            <table className="fulfillment-table">
              <thead>
                <tr>
                  <th>Fecha de cotización</th>
                  <th>Paciente</th>
                  <th>Ítem</th>
                  <th>Cantidad</th>
                  <th>Entrega</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {inbox.entries.map((entry) => (
                  <tr key={`${entry.rootId}-${entry.lineId}`}>
                    <td data-label="Fecha de cotización">
                      {new Date(entry.createdAt).toLocaleDateString('es-SV')}
                      <small className="cell-secondary">{quoteDisplayCode(entry.rootId)}</small>
                    </td>
                    <td data-label="Paciente">
                      <strong>{entry.patientName}</strong>
                      {entry.patientDocument ? (
                        <small className="cell-secondary">{entry.patientDocument}</small>
                      ) : null}
                    </td>
                    <td data-label="Ítem">{entry.itemName}</td>
                    <td data-label="Cantidad">{entry.quantity}</td>
                    <td data-label="Entrega">
                      <StatusTag tone={entry.delivered >= entry.quantity ? 'success' : 'warning'}>
                        {entry.delivered >= entry.quantity
                          ? 'Entregado'
                          : entry.status === 'DRAFT'
                            ? 'En borrador'
                            : entry.delivered > 0
                              ? 'Entrega parcial'
                              : 'Pendiente'}
                      </StatusTag>
                      <small className="cell-secondary">
                        {entry.delivered} de {entry.quantity}
                      </small>
                    </td>
                    <td data-label="Acciones">
                      <Button className="button-secondary" onClick={() => open(entry)}>
                        Visualizar pedido
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={search ? 'Sin coincidencias' : 'Sin pedidos'}
            detail={
              search
                ? 'No hay pedidos para ese nombre o documento. Pruebe otra búsqueda.'
                : 'Las líneas de medicamentos e insumos de las cotizaciones aparecerán aquí.'
            }
          />
        )}
        <div className="table-heading">
          <span>
            Página {page} · {inbox?.total ?? 0} líneas
          </span>
          <div className="action-row">
            <Button
              className="button-secondary"
              disabled={loading || page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Button
              className="button-secondary"
              disabled={loading || page * 50 >= (inbox?.total ?? 0)}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </Panel>
      <Dialog
        open={Boolean(selected)}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
        title="Detalle del pedido"
        footer={
          <>
            <Button className="button-secondary" disabled={busy} onClick={() => setSelected(null)}>
              Cerrar
            </Button>
            {selected && selected.delivered < selected.quantity && can('inventory:write') ? (
              <Button
                disabled={
                  busy ||
                  selected.status !== 'SENT' ||
                  !nurseId ||
                  quantity <= 0 ||
                  quantity > selected.quantity - selected.delivered
                }
                onClick={() => void deliver()}
              >
                {busy ? 'Guardando…' : 'Entregado'}
              </Button>
            ) : null}
          </>
        }
      >
        {selected ? (
          <div className="page-stack">
            <div className="fulfillment-summary">
              <span>{quoteDisplayCode(selected.rootId)}</span>
              <h3>{selected.patientName}</h3>
              <p>{selected.itemName}</p>
              <strong>
                {selected.delivered} entregados ·{' '}
                {Math.max(0, selected.quantity - selected.delivered)} pendientes
              </strong>
            </div>
            {error ? (
              <p className="notice danger" role="alert">
                {error}
              </p>
            ) : null}
            {selected.deliveries.length ? (
              <section>
                <h3>Historial de entregas</h3>
                <ul className="delivery-timeline">
                  {selected.deliveries.map((event) => (
                    <li key={event.id}>
                      <strong>{event.nurseName}</strong>
                      <span>
                        {event.quantity} unidades ·{' '}
                        {new Date(event.createdAt).toLocaleString('es-SV')}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {selected.delivered < selected.quantity && can('inventory:write') ? (
              <div className="form-grid">
                <label>
                  Enfermera receptora
                  <select value={nurseId} onChange={(event) => setNurseId(event.target.value)}>
                    <option value="">Seleccione la enfermera</option>
                    {inbox?.nurses.map((nurse) => (
                      <option value={nurse.id} key={nurse.id}>
                        {nurse.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cantidad entregada
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    max={selected.quantity - selected.delivered}
                    value={quantity}
                    onChange={(event) => setQuantity(Number(event.target.value))}
                  />
                </label>
                <p className="field-help full-field">
                  Esta acción registra quién recibió los productos y cuándo. El consumo de
                  inventario se registra en su flujo correspondiente.
                </p>
                {selected.status !== 'SENT' ? (
                  <p className="notice full-field">
                    Marque primero la cotización como Enviada para registrar la entrega.
                  </p>
                ) : null}
                {!inbox?.nurses.length ? (
                  <p className="notice full-field">
                    Registre una enfermera con cuenta activa en Equipo y cuentas.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
