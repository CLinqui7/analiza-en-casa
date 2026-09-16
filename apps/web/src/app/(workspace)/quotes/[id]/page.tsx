'use client';

import { calculateQuoteBalance, canEditQuote, quoteCategories } from '@analiza/domain';
import { Button, EmptyState, Panel } from '@analiza/ui';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import QRCode from 'qrcode';
import { useAuth, useWorkspace } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';

const money = (value: number) => `USD ${value.toFixed(2)}`;
type PortalShare = {
  portalUrl: string;
  whatsappPhone: string;
  expiresAt: string;
  qrDataUrl: string;
};

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { patients, payments, providerMode, quotes, sendQuote } = useWorkspace();
  const { can } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [portalShare, setPortalShare] = useState<PortalShare | null>(null);
  const [creatingPortal, setCreatingPortal] = useState(false);
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
  async function send() {
    const saved = await sendQuote(currentQuote.id);
    if (saved) {
      setMessage('La versión se marcó como enviada e inmutable.');
    }
  }
  async function createPortalShare() {
    setCreatingPortal(true);
    setMessage(null);
    try {
      const response = await fetch('/api/portal-links', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
        body: JSON.stringify({ quoteId: currentQuote.id }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !payload || typeof payload !== 'object') {
        const detail =
          payload &&
          typeof payload === 'object' &&
          typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : 'No fue posible crear el acceso seguro.';
        setMessage(detail);
        return;
      }
      const { portalUrl, whatsappPhone, expiresAt } = payload as Record<string, unknown>;
      if (
        typeof portalUrl !== 'string' ||
        typeof whatsappPhone !== 'string' ||
        typeof expiresAt !== 'string'
      )
        throw new Error();
      const qrDataUrl = await QRCode.toDataURL(portalUrl, {
        width: 280,
        margin: 1,
        color: { dark: '#082f45', light: '#ffffff' },
      });
      setPortalShare({ portalUrl, whatsappPhone, expiresAt, qrDataUrl });
      setMessage('Acceso seguro creado. El QR y el enlace vencen automáticamente.');
    } catch {
      setMessage('El portal seguro requiere la conexión Mongo y la sesión protegida.');
    } finally {
      setCreatingPortal(false);
    }
  }
  async function copyPortalLink() {
    if (!portalShare) return;
    await navigator.clipboard.writeText(portalShare.portalUrl);
    setMessage('Enlace seguro copiado.');
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
            <Button data-action-id="QUOTE-SEND" onClick={() => void send()} type="button">
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
        <p className="notice" role="status">
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
              <dt>Comprobante</dt>
              <dd>{quote.invoiceDocumentType === 'TAX_CREDIT' ? 'Crédito fiscal' : 'Factura'}</dd>
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
                          <span>{item.name}</span>
                          {item.doctorName ? (
                            <>
                              <br />
                              <small>Médico: {item.doctorName}</small>
                            </>
                          ) : null}
                          {item.presentation ? (
                            <>
                              <br />
                              <small>
                                {item.presentation === 'BLISTER'
                                  ? 'Blíster'
                                  : item.presentation === 'TABLET'
                                    ? 'Tableta'
                                    : 'Unidad'}{' '}
                                · {item.quantity * (item.unitsPerPresentation ?? 1)} unidades
                                {item.inventoryItemId ? ' · Vinculado a inventario' : ''}
                              </small>
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
            {providerMode !== 'postgresql' && can('quotes:write') && quote.immutable ? (
              <Button
                className="button-secondary"
                data-action-id="QUOTE-PORTAL"
                disabled={creatingPortal}
                onClick={() => void createPortalShare()}
                type="button"
              >
                {creatingPortal ? 'Creando acceso…' : 'Crear QR y enlace seguro'}
              </Button>
            ) : null}
          </div>
          <p className="field-help">
            WhatsApp recibe únicamente un enlace con segundo factor; no se incluyen diagnósticos,
            tratamientos, medicamentos ni importes en el mensaje.
          </p>
          {portalShare ? (
            <div className="portal-share-card">
              <Image
                alt="Código QR del portal seguro"
                height={280}
                src={portalShare.qrDataUrl}
                unoptimized
                width={280}
              />
              <div>
                <strong>Acceso de consulta</strong>
                <span>Vence {new Date(portalShare.expiresAt).toLocaleString('es-SV')}</span>
                <div className="action-row">
                  <Button
                    className="button-secondary"
                    data-action-id="QUOTE-PORTAL-COPY"
                    onClick={() => void copyPortalLink()}
                    type="button"
                  >
                    Copiar enlace
                  </Button>
                  <a
                    className="button"
                    data-action-id="QUOTE-WHATSAPP"
                    href={`https://wa.me/${portalShare.whatsappPhone}?text=${encodeURIComponent(`Analiza en Casa: consulte el estado de su trámite mediante este enlace seguro. Se solicitará un código de verificación: ${portalShare.portalUrl}`)}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Enviar por WhatsApp
                  </a>
                </div>
              </div>
            </div>
          ) : null}
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
