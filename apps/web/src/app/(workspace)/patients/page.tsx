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
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
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
  const { addPatient, patients, updatePatient } = useWorkspace();
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedLinkedDialog, setDismissedLinkedDialog] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [sort, setSort] = useState<'fullName' | 'documentId'>('fullName');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<string | null>(null);
  const form = useForm<PatientForm>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: { fullName: '', documentType: 'DUI', documentId: '', phone: '', insurer: '' },
  });
  const documentType = useWatch({ control: form.control, name: 'documentType' });
  const visiblePatients = useMemo(() => searchPatients(patients.filter((patient) => patient.status === tab), query).sort((a, b) => a[sort].localeCompare(b[sort], 'es', { numeric: true }) * direction), [direction, patients, query, sort, tab]);
  const pages = Math.max(1, Math.ceil(visiblePatients.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageRows = visiblePatients.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const documentInput = form.register('documentId');

  const linkedDialogOpen = searchParams.get('create') === '1' && can('patients:write') && !dismissedLinkedDialog;

  function closeDialog() {
    setIsOpen(false);
    setDismissedLinkedDialog(true);
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
      status: 'ACTIVE',
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
            setDismissedLinkedDialog(false);
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
      <div aria-label="Estados de pacientes" className="tabs" role="tablist">
        <Button aria-selected={tab === 'ACTIVE'} data-action-id="PATIENT-TAB-ACTIVE" className={tab === 'ACTIVE' ? 'tab active' : 'tab'} onClick={() => { setTab('ACTIVE'); setPage(1); }} role="tab" type="button">Activos ({patients.filter((patient) => patient.status === 'ACTIVE').length})</Button>
        <Button aria-selected={tab === 'INACTIVE'} data-action-id="PATIENT-TAB-INACTIVE" className={tab === 'INACTIVE' ? 'tab active' : 'tab'} onClick={() => { setTab('INACTIVE'); setPage(1); }} role="tab" type="button">Inactivos ({patients.filter((patient) => patient.status === 'INACTIVE').length})</Button>
      </div>
      <Panel>
        <div className="table-heading"><div><label className="search-label" htmlFor="patient-search">Buscar paciente</label><input id="patient-search" data-action-id="PATIENT-SEARCH" onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Nombre, documento, teléfono o aseguradora" type="search" value={query} /></div>{query ? <Button className="button-secondary" data-action-id="PATIENT-SEARCH-CLEAR" onClick={() => { setQuery(''); setPage(1); }} type="button">Limpiar búsqueda</Button> : null}</div>
      </Panel>
      <Panel>
        <div className="table-heading">
          <h2>Resultados</h2>
          <div><StatusTag>{visiblePatients.length} visibles</StatusTag><label> Mostrar <select data-action-id="PATIENT-PAGE-SIZE" onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} value={pageSize}><option value="5">5</option><option value="10">10</option><option value="25">25</option></select></label></div>
        </div>
        {visiblePatients.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th aria-sort={sort === 'fullName' ? (direction === 1 ? 'ascending' : 'descending') : 'none'}><Button aria-label="Ordenar por paciente" data-action-id="PATIENT-SORT-NAME" onClick={() => { setDirection(sort === 'fullName' ? (direction * -1) as 1 | -1 : 1); setSort('fullName'); setPage(1); }} type="button">Paciente {sort === 'fullName' ? (direction === 1 ? '↑' : '↓') : '↕'}</Button></th>
                  <th aria-sort={sort === 'documentId' ? (direction === 1 ? 'ascending' : 'descending') : 'none'}><Button aria-label="Ordenar por documento" data-action-id="PATIENT-SORT-DOCUMENT" onClick={() => { setDirection(sort === 'documentId' ? (direction * -1) as 1 | -1 : 1); setSort('documentId'); setPage(1); }} type="button">Documento {sort === 'documentId' ? (direction === 1 ? '↑' : '↓') : '↕'}</Button></th>
                  <th>Aseguradora</th>
                  <th>Contacto demo</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((patient) => (
                  <tr key={patient.id}>
                    <td>
                      <Link data-action-id="PATIENT-DETAIL-NAVIGATE" href={`/patients/${patient.id}`}>
                        {patient.fullName}
                      </Link>
                    </td>
                    <td>
                      {patient.documentType}: {patient.documentId}
                    </td>
                    <td>{patient.insurer ?? 'Sin dato'}</td>
                    <td>{patient.phone ?? 'Sin dato'}</td>
                    <td>{can('patients:write') ? <Button data-action-id={patient.status === 'ACTIVE' ? 'PATIENT-INACTIVATE' : 'PATIENT-REACTIVATE'} onClick={() => updatePatient({ ...patient, status: patient.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })} type="button">{patient.status === 'ACTIVE' ? 'Inactivar' : 'Reactivar'}</Button> : 'Solo lectura'}</td>
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
      <nav className="pagination" aria-label="Paginación de pacientes"><Button data-action-id="PATIENT-PAGE-PREVIOUS" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} type="button">Anterior</Button>{Array.from({ length: pages }, (_, index) => <Button aria-current={currentPage === index + 1 ? 'page' : undefined} className={currentPage === index + 1 ? 'active' : undefined} data-action-id="PATIENT-PAGINATE" key={index} onClick={() => setPage(index + 1)} type="button">{index + 1}</Button>)}<Button data-action-id="PATIENT-PAGE-NEXT" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)} type="button">Siguiente</Button></nav>
      <Dialog
        description="Los datos ingresados se mantienen en memoria de este demo y se validan antes de registrar."
        footer={
          <>
            <Button className="button-secondary" data-action-id="PATIENT-CREATE-CANCEL" onClick={closeDialog} type="button">
              Cancelar
            </Button>
            <Button data-action-id="PATIENT-CREATE-SUBMIT" form="patient-form" type="submit">
              Guardar registro
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isOpen || linkedDialogOpen}
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
