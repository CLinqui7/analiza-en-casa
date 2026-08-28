'use client';

import { Button, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useRole, useWorkspace } from '@/components/providers';

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { patients, quotes, sendQuote } = useWorkspace();
  const role = useRole();
  const [message, setMessage] = useState<string | null>(null);
  const quote = quotes.find((candidate) => candidate.id === id);
  if (!quote) return <main className="access-denied" role="alert">La cotización no existe o no está disponible.</main>;
  const currentQuote = quote;
  const canSend = role === 'ADMIN' || role === 'FINANCE';
  function send() { sendQuote(currentQuote.id); setMessage('La versión se marcó como enviada mediante enlace seguro y quedó inmutable.'); }
  return <div className="page-stack"><header className="page-header page-header-actions"><div><p className="eyebrow">Facturación</p><h1>{quote.id}</h1><p>Versión v{quote.version} · {quote.status === 'SENT' ? 'Enviada e inmutable' : 'Borrador editable pendiente de reglas aprobadas'}</p></div>{quote.status === 'DRAFT' && canSend ? <Button data-action-id="QUOTE-SEND" onClick={send} type="button">Enviar enlace seguro</Button> : <StatusTag tone={quote.status === 'SENT' ? 'success' : 'warning'}>{quote.status === 'SENT' ? 'Versión inmutable' : 'Permiso financiero requerido'}</StatusTag>}</header>{message ? <p className="notice success" role="status">{message}</p> : null}<Panel><h2>Resumen operativo</h2><p>{quote.summary}</p><dl className="definition-list"><div><dt>Paciente</dt><dd>{patients.find((patient) => patient.id === quote.patientId)?.fullName ?? 'No disponible'}</dd></div><div><dt>Hospitalización</dt><dd>{quote.caseId}</dd></div><div><dt>Creada</dt><dd>{new Date(quote.createdAt).toLocaleString('es-SV')}</dd></div><div><dt>Envío</dt><dd>{quote.sentAt ? new Date(quote.sentAt).toLocaleString('es-SV') : 'No enviada'}</dd></div></dl><p>Este módulo no muestra precios, cobertura, impuestos ni contenido clínico en notificaciones.</p></Panel><Link className="text-link" data-action-id="QUOTE-BACK-TO-LIST" href="/quotes">Volver a cotizaciones</Link></div>;
}
