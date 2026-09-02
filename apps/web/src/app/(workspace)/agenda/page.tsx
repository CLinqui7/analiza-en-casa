'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';
import { buildShiftSeries, endForPreset, type ShiftPreset } from '@/lib/agenda-series';

const shiftSchema = z.object({
  resourceId: z.string().min(1, 'Seleccione un recurso.'), patientId: z.string().optional(),
  startTime: z.string().min(1, 'Indique el inicio.'), endTime: z.string().min(1, 'Indique el fin.'),
  status: z.enum(['SCHEDULED', 'CANCELLED', 'COMPLETED']), note: z.string().trim(),
});
type ShiftForm = z.infer<typeof shiftSchema>;
const statusLabel = { SCHEDULED: 'Programado', CANCELLED: 'Cancelado', COMPLETED: 'Completado' };
const initialDate = '2026-08-29';

export default function AgendaPage() {
  const { addShift, nursingResources, patients, shifts } = useWorkspace();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dates, setDates] = useState<string[]>([initialDate]);
  const [endDayOffset, setEndDayOffset] = useState<0 | 1>(0);
  const form = useForm<ShiftForm>({ resolver: zodResolver(shiftSchema), defaultValues: { resourceId: nursingResources[0]?.id ?? '', patientId: patients[0]?.id, startTime: '08:00', endTime: '12:00', status: 'SCHEDULED', note: '' } });
  function close() { setOpen(false); setDates([initialDate]); setEndDayOffset(0); form.reset(); }
  function choosePreset(preset: ShiftPreset) { const date = dates.find(Boolean) ?? initialDate; const end = endForPreset(date, form.getValues('startTime'), preset); form.setValue('endTime', end.endTime); setEndDayOffset(end.endDayOffset); }
  function submit(values: ShiftForm) {
    try {
      const series = buildShiftSeries({ ...values, dates, endDayOffset, existing: shifts, idFor: () => crypto.randomUUID() });
      series.forEach(addShift);
      setMessage(`${series.length} turno${series.length === 1 ? '' : 's'} persistido${series.length === 1 ? '' : 's'} para las fechas seleccionadas.`);
      close();
    } catch (error) { form.setError('startTime', { message: error instanceof Error ? error.message : 'No fue posible crear la serie.' }); }
  }
  return <div className="page-stack">
    <header className="page-header page-header-actions"><div><p className="eyebrow">Operaciones</p><h1>Agenda y turnos</h1><p>Turnos sintéticos auditables; las horas se derivan de su intervalo programado.</p></div>{can('agenda:write') ? <Button data-action-id="AGENDA-SHIFT-CREATE" onClick={() => { setMessage(null); setOpen(true); }} type="button">Nuevo turno</Button> : null}</header>
    {message ? <p className="notice success" role="status">{message}</p> : null}
    <Panel><div className="table-heading"><h2>Turnos</h2><StatusTag>{shifts.length} registros</StatusTag></div>{shifts.length ? <div className="table-wrap"><table><thead><tr><th>Inicio</th><th>Fin</th><th>Enfermera</th><th>Paciente</th><th>Estado</th><th>Notas</th></tr></thead><tbody>{shifts.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((shift) => <tr key={shift.id}><td>{new Date(shift.startsAt).toLocaleString('es-SV')}</td><td>{new Date(shift.endsAt).toLocaleString('es-SV')}</td><td>{nursingResources.find((resource) => resource.id === shift.resourceId)?.displayName ?? 'No disponible'}</td><td>{patients.find((patient) => patient.id === shift.patientId)?.fullName ?? 'Sin asignar'}</td><td>{statusLabel[shift.status]}</td><td>{shift.note ?? '—'}</td></tr>)}</tbody></table></div> : <EmptyState detail="Cree un turno para iniciar la agenda." title="Sin turnos" />}</Panel>
    <Dialog description="Puede crear una serie de días sin duplicados ni colisiones del mismo recurso. Puntual sigue pendiente de definición del cliente." footer={<><Button className="button-secondary" onClick={close} type="button">Cancelar</Button><Button data-action-id="AGENDA-SHIFT-SAVE" form="shift-form" type="submit">Guardar turnos</Button></>} onClose={close} open={open} title="Nuevo turno"><form className="form-grid" id="shift-form" noValidate onSubmit={form.handleSubmit(submit)}>
      <label>Enfermera<select {...form.register('resourceId')}>{nursingResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.displayName}</option>)}</select></label><label>Paciente (opcional)<select {...form.register('patientId')}><option value="">Sin asignar</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}</select></label>
      <div className="full"><div className="table-heading"><div><h3>Fechas para agendar</h3><p className="field-help">Cada fecha crea un turno independiente con el mismo intervalo.</p></div><Button className="button-secondary" data-action-id="AGENDA-SHIFT-DATE-ADD" onClick={() => setDates((current) => [...current, ''])} type="button">Agregar fecha</Button></div>{dates.map((date, index) => <div className="action-row" key={`${index}-${date}`}><label>Fecha {index + 1}<input data-action-id="AGENDA-SHIFT-DATE" onChange={(event) => setDates((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} type="date" value={date} /></label>{dates.length > 1 ? <Button aria-label={`Quitar fecha ${index + 1}`} className="button-secondary" data-action-id="AGENDA-SHIFT-DATE-REMOVE" onClick={() => setDates((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button">Quitar fecha</Button> : null}</div>)}</div>
      <label>Inicio<input {...form.register('startTime', { onChange: () => setEndDayOffset(0) })} type="time" />{form.formState.errors.startTime ? <span className="field-error" role="alert">{form.formState.errors.startTime.message}</span> : null}</label><label>Fin<input {...form.register('endTime', { onChange: () => setEndDayOffset(0) })} type="time" />{endDayOffset ? <span className="field-help">Finaliza el día siguiente.</span> : null}</label>
      <div className="full action-row"><Button className="button-secondary" data-action-id="AGENDA-SHIFT-PRESET-6H" onClick={() => choosePreset('SIX_HOURS')} type="button">Turno 6 horas</Button><Button className="button-secondary" data-action-id="AGENDA-SHIFT-PRESET-8H" onClick={() => choosePreset('EIGHT_HOURS')} type="button">Turno 8 horas</Button><Button data-action-id="AGENDA-SHIFT-PRESET-PUNTUAL" disabled title="Requiere definición del cliente" type="button">Puntual (pendiente de definición)</Button></div>
      <label>Estado<select {...form.register('status')}><option value="SCHEDULED">Programado</option><option value="CANCELLED">Cancelado</option><option value="COMPLETED">Completado</option></select></label><label>Notas<input {...form.register('note')} /></label>
    </form></Dialog>
  </div>;
}
