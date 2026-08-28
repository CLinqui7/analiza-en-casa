'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Shift } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';

const shiftSchema = z.object({
  resourceId: z.string().min(1, 'Seleccione un recurso.'),
  patientId: z.string().optional(),
  startsAt: z.string().min(1, 'Indique el inicio.'),
  endsAt: z.string().min(1, 'Indique el fin.'),
  status: z.enum(['SCHEDULED', 'CANCELLED', 'COMPLETED']),
  note: z.string().trim(),
}).superRefine((value, context) => {
  if (new Date(value.endsAt) <= new Date(value.startsAt)) context.addIssue({ code: 'custom', message: 'El fin debe ser posterior al inicio.', path: ['endsAt'] });
});
type ShiftForm = z.infer<typeof shiftSchema>;

const statusLabel = { SCHEDULED: 'Programado', CANCELLED: 'Cancelado', COMPLETED: 'Completado' };

export default function AgendaPage() {
  const { addShift, nursingResources, patients, shifts } = useWorkspace();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<ShiftForm>({ resolver: zodResolver(shiftSchema), defaultValues: { resourceId: nursingResources[0]?.id ?? '', patientId: patients[0]?.id, startsAt: '2026-08-29T08:00', endsAt: '2026-08-29T12:00', status: 'SCHEDULED', note: '' } });
  function close() { setOpen(false); form.reset(); }
  function submit(values: ShiftForm) {
    const shift: Shift = { id: crypto.randomUUID(), ...values, patientId: values.patientId || undefined, startsAt: new Date(values.startsAt).toISOString(), endsAt: new Date(values.endsAt).toISOString(), note: values.note || undefined };
    addShift(shift); setMessage('Turno persistido. El reporte deriva horas programadas desde esta agenda.'); close();
  }
  return <div className="page-stack"><header className="page-header page-header-actions"><div><p className="eyebrow">Operaciones</p><h1>Agenda y turnos</h1><p>Turnos sintéticos auditables; las horas se derivan de su intervalo programado.</p></div>{can('agenda:write') ? <Button data-action-id="AGENDA-SHIFT-CREATE" onClick={() => { setMessage(null); setOpen(true); }} type="button">Nuevo turno</Button> : null}</header>{message ? <p className="notice success" role="status">{message}</p> : null}<Panel><div className="table-heading"><h2>Turnos</h2><StatusTag>{shifts.length} registros</StatusTag></div>{shifts.length ? <div className="table-wrap"><table><thead><tr><th>Inicio</th><th>Fin</th><th>Enfermera</th><th>Paciente</th><th>Estado</th><th>Notas</th></tr></thead><tbody>{shifts.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((shift) => <tr key={shift.id}><td>{new Date(shift.startsAt).toLocaleString('es-SV')}</td><td>{new Date(shift.endsAt).toLocaleString('es-SV')}</td><td>{nursingResources.find((resource) => resource.id === shift.resourceId)?.displayName ?? 'No disponible'}</td><td>{patients.find((patient) => patient.id === shift.patientId)?.fullName ?? 'Sin asignar'}</td><td>{statusLabel[shift.status]}</td><td>{shift.note ?? '—'}</td></tr>)}</tbody></table></div> : <EmptyState detail="Cree un turno para iniciar la agenda." title="Sin turnos" />}</Panel><Dialog description="No se registra check-in/out en este alcance; el reporte mostrará horas programadas, no trabajadas." footer={<><Button className="button-secondary" onClick={close} type="button">Cancelar</Button><Button form="shift-form" type="submit">Guardar turno</Button></>} onClose={close} open={open} title="Nuevo turno"><form className="form-grid" id="shift-form" noValidate onSubmit={form.handleSubmit(submit)}><label>Enfermera<select {...form.register('resourceId')}>{nursingResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.displayName}</option>)}</select></label><label>Paciente (opcional)<select {...form.register('patientId')}><option value="">Sin asignar</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}</select></label><label>Inicio<input {...form.register('startsAt')} type="datetime-local" />{form.formState.errors.startsAt ? <span className="field-error">{form.formState.errors.startsAt.message}</span> : null}</label><label>Fin<input {...form.register('endsAt')} type="datetime-local" />{form.formState.errors.endsAt ? <span className="field-error">{form.formState.errors.endsAt.message}</span> : null}</label><label>Estado<select {...form.register('status')}><option value="SCHEDULED">Programado</option><option value="CANCELLED">Cancelado</option><option value="COMPLETED">Completado</option></select></label><label>Notas<input {...form.register('note')} /></label></form></Dialog></div>;
}
