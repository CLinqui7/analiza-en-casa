'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { quoteDisplayCode } from '@analiza/domain';
import { useWorkspace } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';
import type { PrequoteChoice, PrequoteEntry, PrequoteInbox } from '@/lib/quote-fulfillment';
import { quoteStatusLabels } from '@/lib/quote-workflow';

const money = (amount: number) =>
  new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(amount);
export default function PrequotesPage() {
  const { refreshWorkspace } = useWorkspace();
  const [inbox, setInbox] = useState<PrequoteInbox | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PrequoteEntry | null>(null);
  const [choices, setChoices] = useState<PrequoteChoice[]>([]);
  const [choiceState, setChoiceState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const choiceRequest = useRef<AbortController | null>(null);
  const [quoteId, setQuoteId] = useState('');
  const [extensionReason, setExtensionReason] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [addedQuoteId, setAddedQuoteId] = useState<string | null>(null);
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
  useEffect(() => () => choiceRequest.current?.abort(), []);
  async function refreshChoices(entry: PrequoteEntry) {
    choiceRequest.current?.abort();
    const controller = new AbortController();
    choiceRequest.current = controller;
    setChoiceState('loading');
    setChoices([]);
    setQuoteId('');
    setExtensionReason('');
    setManualPrice('');
    setError('');
    try {
      // Scope by request, not inbox page: other requests can move it to another page.
      const response = await fetch(`/api/prequotes?requestId=${encodeURIComponent(entry.id)}`, {
        cache: 'no-store',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || 'No se pudieron consultar las cotizaciones.');
      if (controller.signal.aborted) return;
      const refreshed = (payload as PrequoteInbox).entries.find((item) => item.id === entry.id);
      if (!refreshed) throw new Error('La solicitud ya no está disponible. Actualice la bandeja.');
      setSelected(refreshed);
      setChoices(
        (payload as PrequoteInbox).quotes.filter(
          (quote) => quote.patientId === refreshed.patientId,
        ),
      );
      setChoiceState('ready');
    } catch (cause) {
      if (controller.signal.aborted) return;
      setChoiceState('error');
      setError(
        cause instanceof Error ? cause.message : 'No se pudieron consultar las cotizaciones.',
      );
    }
  }
  function closeSelection() {
    choiceRequest.current?.abort();
    setSelected(null);
  }
  const chosen = choices.find((quote) => quote.id === quoteId);
  const confirmedPrice = selected?.unitPrice ?? (manualPrice.trim() ? Number(manualPrice) : null);
  const priceReady =
    confirmedPrice !== null && Number.isFinite(confirmedPrice) && confirmedPrice >= 0;
  async function assign() {
    if (
      !selected ||
      !chosen ||
      choiceState !== 'ready' ||
      !selected.itemAvailable ||
      !priceReady ||
      busy
    )
      return;
    if (
      chosen.status === 'APPROVED' &&
      (!chosen.approvalDecisionId || extensionReason.trim().length < 5)
    )
      return;
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
          expectedUnitPrice: confirmedPrice,
          priceSource: selected.unitPrice === null ? 'MANUAL' : 'CATALOG',
          idempotencyKey: key,
          ...(chosen.status === 'APPROVED'
            ? {
                approvedExtension: {
                  decisionId: chosen.approvalDecisionId,
                  reason: extensionReason.trim(),
                },
              }
            : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo asignar la solicitud.');
      setAddedQuoteId(payload.quoteId);
      setMessage(
        chosen.status === 'APPROVED'
          ? 'Ampliación registrada. Se conservaron la aprobación, el historial y los pagos; la cuenta por cobrar está actualizada.'
          : chosen.status === 'SENT'
            ? 'Solicitud asignada. La cotización y su saldo en Cuentas por cobrar están actualizados.'
            : 'Solicitud asignada al borrador. Al marcar la cotización como Enviada, aparecerá en Cuentas por cobrar.',
      );
      closeSelection();
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
        <div className="notice success" role="status">
          <p>{message}</p>
          {addedQuoteId ? (
            <Link className="button button-secondary" href={`/quotes/${addedQuoteId}`}>
              Ver cotización actualizada
            </Link>
          ) : null}
        </div>
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
                          setExtensionReason('');
                          setKey(crypto.randomUUID());
                          setError('');
                          void refreshChoices(entry);
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
          if (!busy) closeSelection();
        }}
        title="Revisar solicitud de insumos"
        description="La asignación conserva una sola cotización y deja constancia de los productos añadidos."
        footer={
          <>
            <Button className="button-secondary" disabled={busy} onClick={closeSelection}>
              Cerrar
            </Button>
            {selected && !selected.assignedQuoteId ? (
              <Button
                disabled={
                  busy ||
                  choiceState !== 'ready' ||
                  !chosen ||
                  !selected.itemAvailable ||
                  !priceReady ||
                  (chosen.status === 'APPROVED' &&
                    (!chosen.approvalDecisionId || extensionReason.trim().length < 5))
                }
                onClick={() => void assign()}
              >
                {busy ? 'Añadiendo…' : 'Añadir a cotización'}
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
                  ? 'Precio de catálogo pendiente'
                  : `Precio unitario ${money(selected.unitPrice)} · Importe ${money(selected.unitPrice * selected.quantity)} antes de descuentos de la cotización`}
              </p>
            </div>
            {selected.note ? <p className="notice">{selected.note}</p> : null}
            {!selected.assignedQuoteId && selected.itemAvailable && selected.unitPrice === null ? (
              <label className="fulfillment-price">
                Precio unitario de esta solicitud (USD)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualPrice}
                  disabled={busy}
                  onChange={(event) => setManualPrice(event.target.value)}
                  placeholder="Ingrese el precio confirmado"
                />
                <span className="field-help">
                  El catálogo no tiene precio de venta. Confirme el importe con el equipo; se
                  guardará en esta cotización sin cambiar el catálogo.
                </span>
                {priceReady ? (
                  <span className="field-help">
                    Importe a añadir: {money(confirmedPrice! * selected.quantity)} antes de
                    descuentos.
                  </span>
                ) : null}
              </label>
            ) : null}
            {!selected.itemAvailable && !selected.assignedQuoteId ? (
              <p className="notice warning">
                El artículo no está disponible. Revise su estado en Catálogos.
              </p>
            ) : null}
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
                  <select
                    disabled={busy || choiceState !== 'ready'}
                    value={quoteId}
                    onChange={(event) => {
                      setQuoteId(event.target.value);
                      setExtensionReason('');
                    }}
                  >
                    <option value="">Seleccione una cotización del paciente</option>
                    {choices.map((quote) => (
                      <option key={quote.id} value={quote.id}>
                        {quoteDisplayCode(quote.rootId)} · {quoteStatusLabels[quote.status]} ·{' '}
                        {money(quote.total)}
                      </option>
                    ))}
                  </select>
                </label>
                {choiceState === 'loading' ? (
                  <p role="status">Buscando las cotizaciones vigentes del paciente…</p>
                ) : null}
                {choiceState === 'error' ? (
                  <Button
                    className="button-secondary"
                    onClick={() => void refreshChoices(selected)}
                  >
                    Reintentar consulta
                  </Button>
                ) : null}
                <p className="field-help">
                  Puede asignar a Borrador o Enviada, o registrar una ampliación auditada de una
                  Aprobada. Las rechazadas no admiten ampliaciones.
                </p>
                {chosen?.status === 'APPROVED' ? (
                  <>
                    <p className="notice">
                      Se añadirán únicamente los productos de esta solicitud. La aprobación original
                      y las versiones anteriores se conservarán; se actualizará el saldo de la misma
                      cuenta, respetando los pagos y descuentos registrados.
                    </p>
                    <label>
                      Motivo de la ampliación
                      <textarea
                        value={extensionReason}
                        disabled={busy}
                        required
                        minLength={5}
                        maxLength={1000}
                        rows={3}
                        onChange={(event) => setExtensionReason(event.target.value)}
                        placeholder="Indique por qué se añaden estos insumos a la cotización aprobada."
                      />
                    </label>
                  </>
                ) : null}
                {choiceState === 'ready' && !choices.length ? (
                  <div className="page-stack">
                    <p className="notice">
                      Este paciente no tiene cotizaciones disponibles para asignar esta solicitud.
                    </p>
                    <Link className="button button-secondary" href="/quotes?create=1">
                      Crear cotización
                    </Link>
                  </div>
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
