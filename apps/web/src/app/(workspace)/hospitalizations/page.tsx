'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Hospitalization } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';

const hospitalizationSchema = z.object({
  patientId: z.string().min(1, 'Seleccione un paciente.'),
  startDate: z.string().min(1, 'Indique la fecha de inicio.'),
  accountType: z.string().trim().min(1, 'Indique el tipo de cuenta como referencia operativa.'),
  nextAction: z.string().trim(),
});
type HospitalizationForm = z.infer<typeof hospitalizationSchema>;

export default function HospitalizationsPage() {
  const { addHospitalization, hospitalizations, patients } = useWorkspace();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<HospitalizationForm>({ resolver: zodResolver(hospitalizationSchema), defaultValues: { patientId: patients[0]?.id ?? '', startDate: '2026-08-28', accountType: 'Referencia sintética', nextAction: '' } });
  function close() { setOpen(false); form.reset(); }
  function submit(values: HospitalizationForm) {
    const hospitalization: Hospitalization = { id: crypto.randomUUID(), ...values, status: 'ACTIVE', nextAction: values.nextAction || undefined };
    addHospitalization(hospitalization); setMessage('Hospitalización sintética persistida con evidencia de auditoría.'); close();
  }
  return <div className="page-stack"><header className="page-header page-header-actions"><div><p className="eyebrow">Operaciones</p><h1>Hospitalizaciones</h1><p>Registros sintéticos de coordinación; no infiere reglas clínicas, financieras ni de cobertura.</p></div>{can('cases:write') ? <Button data-action-id="HOSPITALIZATION-CREATE" onClick={() => { setMessage(null); setOpen(true); }} type="button">Nueva hospitalización</Button> : null}</header>{message ? <p className="notice success" role="status">{message}</p> : null}<Panel><div className="table-heading"><h2>Registros</h2><StatusTag>{hospitalizations.length} hospitalizaciones</StatusTag></div>{hospitalizations.length ? <div className="table-wrap"><table><thead><tr><th>Identificador</th><th>Paciente</th><th>Inicio</th><th>Tipo de cuenta</th><th>Estado</th><th>Siguiente acción</th></tr></thead><tbody>{hospitalizations.map((item) => <tr key={item.id}><td>{item.id}</td><td>{patients.find((patient) => patient.id === item.patientId)?.fullName ?? 'No disponible'}</td><td>{item.startDate}</td><td>{item.accountType}</td><td>{item.status === 'ACTIVE' ? 'Activo' : 'Cerrado'}</td><td>{item.nextAction ?? 'Sin acción documentada'}</td></tr>)}</tbody></table></div> : <EmptyState detail="Cree una hospitalización para iniciar la coordinación." title="Sin hospitalizaciones" />}</Panel><Dialog description="Este formulario sólo registra coordinación sintética. Las reglas de estados y cobertura no se infieren." footer={<><Button className="button-secondary" onClick={close} type="button">Cancelar</Button><Button form="hospitalization-form" type="submit">Guardar hospitalización</Button></>} onClose={close} open={open} title="Nueva hospitalización"><form className="form-grid" id="hospitalization-form" noValidate onSubmit={form.handleSubmit(submit)}><label>Paciente<select {...form.register('patientId')}>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}</select>{form.formState.errors.patientId ? <span className="field-error">{form.formState.errors.patientId.message}</span> : null}</label><label>Fecha de inicio<input {...form.register('startDate')} type="date" />{form.formState.errors.startDate ? <span className="field-error">{form.formState.errors.startDate.message}</span> : null}</label><label>Tipo de cuenta<input {...form.register('accountType')} />{form.formState.errors.accountType ? <span className="field-error">{form.formState.errors.accountType.message}</span> : null}</label><label>Siguiente acción (opcional)<input {...form.register('nextAction')} /></label></form></Dialog></div>;
}
