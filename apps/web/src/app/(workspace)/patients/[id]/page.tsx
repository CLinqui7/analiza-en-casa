'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { patientDocumentTypeSchema, type Patient } from '@analiza/contracts';
import { documentRules, findDuplicatePatient, maskDui, validateDocument } from '@analiza/domain';
import { Button, Dialog, Panel } from '@analiza/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';

const patientFormSchema = z.object({
  fullName: z.string().trim().min(1, 'Ingrese el nombre para el registro sintético.'),
  documentType: patientDocumentTypeSchema,
  documentId: z.string().trim().min(1, 'El número de documento es obligatorio.'),
  phone: z.string().trim(),
  insurer: z.string().trim(),
});
type PatientForm = z.infer<typeof patientFormSchema>;

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = useAuth();
  const { loading, patients, updatePatient } = useWorkspace();
  const patient = patients.find((candidate) => candidate.id === params.id);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<PatientForm>({ resolver: zodResolver(patientFormSchema) });
  const documentType = useWatch({ control: form.control, name: 'documentType' });
  useEffect(() => {
    if (patient) form.reset({ fullName: patient.fullName, documentType: patient.documentType, documentId: patient.documentId, phone: patient.phone ?? '', insurer: patient.insurer ?? '' });
  }, [form, patient]);
  if (loading) return <main className="access-denied" role="status">Cargando paciente…</main>;
  if (!patient) return <main className="access-denied" role="alert">El paciente no existe o no está disponible.</main>;
  const currentPatient: Patient = patient;
  function close() { setOpen(false); form.reset(); }
  function submit(values: PatientForm) {
    const documentError = validateDocument(values.documentType, values.documentId);
    if (documentError) { form.setError('documentId', { type: 'validate', message: documentError }); return; }
    const duplicate = findDuplicatePatient(patients.filter((candidate) => candidate.id !== currentPatient.id), values);
    if (duplicate) { form.setError('documentId', { type: 'duplicate', message: `Ya existe un registro con este documento (${duplicate.fullName}).` }); return; }
    const next: Patient = { ...currentPatient, ...values, phone: values.phone || undefined, insurer: values.insurer || undefined };
    updatePatient(next); setMessage(`Paciente ${next.fullName} actualizado y persistido.`); close();
  }
  return <div className="page-stack"><header className="page-header page-header-actions"><div><p className="eyebrow">Registro</p><h1>{patient.fullName}</h1><p>Detalle sintético del paciente, restringido por sesión y auditado al actualizar.</p></div>{can('patients:write') ? <Button data-action-id="PATIENT-EDIT" onClick={() => { setMessage(null); setOpen(true); }} type="button">Editar paciente</Button> : null}</header>{message ? <p className="notice success" role="status">{message}</p> : null}<section className="two-column"><Panel><h2>Identificación</h2><dl className="definition-list"><div><dt>Nombre</dt><dd>{patient.fullName}</dd></div><div><dt>Documento</dt><dd>{patient.documentType}: {patient.documentId}</dd></div></dl></Panel><Panel><h2>Contacto y referencia</h2><dl className="definition-list"><div><dt>Teléfono</dt><dd>{patient.phone ?? 'Sin dato'}</dd></div><div><dt>Aseguradora</dt><dd>{patient.insurer ?? 'Sin dato'}</dd></div></dl></Panel></section><Link className="text-link" data-action-id="PATIENT-BACK-TO-LIST" href="/patients">Volver a pacientes</Link><Dialog description="La actualización persiste en el proveedor configurado y añade evidencia de auditoría." footer={<><Button className="button-secondary" data-action-id="PATIENT-EDIT-CANCEL" onClick={close} type="button">Cancelar</Button><Button data-action-id="PATIENT-EDIT-SUBMIT" form="patient-edit-form" type="submit">Guardar cambios</Button></>} onClose={close} open={open} title="Editar paciente"><form className="form-grid" id="patient-edit-form" noValidate onSubmit={form.handleSubmit(submit)}><label>Nombre completo<input {...form.register('fullName')} />{form.formState.errors.fullName ? <span className="field-error">{form.formState.errors.fullName.message}</span> : null}</label><label>Tipo de documento<select {...form.register('documentType')} onChange={(event) => { form.setValue('documentType', event.target.value as PatientForm['documentType']); form.setValue('documentId', ''); form.clearErrors('documentId'); }}><option value="DUI">DUI</option><option value="PASSPORT">Pasaporte</option><option value="OTHER">Otro documento</option></select></label><label>Número de documento<input {...form.register('documentId')} inputMode={documentType === 'DUI' ? 'numeric' : undefined} onChange={(event) => { const value = documentType === 'DUI' ? maskDui(event.target.value) : event.target.value; form.setValue('documentId', value, { shouldDirty: true }); form.clearErrors('documentId'); }} placeholder={documentRules[documentType ?? 'DUI'].mask ?? 'Identificador'} />{form.formState.errors.documentId ? <span className="field-error">{form.formState.errors.documentId.message}</span> : null}</label><label>Teléfono de demo<input {...form.register('phone')} /></label><label>Aseguradora<input {...form.register('insurer')} /></label></form></Dialog></div>;
}
