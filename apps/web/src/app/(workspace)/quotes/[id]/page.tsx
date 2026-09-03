'use client';

import { calculateQuoteBalance, canEditQuote, quoteCategories } from '@analiza/domain';
import { Button, EmptyState, Panel } from '@analiza/ui';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';

const money = (value: number) => `USD ${value.toFixed(2)}`;

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { patients, payments, quotes, sendQuote } = useWorkspace();
  const { can } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const quote = quotes.find((candidate) => candidate.id === id);
  if (!quote)
    return (
      <main className="page-stack">
        <EmptyState
          detail="La cotización no existe o no está disponible en este espacio de trabajo."
          title="Cotización no encontrada"
        />
        <Link data-action-id="QUOTE-BACK-TO-LIST" href="/quotes">
          Volver a cotizaciones
        </Link>
      </main>
    );
  const currentQuote = quote;
  const patient = patients.find((candidate) => candidate.id === currentQuote.patientId);
  const balance = calculateQuoteBalance(currentQuote, payments);
  const historyRoot = currentQuote.rootQuoteId ?? currentQuote.originalQuoteId ?? currentQuote.id;
  const history = quotes
    .filter(
      (candidate) =>
        (candidate.rootQuoteId ?? candidate.originalQuoteId ?? candidate.id) === historyRoot,
    )
    .slice()
    .sort((a, b) => a.version - b.version);
  const editable = can('quotes:write') && canEditQuote(currentQuote);
  function send() {
    sendQuote(currentQuote.id);
    setMessage(
      'La versión se marcó como enviada e inmutable. No se envió información a un canal externo.',
    );
  }
  function unavailable(text: string) {
    setMessage(text);
  }
  return (
    <div className="page-stack quote-print-area">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Facturación</p>
          <h1>{quote.id}</h1>
          <p>
            Versión v{quote.version} ·{' '}
            {quote.immutable ? 'Enviada e inmutable' : 'Borrador editable'}
          </p>
        </div>
        <div className="action-row no-print">
          {editable ? (
            <Button
              data-action-id="QUOTE-EDIT"
              onClick={() => router.push(`/quotes?edit=${quote.id}`)}
              type="button"
            >
              Editar borrador
            </Button>
          ) : null}
          {quote.immutable && can('quotes:write') ? (
            <Button
              data-action-id="QUOTE-REVISE"
              onClick={() => router.push(`/quotes?revise=${quote.id}`)}
              type="button"
            >
              Revisar / nueva versión
            </Button>
          ) : null}
          {editable ? (
            <Button data-action-id="QUOTE-SEND" onClick={send} type="button">
              Enviar versión
            </Button>
          ) : null}
          <Button
            className="button-secondary"
            data-action-id="QUOTE-PRINT"
            onClick={() => window.print()}
            type="button"
          >
            Imprimir
          </Button>
        </div>
      </header>
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      <div className="two-column">
        <Panel>
          <h2>Datos de la versión</h2>
          <dl className="definition-list">
            <div>
              <dt>Paciente</dt>
              <dd>{patient?.fullName ?? 'No disponible'}</dd>
            </div>
            <div>
              <dt>Hospitalización</dt>
              <dd>{quote.caseId}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{quote.immutable ? 'Enviada e inmutable' : 'Borrador'}</dd>
            </div>
            <div>
              <dt>Creación</dt>
              <dd>{new Date(quote.createdAt).toLocaleString('es-SV')}</dd>
            </div>
            <div>
              <dt>Envío</dt>
              <dd>
                {quote.sentAt ? new Date(quote.sentAt).toLocaleString('es-SV') : 'No enviada'}
              </dd>
            </div>
          </dl>
        </Panel>
        <Panel>
          <h2>Resumen operativo</h2>
          <p>{quote.summary}</p>
          <h3>Comentarios</h3>
          <p>{quote.comments || 'Sin comentarios.'}</p>
          {quote.revisionReason ? (
            <p>
              <strong>Motivo de revisión:</strong> {quote.revisionReason}
            </p>
          ) : null}
        </Panel>
      </div>
      <Panel>
        <h2>Conceptos por categoría</h2>
        {quoteCategories.map((category) => {
          const items = quote.items.filter((item) => item.category === category.value);
          return items.length ? (
            <section className="quote-category" key={category.value}>
              <h3>{category.label}</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th>Cantidad</th>
                      <th>Precio</th>
                      <th>Descuento</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.name}
                          {item.doctorName ? (
                            <>
                              <br />
                              <small>Médico: {item.doctorName}</small>
                            </>
                          ) : null}
                        </td>
                        <td>{item.quantity}</td>
                        <td>{money(item.unitPrice)}</td>
                        <td>{money(item.discountAmount)}</td>
                        <td>{money(item.quantity * item.unitPrice - item.discountAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null;
        })}
        {!quote.items.length ? <p>Esta versión no tiene conceptos registrados.</p> : null}
      </Panel>
      <div className="two-column">
        <Panel>
          <h2>Resumen financiero</h2>
          <dl className="definition-list">
            <div>
              <dt>Subtotal</dt>
              <dd>{money(quote.subtotal)}</dd>
            </div>
            <div>
              <dt>Descuento</dt>
              <dd>{money(quote.discountAmount)}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{money(quote.total)}</dd>
            </div>
            <div>
              <dt>Aseguradora</dt>
              <dd>{money(quote.insurerAmount)}</dd>
            </div>
            <div>
              <dt>Paciente</dt>
              <dd>{money(quote.patientAmount)}</dd>
            </div>
            <div>
              <dt>Pagado</dt>
              <dd>{money(balance.paid)}</dd>
            </div>
            <div>
              <dt>Saldo</dt>
              <dd>{money(balance.balance)}</dd>
            </div>
          </dl>
        </Panel>
        <Panel>
          <h2>Acciones relacionadas</h2>
          <div className="action-row no-print">
            {can('insurance:read') ? (
              <Button
                className="button-secondary"
                data-action-id="QUOTE-OPEN-INSURANCE"
                onClick={() => router.push(`/insurance?quote=${encodeURIComponent(quote.id)}`)}
                type="button"
              >
                Abrir seguro
              </Button>
            ) : null}
            {can('payments:read') ? (
              <Button
                className="button-secondary"
                data-action-id="QUOTE-OPEN-PAYMENT"
                onClick={() => router.push(`/payments?quote=${encodeURIComponent(quote.id)}`)}
                type="button"
              >
                Abrir pagos
              </Button>
            ) : null}
            {can('quotes:write') ? (
              <Button
                className="button-secondary"
                data-action-id="QUOTE-WHATSAPP"
                onClick={() => unavailable('Proveedor de mensajería no configurado.')}
                type="button"
              >
                Enviar WhatsApp
              </Button>
            ) : null}
            {can('quotes:write') ? (
              <Button
                className="button-secondary"
                data-action-id="QUOTE-PORTAL"
                onClick={() => unavailable('Portal seguro no configurado.')}
                type="button"
              >
                Copiar enlace portal
              </Button>
            ) : null}
          </div>
          <p className="field-help">
            Los canales externos permanecen bloqueados hasta que exista infraestructura aprobada. No
            se incluyen datos clínicos en estas acciones.
          </p>
        </Panel>
      </div>
      <Panel>
        <h2>Historial de versiones</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Versión</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Motivo</th>
                <th>Total</th>
                <th>Consultar</th>
              </tr>
            </thead>
            <tbody>
              {history.map((version) => (
                <tr key={version.id}>
                  <td>v{version.version}</td>
                  <td>{version.immutable ? 'Enviada' : 'Borrador'}</td>
                  <td>{new Date(version.createdAt).toLocaleString('es-SV')}</td>
                  <td>{version.revisionReason || '—'}</td>
                  <td>{money(version.total)}</td>
                  <td>
                    <Link href={`/quotes/${version.id}`}>Consultar</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Link className="text-link no-print" data-action-id="QUOTE-BACK-TO-LIST" href="/quotes">
        Volver a cotizaciones
      </Link>
    </div>
  );
}
