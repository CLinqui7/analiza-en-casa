'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { patientDocumentTypeSchema, type Patient } from '@analiza/contracts';
import {
  documentRules,
  findDuplicatePatient,
  maskDui,
  searchPatients,
  validateDocument,
} from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
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

export default function PatientsPage() {
  const { addPatient, patients } = useWorkspace();
  const { can } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const form = useForm<PatientForm>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: { fullName: '', documentType: 'DUI', documentId: '', phone: '', insurer: '' },
  });
  const documentType = useWatch({ control: form.control, name: 'documentType' });
  const visiblePatients = searchPatients(patients, query);
  const documentInput = form.register('documentId');

  function closeDialog() {
    setIsOpen(false);
    form.reset();
  }

  function onSubmit(values: PatientForm) {
    const documentError = validateDocument(values.documentType, values.documentId);
    if (documentError) {
      form.setError('documentId', { type: 'validate', message: documentError });
      return;
    }
    const duplicate = findDuplicatePatient(patients, values);
    if (duplicate) {
      form.setError('documentId', {
        type: 'duplicate',
        message: `Ya existe un registro con este documento (${duplicate.fullName}).`,
      });
      return;
    }
    const patient: Patient = {
      id: crypto.randomUUID(),
      fullName: values.fullName,
      documentType: values.documentType,
      documentId: values.documentId,
      phone: values.phone || undefined,
      insurer: values.insurer || undefined,
    };
    addPatient(patient);
    setResult(`Registro sintético agregado para ${patient.fullName}.`);
    closeDialog();
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Registro</p>
          <h1>Pacientes</h1>
          <p>La búsqueda normaliza mayúsculas, acentos y espacios en todos los resultados.</p>
        </div>
        {can('patients:write') ? <Button
          data-action-id="PATIENT-CREATE"
          onClick={() => {
            setResult(null);
            setIsOpen(true);
          }}
          type="button"
        >
          Agregar paciente
        </Button> : null}
      </header>
      {result ? (
        <p className="notice success" role="status">
          {result}
        </p>
      ) : null}
      <Panel>
        <label className="search-label" htmlFor="patient-search">
          Buscar paciente
        </label>
        <input
          id="patient-search"
          data-action-id="PATIENT-SEARCH"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre, documento, teléfono o aseguradora"
          type="search"
          value={query}
        />
      </Panel>
      <Panel>
        <div className="table-heading">
          <h2>Resultados</h2>
          <StatusTag>{visiblePatients.length} visibles</StatusTag>
        </div>
        {visiblePatients.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Documento</th>
                  <th>Aseguradora</th>
                  <th>Contacto demo</th>
                </tr>
              </thead>
              <tbody>
                {visiblePatients.map((patient) => (
                  <tr key={patient.id}>
                    <td>{patient.fullName}</td>
                    <td>
                      {patient.documentType}: {patient.documentId}
                    </td>
                    <td>{patient.insurer ?? 'Sin dato'}</td>
                    <td>{patient.phone ?? 'Sin dato'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            detail="Cambie el criterio o agregue un registro sintético."
            title="Sin resultados"
          />
        )}
      </Panel>
      <Dialog
        description="Los datos ingresados se mantienen en memoria de este demo y se validan antes de registrar."
        footer={
          <>
            <Button className="button-secondary" onClick={closeDialog} type="button">
              Cancelar
            </Button>
            <Button form="patient-form" type="submit">
              Guardar registro
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isOpen}
        title="Agregar paciente"
      >
        <form
          className="form-grid"
          id="patient-form"
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <label>
            Nombre completo
            <input {...form.register('fullName')} autoComplete="off" />
            {form.formState.errors.fullName ? (
              <span className="field-error" role="alert">
                {form.formState.errors.fullName.message}
              </span>
            ) : null}
          </label>
          <label>
            Tipo de documento
            <select
              {...form.register('documentType')}
              onChange={(event) => {
                form.setValue('documentType', event.target.value as PatientForm['documentType']);
                form.setValue('documentId', '');
                form.clearErrors('documentId');
              }}
            >
              <option value="DUI">DUI</option>
              <option value="PASSPORT">Pasaporte</option>
              <option value="OTHER">Otro documento</option>
            </select>
          </label>
          <label>
            Número de documento
            <input
              {...documentInput}
              aria-describedby="document-help"
              inputMode={documentType === 'DUI' ? 'numeric' : undefined}
              onChange={(event) => {
                const value =
                  documentType === 'DUI' ? maskDui(event.target.value) : event.target.value;
                form.setValue('documentId', value, { shouldDirty: true });
                form.clearErrors('documentId');
              }}
              placeholder={documentRules[documentType].mask ?? 'Identificador'}
            />
            <span className="field-help" id="document-help">
              {documentRules[documentType].help}
            </span>
            {form.formState.errors.documentId ? (
              <span className="field-error" role="alert">
                {form.formState.errors.documentId.message}
              </span>
            ) : null}
          </label>
          <label>
            Teléfono de demo
            <input {...form.register('phone')} autoComplete="off" />
          </label>
          <label>
            Aseguradora
            <input {...form.register('insurer')} autoComplete="off" />
          </label>
        </form>
      </Dialog>
    </div>
  );
}
