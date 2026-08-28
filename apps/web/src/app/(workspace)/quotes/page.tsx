'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Quote } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';

const quoteFormSchema = z.object({ caseId: z.string().min(1, 'Seleccione una hospitalización.'), summary: z.string().trim().min(1, 'Describa el alcance operativo sin precios ni información clínica sensible.') });
type QuoteForm = z.infer<typeof quoteFormSchema>;

export default function QuotesPage() {
  const { addQuote, hospitalizations, patients, quotes } = useWorkspace();
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [dismissedLinkedDialog, setDismissedLinkedDialog] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<QuoteForm>({ resolver: zodResolver(quoteFormSchema), defaultValues: { caseId: hospitalizations[0]?.id ?? '', summary: '' } });
  const linkedDialogOpen = searchParams.get('create') === '1' && can('quotes:write') && !dismissedLinkedDialog;
  function close() { setOpen(false); setDismissedLinkedDialog(true); form.reset(); }
  function submit(values: QuoteForm) {
    const record = hospitalizations.find((item) => item.id === values.caseId);
    if (!record) { form.setError('caseId', { type: 'validate', message: 'La hospitalización no está disponible.' }); return; }
    const quote: Quote = { id: crypto.randomUUID(), caseId: record.id, patientId: record.patientId, version: 1, status: 'DRAFT', summary: values.summary, createdAt: new Date().toISOString() };
    addQuote(quote); setMessage('Borrador de cotización persistido. No se calculan importes sin reglas aprobadas.'); close();
  }
  return <div className="page-stack"><header className="page-header page-header-actions"><div><p className="eyebrow">Facturación</p><h1>Cotizaciones</h1><p>Versiones sintéticas con control de inmutabilidad. No se inventan precios, cobertura, impuestos ni canales de mensajería.</p></div>{can('quotes:write') ? <Button data-action-id="QUOTE-CREATE" onClick={() => { setMessage(null); setDismissedLinkedDialog(false); setOpen(true); }} type="button">Nueva cotización</Button> : null}</header>{message ? <p className="notice success" role="status">{message}</p> : null}<Panel><div className="table-heading"><h2>Versiones</h2><StatusTag>{quotes.length} registros</StatusTag></div>{quotes.length ? <div className="table-wrap"><table><thead><tr><th>Identificador</th><th>Paciente</th><th>Hospitalización</th><th>Versión</th><th>Estado</th><th>Creación</th></tr></thead><tbody>{quotes.map((quote) => <tr key={quote.id}><td><Link data-action-id="QUOTE-DETAIL-NAVIGATE" href={`/quotes/${quote.id}`}>{quote.id}</Link></td><td>{patients.find((patient) => patient.id === quote.patientId)?.fullName ?? 'No disponible'}</td><td>{quote.caseId}</td><td>v{quote.version}</td><td>{quote.status === 'SENT' ? 'Enviada (inmutable)' : 'Borrador'}</td><td>{new Date(quote.createdAt).toLocaleString('es-SV')}</td></tr>)}</tbody></table></div> : <EmptyState detail="Cree una cotización para comenzar." title="Sin cotizaciones" />}</Panel><Dialog description="La cotización se inicia como borrador. Los importes y reglas financieras requieren configuración aprobada." footer={<><Button className="button-secondary" onClick={close} type="button">Cancelar</Button><Button form="quote-form" type="submit">Guardar borrador</Button></>} onClose={close} open={open || linkedDialogOpen} title="Nueva cotización"><form className="form-grid" id="quote-form" noValidate onSubmit={form.handleSubmit(submit)}><label>Hospitalización<select {...form.register('caseId')}>{hospitalizations.map((item) => <option key={item.id} value={item.id}>{item.id} · {patients.find((patient) => patient.id === item.patientId)?.fullName ?? 'Paciente no disponible'}</option>)}</select>{form.formState.errors.caseId ? <span className="field-error">{form.formState.errors.caseId.message}</span> : null}</label><label>Resumen operativo<textarea {...form.register('summary')} rows={4} />{form.formState.errors.summary ? <span className="field-error">{form.formState.errors.summary.message}</span> : null}</label></form></Dialog></div>;
}
