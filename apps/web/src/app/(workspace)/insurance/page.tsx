'use client';

import type { InsuranceRequest, InsuranceRequestStatus, Quote } from '@analiza/contracts';
import {
  normalizeDocument,
  normalizePhone,
  normalizeText,
  searchInsuranceRequests,
} from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';

const statuses = [
  'SENT_TO_INSURER',
  'INSURER_REVIEW',
  'INFO_REQUIRED',
  'PARTIALLY_APPROVED',
  'APPROVED',
  'REJECTED',
] as const;
const labels: Record<InsuranceRequestStatus, string> = {
  SENT_TO_INSURER: 'Enviada al seguro',
  INSURER_REVIEW: 'En revisión',
  INFO_REQUIRED: 'Información requerida',
  PARTIALLY_APPROVED: 'Aprobación parcial',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};
const tone = (status: InsuranceRequestStatus) =>
  status === 'APPROVED'
    ? 'success'
    : status === 'REJECTED'
      ? 'danger'
      : status === 'INFO_REQUIRED' || status === 'PARTIALLY_APPROVED'
        ? 'warning'
        : 'neutral';
const displayDate = (value: string) => new Date(value).toLocaleString('es-SV');
type UpdateDraft = { quoteId: string; status: InsuranceRequestStatus; note: string; date: string };
function insurerFor(patient: { insurer?: string; insurance?: { insurer?: string } } | undefined) {
  return patient?.insurer ?? patient?.insurance?.insurer;
}

export default function InsurancePage() {
  const { can } = useAuth();
  const {
    error,
    insuranceEvents,
    insuranceRequests,
    loading,
    patients,
    quotes,
    recordInsuranceObservation,
  } = useWorkspace();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<InsuranceRequestStatus | ''>('');
  const [draft, setDraft] = useState<UpdateDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);
  const quoteId = searchParams.get('quote') ?? '';
  const quote = quotes.find((candidate) => candidate.id === quoteId);
  const contextRequest = quote
    ? insuranceRequests.find((candidate) => candidate.quoteId === quote.id)
    : undefined;
  const visibleRequests = useMemo(
    () =>
      searchInsuranceRequests(insuranceRequests, patients, query).filter(
        (request) => !status || request.status === status,
      ),
    [insuranceRequests, patients, query, status],
  );
  const unrequestedQuotes = useMemo(() => {
    if (status) return [];
    const needle = normalizeText(query);
    const documentNeedle = normalizeDocument(query);
    const phoneNeedle = normalizePhone(query);
    return quotes
      .filter((candidate) => !insuranceRequests.some((request) => request.quoteId === candidate.id))
      .filter((candidate) => {
        const patient = patients.find((item) => item.id === candidate.patientId);
        const insurer = insurerFor(patient);
        if (!patient || !insurer) return false;
        return (
          !needle ||
          normalizeText(candidate.id).includes(needle) ||
          normalizeDocument(candidate.id).includes(documentNeedle) ||
          normalizeText(patient.fullName).includes(needle) ||
          normalizeText(insurer).includes(needle) ||
          normalizeDocument(patient.documentId).includes(documentNeedle) ||
          (phoneNeedle.length > 0 && normalizePhone(patient.phone ?? '').includes(phoneNeedle))
        );
      });
  }, [insuranceRequests, patients, query, quotes, status]);
  useEffect(() => {
    if (quoteId && contextRef.current) contextRef.current.scrollIntoView({ block: 'nearest' });
  }, [quoteId]);
  function openUpdate(target: Quote) {
    setMessage(null);
    setLocalError(null);
    const request = insuranceRequests.find((candidate) => candidate.quoteId === target.id);
    setDraft({
      quoteId: target.id,
      status: request?.status ?? 'SENT_TO_INSURER',
      note: '',
      date: new Date().toISOString().slice(0, 16),
    });
  }
  function closeUpdate() {
    setDraft(null);
    setLocalError(null);
  }
  function submitUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !draft.note.trim() || !draft.date) {
      setLocalError('Indique el estado observado, la fecha y una observación.');
      return;
    }
    const registered = recordInsuranceObservation({
      ...draft,
      note: draft.note.trim(),
      date: new Date(draft.date).toISOString(),
    });
    if (!registered) {
      setLocalError(
        'No fue posible registrar la actualización. Verifique el permiso, la cotización y el paciente asociado.',
      );
      return;
    }
    setMessage(
      'Actualización administrativa de seguro registrada y persistida. No se modificaron cotización, pagos, agenda ni hospitalización.',
    );
    closeUpdate();
  }
  function blocked(channel: string) {
    setMessage(`${channel}: proveedor/canal externo no configurado.`);
  }
  const selectedPatient = quote
    ? patients.find((candidate) => candidate.id === quote.patientId)
    : undefined;
  const selectedInsurer = insurerFor(selectedPatient);
  const activeQuote = draft
    ? quotes.find((candidate) => candidate.id === draft.quoteId)
    : undefined;
  const activePatient = activeQuote
    ? patients.find((candidate) => candidate.id === activeQuote.patientId)
    : undefined;
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operaciones</p>
          <h1>Preautorizaciones y seguros</h1>
          <p>
            Seguimiento de hechos administrativos observados. No ejecuta autorizaciones, cobertura
            ni transiciones automáticas.
          </p>
        </div>
        <StatusTag tone="warning">Reglas de seguro pendientes</StatusTag>
      </header>
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      {error || localError ? (
        <p className="notice error" role="alert">
          {localError ?? error}
        </p>
      ) : null}
      {quoteId ? (
        <Panel>
          <div ref={contextRef} className="page-stack">
            <h2>Contexto de cotización</h2>
            {quote && selectedPatient && selectedInsurer ? (
              <>
                <p>
                  <strong>{quote.id}</strong> · {selectedPatient.fullName} · {selectedInsurer}
                </p>
                <p>
                  {contextRequest
                    ? `Solicitud relacionada: ${labels[contextRequest.status]}.`
                    : 'No existe una solicitud persistida todavía. Visitar este enlace no crea una preautorización.'}
                </p>
                <div className="action-row">
                  {can('insurance:write') ? (
                    <Button
                      data-action-id="INSURANCE-UPDATE"
                      onClick={() => openUpdate(quote)}
                      type="button"
                    >
                      Registrar actualización
                    </Button>
                  ) : null}
                  <Link data-action-id="INSURANCE-OPEN-QUOTE" href={`/quotes/${quote.id}`}>
                    Abrir cotización
                  </Link>
                </div>
              </>
            ) : (
              <EmptyState
                detail="La cotización indicada no existe o no tiene paciente/aseguradora configurados."
                title="Cotización no disponible"
              />
            )}
          </div>
        </Panel>
      ) : null}
      <Panel>
        <div className="table-heading">
          <h2>Solicitudes registradas</h2>
          <StatusTag>{visibleRequests.length + unrequestedQuotes.length} visibles</StatusTag>
        </div>
        <div className="form-grid">
          <label className="full" htmlFor="insurance-search">
            Buscar solicitudes
          </label>
          <input
            data-action-id="INSURANCE-SEARCH"
            id="insurance-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, documento, teléfono, cotización o aseguradora"
            type="search"
            value={query}
          />
          <Button
            className="button-secondary"
            data-action-id="INSURANCE-SEARCH-CLEAR"
            disabled={!query}
            onClick={() => setQuery('')}
            type="button"
          >
            Limpiar búsqueda
          </Button>
          <label>
            Estado observado
            <select
              data-action-id="INSURANCE-FILTER-STATUS"
              onChange={(event) => setStatus(event.target.value as InsuranceRequestStatus | '')}
              value={status}
            >
              <option value="">Todos</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {labels[item]}
                </option>
              ))}
            </select>
          </label>
          <Button
            className="button-secondary"
            data-action-id="INSURANCE-FILTER-RESET"
            onClick={() => setStatus('')}
            type="button"
          >
            Restablecer filtro
          </Button>
        </div>
      </Panel>
      <Panel>
        {loading ? (
          <p role="status">Cargando solicitudes…</p>
        ) : visibleRequests.length + unrequestedQuotes.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cotización</th>
                  <th>Paciente</th>
                  <th>Documento</th>
                  <th>Aseguradora</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Última observación</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests.map((request) => (
                  <InsuranceRow
                    events={insuranceEvents.filter((event) => event.requestId === request.id)}
                    key={request.id}
                    onUpdate={openUpdate}
                    patient={patients.find((candidate) => candidate.id === request.patientId)}
                    quote={quotes.find((candidate) => candidate.id === request.quoteId)}
                    request={request}
                    writable={can('insurance:write')}
                  />
                ))}
                {unrequestedQuotes.map((candidate) => (
                  <InsuranceRow
                    events={[]}
                    key={candidate.id}
                    onUpdate={openUpdate}
                    patient={patients.find((item) => item.id === candidate.patientId)}
                    quote={candidate}
                    writable={can('insurance:write')}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            detail={
              query || status
                ? 'Ajuste o restablezca los filtros para ver solicitudes existentes.'
                : 'Registre una actualización administrativa desde una cotización para iniciar el historial.'
            }
            title="Sin resultados"
          />
        )}
      </Panel>
      <Panel>
        <h2>Acciones externas y reclamos</h2>
        <p>
          Los controles se mantienen visibles como superficies seguras: no afirman envíos,
          recepción, entrega ni procesamiento de reclamos.
        </p>
        <div className="action-row">
          {can('insurance:write') ? (
            <>
              <Button
                className="button-secondary"
                data-action-id="INSURANCE-WHATSAPP"
                onClick={() => blocked('WhatsApp')}
                type="button"
              >
                WhatsApp
              </Button>
              <Button
                className="button-secondary"
                data-action-id="INSURANCE-EMAIL"
                onClick={() => blocked('Email')}
                type="button"
              >
                Email
              </Button>
              <Button
                className="button-secondary"
                data-action-id="INSURANCE-SEND"
                onClick={() => blocked('Envío al seguro')}
                type="button"
              >
                Enviar al seguro
              </Button>
            </>
          ) : null}
          <Button
            className="button-secondary"
            data-action-id="INSURANCE-CLAIM"
            onClick={() => setMessage('Flujo de reclamo pendiente de definición CH08-Q002.')}
            type="button"
          >
            Reclamo
          </Button>
        </div>
      </Panel>
      <Dialog
        description="Registra una actualización administrativa observada; no activa una decisión automática de la aseguradora."
        footer={
          <>
            <Button
              className="button-secondary"
              data-action-id="INSURANCE-UPDATE-CANCEL"
              onClick={closeUpdate}
              type="button"
            >
              Cancelar
            </Button>
            <Button
              data-action-id="INSURANCE-UPDATE-SUBMIT"
              form="insurance-update-form"
              type="submit"
            >
              Registrar actualización
            </Button>
          </>
        }
        onClose={closeUpdate}
        open={Boolean(draft)}
        title={
          activeQuote ? `Registrar actualización · ${activeQuote.id}` : 'Registrar actualización'
        }
      >
        {activeQuote && activePatient ? (
          <form className="form-grid" id="insurance-update-form" onSubmit={submitUpdate}>
            <p className="full">
              <strong>Contexto:</strong> {activePatient.fullName} ·{' '}
              {insurerFor(activePatient) ?? 'Sin aseguradora'} · total{' '}
              {activeQuote.total.toFixed(2)}
            </p>
            <label>
              Estado observado
              <select
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? { ...current, status: event.target.value as InsuranceRequestStatus }
                      : current,
                  )
                }
                value={draft?.status}
              >
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {labels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fecha
              <input
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, date: event.target.value } : current,
                  )
                }
                type="datetime-local"
                value={draft?.date ?? ''}
              />
            </label>
            <label className="full">
              Observación / respuesta
              <textarea
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, note: event.target.value } : current,
                  )
                }
                placeholder="Registre el hecho administrativo observado."
                required
                rows={4}
                value={draft?.note ?? ''}
              />
            </label>
          </form>
        ) : (
          <EmptyState
            detail="La cotización ya no está disponible."
            title="Contexto no disponible"
          />
        )}
      </Dialog>
    </div>
  );
}

function InsuranceRow({
  events,
  onUpdate,
  patient,
  quote,
  request,
  writable,
}: {
  events: readonly { id: string; status: InsuranceRequestStatus; date: string; note: string }[];
  onUpdate: (quote: Quote) => void;
  patient:
    | { fullName: string; documentId: string; insurer?: string; insurance?: { insurer?: string } }
    | undefined;
  quote: Quote | undefined;
  request?: InsuranceRequest;
  writable: boolean;
}) {
  return (
    <tr>
      <td>
        {quote ? (
          <Link data-action-id="INSURANCE-OPEN-QUOTE" href={`/quotes/${quote.id}`}>
            {quote.id}
          </Link>
        ) : (
          request?.quoteId
        )}
      </td>
      <td>{patient?.fullName ?? 'No disponible'}</td>
      <td>{patient?.documentId ?? 'No disponible'}</td>
      <td>{request?.insurer ?? insurerFor(patient) ?? 'Sin dato'}</td>
      <td>
        {request ? (
          <StatusTag tone={tone(request.status)}>{labels[request.status]}</StatusTag>
        ) : (
          <StatusTag>Sin solicitud registrada</StatusTag>
        )}
      </td>
      <td>{quote ? quote.total.toFixed(2) : 'No disponible'}</td>
      <td>
        {request ? (
          <details>
            <summary>{request.lastNote}</summary>
            <ol>
              {events.map((event) => (
                <li key={event.id}>
                  <strong>{labels[event.status]}</strong> · {displayDate(event.date)}
                  <br />
                  {event.note}
                </li>
              ))}
            </ol>
          </details>
        ) : (
          'Sin observación'
        )}
      </td>
      <td>
        {quote && writable ? (
          <Button
            className="button-link"
            data-action-id="INSURANCE-UPDATE"
            onClick={() => onUpdate(quote)}
            type="button"
          >
            Registrar actualización
          </Button>
        ) : null}
      </td>
    </tr>
  );
}
