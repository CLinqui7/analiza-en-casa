'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { quoteDisplayCode } from '@analiza/domain';
import { useWorkspace } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';
import type { PrequoteEntry, PrequoteInbox } from '@/lib/quote-fulfillment';

const money = (amount: number) =>
  new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(amount);
export default function PrequotesPage() {
  const { refreshWorkspace } = useWorkspace();
  const [inbox, setInbox] = useState<PrequoteInbox | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PrequoteEntry | null>(null);
  const [quoteId, setQuoteId] = useState('');
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/prequotes?page=${page}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo consultar la bandeja.');
      setInbox(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar la bandeja.');
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const choices = inbox?.quotes.filter((quote) => quote.patientId === selected?.patientId) ?? [];
  const chosen = choices.find((quote) => quote.id === quoteId);
  async function assign() {
    if (!selected || !chosen || selected.unitPrice === null || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/prequotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
        body: JSON.stringify({
          requestId: selected.id,
          quoteId,
          expectedRecordVersion: chosen.recordVersion,
          expectedUnitPrice: selected.unitPrice,
          idempotencyKey: key,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo asignar la solicitud.');
      setMessage(
        chosen.status === 'SENT'
          ? 'Solicitud asignada. La cotización y su saldo en Cuentas por cobrar están actualizados.'
          : 'Solicitud asignada al borrador. Al marcar la cotización como Enviada, aparecerá en Cuentas por cobrar.',
      );
      setSelected(null);
      await Promise.all([load(), refreshWorkspace()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo asignar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-stack fulfillment-page">
      <header className="fulfillment-hero">
        <div>
          <p className="eyebrow">Clínico · Solicitudes de enfermería</p>
          <h1>Precotización</h1>
          <p>Revise los insumos solicitados y añádalos a la cotización del paciente.</p>
        </div>
        <div className="fulfillment-count">
          <strong>{inbox?.total ?? '—'}</strong>
          <span>solicitudes recibidas</span>
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
        <div className="table-heading">
          <h2>Bandeja de solicitudes</h2>
          <Button className="button-secondary" disabled={loading} onClick={() => void load()}>
            Actualizar
          </Button>
        </div>
        {loading ? (
          <p role="status">Consultando solicitudes…</p>
        ) : inbox?.entries.length ? (
          <div className="table-wrap">
            <table className="fulfillment-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th>Ítems</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {inbox.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Fecha">{new Date(entry.createdAt).toLocaleString('es-SV')}</td>
                    <td data-label="Paciente">
                      <strong>{entry.patientName}</strong>
                    </td>
                    <td data-label="Ítems">
                      {entry.itemName}
                      <small className="cell-secondary">Cantidad: {entry.quantity}</small>
                    </td>
                    <td data-label="Estado">
                      <StatusTag tone={entry.assignmentPresent ? 'success' : 'warning'}>
                        {entry.assignedQuoteId
                          ? entry.assignmentPresent
                            ? 'Asignada'
                            : 'Retirada de cotización'
                          : 'Pendiente'}
                      </StatusTag>
                    </td>
                    <td data-label="Acciones">
                      <Button
                        className="button-secondary"
                        onClick={() => {
                          setSelected(entry);
                          setQuoteId('');
                          setKey(crypto.randomUUID());
                          setError('');
                        }}
                      >
                        Revisar solicitud
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Sin solicitudes"
            detail="Las solicitudes de insumos que registre enfermería aparecerán aquí."
          />
        )}
        <div className="table-heading">
          <span>
            Página {page} · {inbox?.total ?? 0} solicitudes
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
        title="Revisar solicitud de insumos"
        description="La asignación conserva una sola cotización y deja constancia de los productos añadidos."
        footer={
          <>
            <Button className="button-secondary" disabled={busy} onClick={() => setSelected(null)}>
              Cerrar
            </Button>
            {selected && !selected.assignedQuoteId ? (
              <Button
                disabled={busy || !chosen || selected.unitPrice === null}
                onClick={() => void assign()}
              >
                {busy ? 'Guardando…' : 'Guardar asignación'}
              </Button>
            ) : null}
          </>
        }
      >
        {selected ? (
          <div className="page-stack">
            <div className="fulfillment-summary">
              <span>Paciente</span>
              <h3>{selected.patientName}</h3>
              <p>
                {selected.itemName} · {selected.quantity} unidades
              </p>
              <p>
                {selected.unitPrice === null
                  ? 'Precio pendiente de configurar en Catálogos'
                  : `Precio unitario ${money(selected.unitPrice)} · Importe ${money(selected.unitPrice * selected.quantity)} antes de descuentos de la cotización`}
              </p>
            </div>
            {selected.note ? <p className="notice">{selected.note}</p> : null}
            {error ? (
              <p className="notice danger" role="alert">
                {error}
              </p>
            ) : null}
            {selected.assignedQuoteId ? (
              <>
                {!selected.assignmentPresent ? (
                  <p className="notice warning">
                    La línea se retiró en una edición posterior. La asignación original se conserva
                    en el historial; revise la cotización vigente antes de generar otra solicitud.
                  </p>
                ) : null}
                <Link
                  className="button button-secondary"
                  href={`/quotes/${selected.currentQuoteId ?? selected.assignedQuoteId}`}
                >
                  Ver cotización{' '}
                  {quoteDisplayCode(selected.rootQuoteId ?? selected.assignedQuoteId)}
                </Link>
              </>
            ) : (
              <>
                <label>
                  Asignar a una cotización
                  <select value={quoteId} onChange={(event) => setQuoteId(event.target.value)}>
                    <option value="">Seleccione una cotización del paciente</option>
                    {choices.map((quote) => (
                      <option key={quote.id} value={quote.id}>
                        {quoteDisplayCode(quote.rootId)} ·{' '}
                        {quote.status === 'SENT' ? 'Enviada' : 'Borrador'} · {money(quote.total)}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="field-help">
                  Se muestran las cotizaciones en Borrador o Enviada. Las aprobadas y rechazadas
                  están cerradas para edición.
                </p>
                {!choices.length ? (
                  <Link className="button button-secondary" href="/quotes?create=1">
                    Crear cotización
                  </Link>
                ) : null}
                {chosen?.status === 'DRAFT' ? (
                  <p className="notice">
                    Este borrador todavía no genera una cuenta por cobrar. Su importe se incorporará
                    al marcarlo como Enviada.
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
