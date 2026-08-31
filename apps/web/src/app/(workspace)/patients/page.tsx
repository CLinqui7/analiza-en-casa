'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { patientDocumentTypeSchema, type Patient } from '@analiza/contracts';
import { documentRules, findDuplicatePatient, maskDui, searchPatients, toCsv, validateDocument } from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';

const optionalEmailSchema = z.string().trim().refine(
  (value) => !value || z.string().email().safeParse(value).success,
  'Ingrese un correo electrónico válido.',
);

const contactFormSchema = z.object({
  id: z.string(), fullName: z.string().trim(), phone: z.string().trim(), email: optionalEmailSchema,
  relationship: z.string().trim(), role: z.string().trim(), country: z.string().trim(), isPrimary: z.boolean(),
});

const patientFormSchema = z.object({
  fullName: z.string().trim().min(1, 'Ingrese el nombre para el registro sintético.'),
  documentType: patientDocumentTypeSchema,
  documentId: z.string().trim().min(1, 'El número de documento es obligatorio.'),
  birthDate: z.string().min(1, 'Ingrese la fecha de nacimiento.'),
  sex: z.enum(['M', 'F'], { error: 'Seleccione el sexo.' }),
  phone: z.string().trim().min(1, 'Ingrese el teléfono celular.'),
  company: z.string().trim().min(1, 'Ingrese la empresa.'),
  homePhone: z.string().trim(), email: optionalEmailSchema, retired: z.boolean(),
  bloodType: z.enum(['', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']),
  civilStatus: z.string().trim(), nationality: z.string().trim(), occupation: z.string().trim(), botmakerConsent: z.boolean(),
  insurance: z.object({
    status: z.enum(['REGULAR', 'INSURED']), insurer: z.string().trim(), isPolicyHolder: z.boolean(),
    policyNumber: z.string().trim(), certificateOrUnit: z.string().trim(), holderDocumentId: z.string().trim(),
    holderFullName: z.string().trim(), holderBirthDate: z.string(), effectiveDate: z.string(),
  }),
  contacts: z.array(contactFormSchema),
  address: z.object({
    line: z.string().trim().min(1, 'Ingrese la dirección.'),
    comments: z.string().trim().min(1, 'Ingrese la referencia de la dirección.'),
    coordinates: z.string().trim(), locationUrl: z.string().trim(),
  }),
}).superRefine((values, context) => {
  if (values.insurance.status === 'INSURED') {
    const requiredFields: Array<[keyof typeof values.insurance, string]> = [
      ['insurer', 'Seleccione la aseguradora demo.'], ['policyNumber', 'Ingrese el número de póliza.'],
      ['holderDocumentId', 'Ingrese la identificación del titular.'], ['holderFullName', 'Ingrese el nombre del titular.'],
      ['holderBirthDate', 'Ingrese la fecha de nacimiento del titular.'],
    ];
    requiredFields.forEach(([field, message]) => {
      if (!values.insurance[field]) context.addIssue({ code: 'custom', message, path: ['insurance', field] });
    });
  }
  if (values.contacts.filter((contact) => contact.isPrimary).length > 1) {
    context.addIssue({ code: 'custom', message: 'Solo un contacto puede ser principal.', path: ['contacts'] });
  }
});

type PatientForm = z.infer<typeof patientFormSchema>;

const emptyAddress = { line: '', comments: '', coordinates: '', locationUrl: '' };
const emptyInsurance = { status: 'REGULAR' as const, insurer: '', isPolicyHolder: false, policyNumber: '', certificateOrUnit: '', holderDocumentId: '', holderFullName: '', holderBirthDate: '', effectiveDate: '' };

function createContact(isPrimary: boolean): PatientForm['contacts'][number] {
  return { id: crypto.randomUUID(), fullName: '', phone: '', email: '', relationship: '', role: '', country: '', isPrimary };
}

type ImportPreview = { fileName: string; rows: Patient[]; errors: string[]; totalRows: number };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (character === ',' && !quoted) { row.push(value); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value); if (row.some((cell) => cell.trim())) rows.push(row); row = []; value = '';
    } else value += character;
  }
  row.push(value); if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function previewPatientImport(fileName: string, source: string, existing: readonly Patient[]): ImportPreview {
  const rows = parseCsv(source);
  if (!rows.length) return { fileName, rows: [], errors: ['El archivo está vacío.'], totalRows: 0 };
  const headers = rows[0].map((header) => header.trim());
  const requiredHeaders = ['document', 'firstName', 'lastName'];
  if (requiredHeaders.some((header) => !headers.includes(header))) return { fileName, rows: [], errors: ['Encabezados inválidos. Se requieren document, firstName y lastName.'], totalRows: 0 };
  if (rows.length - 1 > 500) return { fileName, rows: [], errors: ['La carga demo admite hasta 500 filas por archivo.'], totalRows: rows.length - 1 };
  const existingKeys = new Set(existing.map((patient) => `${patient.documentType}:${patient.documentId.replace(/\s/g, '').toUpperCase()}`));
  const batchKeys = new Set<string>();
  const patients: Patient[] = [];
  const errors: string[] = [];
  rows.slice(1).forEach((cells, index) => {
    const record = Object.fromEntries(headers.map((header, cellIndex) => [header, (cells[cellIndex] ?? '').trim()]));
    const rowNumber = index + 2;
    const documentType = record.documentType?.toUpperCase() === 'PASAPORTE' ? 'PASSPORT' : record.documentType?.toUpperCase() || 'DUI';
    if (!['DUI', 'PASSPORT', 'OTHER'].includes(documentType)) { errors.push(`Fila ${rowNumber}: tipo de documento inválido.`); return; }
    const documentId = record.document ?? '';
    const documentError = validateDocument(documentType as Patient['documentType'], documentId);
    if (!record.firstName || !record.lastName || documentError) { errors.push(`Fila ${rowNumber}: documento, firstName y lastName son obligatorios y deben ser válidos.`); return; }
    if (record.email && !z.string().email().safeParse(record.email).success) { errors.push(`Fila ${rowNumber}: correo inválido.`); return; }
    const key = `${documentType}:${documentId.replace(/\s/g, '').toUpperCase()}`;
    if (existingKeys.has(key) || batchKeys.has(key)) { errors.push(`Fila ${rowNumber}: documento duplicado.`); return; }
    batchKeys.add(key);
    patients.push({
      id: crypto.randomUUID(), documentType: documentType as Patient['documentType'], documentId, fullName: `${record.firstName} ${record.lastName}`,
      birthDate: record.birthDate || undefined, sex: record.sex === 'M' || record.sex === 'F' ? record.sex : undefined,
      company: record.company || undefined, phone: record.phone || undefined, email: record.email || undefined,
      status: record.status?.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE', retired: false, contacts: [],
    });
  });
  return { fileName, rows: patients, errors, totalRows: rows.length - 1 };
}

export default function PatientsPage() {
  const { addPatient, addPatients, patients, updatePatient } = useWorkspace();
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedLinkedDialog, setDismissedLinkedDialog] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'ACTIVE' | 'INACTIVE' | 'IMPORT'>('ACTIVE');
  const [sort, setSort] = useState<'fullName' | 'documentId'>('fullName');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<string | null>(null);
  const [addressNotice, setAddressNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const form = useForm<PatientForm>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      fullName: '', documentType: 'DUI', documentId: '', birthDate: '', sex: undefined, phone: '', company: '',
      homePhone: '', email: '', retired: false, bloodType: '', civilStatus: '', nationality: '', occupation: '',
      insurance: emptyInsurance, contacts: [], address: emptyAddress, botmakerConsent: true,
    },
  });
  const { fields: contactFields, append, remove } = useFieldArray({ control: form.control, name: 'contacts', keyName: 'fieldKey' });
  const documentType = useWatch({ control: form.control, name: 'documentType' });
  const insuranceStatus = useWatch({ control: form.control, name: 'insurance.status' });
  const contacts = (useWatch({ control: form.control, name: 'contacts' }) ?? []) as PatientForm['contacts'];
  const visiblePatients = useMemo(() => searchPatients(patients.filter((patient) => patient.status === (tab === 'IMPORT' ? 'ACTIVE' : tab)), query).sort((a, b) => a[sort].localeCompare(b[sort], 'es', { numeric: true }) * direction), [direction, patients, query, sort, tab]);
  const pages = Math.max(1, Math.ceil(visiblePatients.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageRows = visiblePatients.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const documentInput = form.register('documentId');
  const editingPatient = patients.find((patient) => patient.id === searchParams.get('edit'));
  const linkedDialogOpen = searchParams.get('create') === '1' && can('patients:write') && !dismissedLinkedDialog;
  const editDialogOpen = Boolean(editingPatient && can('patients:write') && !dismissedLinkedDialog);

  useEffect(() => {
    if (!editingPatient || !editDialogOpen) return;
    form.reset({
      fullName: editingPatient.fullName, documentType: editingPatient.documentType, documentId: editingPatient.documentId,
      birthDate: editingPatient.birthDate ?? '', sex: editingPatient.sex, phone: editingPatient.phone ?? '', company: editingPatient.company ?? '',
      homePhone: editingPatient.homePhone ?? '', email: editingPatient.email ?? '', retired: editingPatient.retired ?? false,
      bloodType: editingPatient.bloodType ?? '', civilStatus: editingPatient.civilStatus ?? '', nationality: editingPatient.nationality ?? '', occupation: editingPatient.occupation ?? '',
      insurance: editingPatient.insurance?.status === 'INSURED' ? { ...emptyInsurance, ...editingPatient.insurance, status: 'INSURED' } : emptyInsurance,
      contacts: (editingPatient.contacts ?? []).map((contact) => ({ ...createContact(false), ...contact })),
      address: { ...emptyAddress, ...editingPatient.address }, botmakerConsent: editingPatient.notifications?.botmakerConsent ?? true,
    });
  }, [editDialogOpen, editingPatient, form]);

  function closeDialog() {
    setIsOpen(false); setDismissedLinkedDialog(true); setAddressNotice(null); form.reset();
    if (searchParams.has('create') || searchParams.has('edit')) router.replace('/patients');
  }
  function changeDocumentType(nextType: PatientForm['documentType']) {
    form.setValue('documentType', nextType); form.setValue('documentId', ''); form.clearErrors('documentId');
  }
  function setPrimaryContact(targetIndex: number) {
    form.setValue('contacts', contacts.map((contact, index) => ({ ...contact, isPrimary: index === targetIndex })), { shouldDirty: true });
  }
  function clearAddress() {
    form.setValue('address', emptyAddress, { shouldDirty: true }); form.clearErrors('address'); setAddressNotice('Los campos de dirección se limpiaron localmente.');
  }
  function lookupAddress() {
    setAddressNotice('La consulta de ubicación requiere una integración de mapas configurada; el enlace se conservará al guardar.');
  }
  async function selectImportFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') || file.type && file.type !== 'text/csv') {
      setImportPreview({ fileName: file.name, rows: [], errors: ['Seleccione un archivo CSV.'], totalRows: 0 }); return;
    }
    setImportPreview(previewPatientImport(file.name, await file.text(), patients));
  }
  function confirmImport() {
    if (!importPreview?.rows.length || importPreview.errors.length) return;
    addPatients(importPreview.rows); setResult(`${importPreview.rows.length} pacientes sintéticos importados.`); setImportOpen(false); setImportPreview(null); setTab('ACTIVE'); setPage(1);
  }
  function exportPatients() {
    const content = toCsv([['Tipo de documento', 'Documento', 'Nombre completo', 'Teléfono', 'Correo', 'Empresa', 'Estado'], ...visiblePatients.map((patient) => [patient.documentType, patient.documentId, patient.fullName, patient.phone ?? '', patient.email ?? '', patient.company ?? '', patient.status])]);
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    anchor.download = `pacientes-${tab === 'ACTIVE' ? 'activos' : 'inactivos'}.csv`;
    anchor.click(); URL.revokeObjectURL(anchor.href);
  }
  function onSubmit(values: PatientForm) {
    const documentError = validateDocument(values.documentType, values.documentId);
    if (documentError) { form.setError('documentId', { type: 'validate', message: documentError }); return; }
    const duplicate = findDuplicatePatient(patients.filter((patient) => patient.id !== editingPatient?.id), values);
    if (duplicate) { form.setError('documentId', { type: 'duplicate', message: `Ya existe un registro con este documento (${duplicate.fullName}).` }); return; }
    const insurance = values.insurance.status === 'INSURED' ? values.insurance : { status: 'REGULAR' as const };
    const patient: Patient = {
      id: editingPatient?.id ?? crypto.randomUUID(), fullName: values.fullName, documentType: values.documentType, documentId: values.documentId,
      phone: values.phone, insurer: insurance.status === 'INSURED' ? insurance.insurer : undefined,
      birthDate: values.birthDate, sex: values.sex, company: values.company, homePhone: values.homePhone || undefined,
      email: values.email || undefined, retired: values.retired, bloodType: values.bloodType || undefined,
      civilStatus: values.civilStatus || undefined, nationality: values.nationality || undefined, occupation: values.occupation || undefined,
      insurance, contacts: values.contacts, address: values.address, status: editingPatient?.status ?? 'ACTIVE', notifications: { botmakerConsent: values.botmakerConsent },
    };
    if (editingPatient) updatePatient(patient); else addPatient(patient);
    setResult(editingPatient ? `Paciente ${patient.fullName} actualizado y persistido.` : `Registro sintético agregado para ${patient.fullName}.`); closeDialog();
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions"><div><p className="eyebrow">Registro</p><h1>Pacientes</h1><p>La búsqueda normaliza mayúsculas, acentos y espacios en todos los resultados.</p></div><div>{can('patients:write') ? <><Button className="button-secondary" data-action-id="PATIENT-IMPORT" onClick={() => { setImportPreview(null); setImportOpen(true); }} type="button">Importar CSV</Button><Button data-action-id="PATIENT-CREATE" onClick={() => { setResult(null); setDismissedLinkedDialog(false); setIsOpen(true); }} type="button">Agregar paciente</Button></> : null}<Button className="button-secondary" data-action-id="PATIENT-EXPORT" onClick={exportPatients} type="button">Exportar CSV</Button></div></header>
      {result ? <p className="notice success" role="status">{result}</p> : null}
      <div aria-label="Estados de pacientes" className="tabs" role="tablist"><Button aria-selected={tab === 'ACTIVE'} data-action-id="PATIENT-TAB-ACTIVE" className={tab === 'ACTIVE' ? 'tab active' : 'tab'} onClick={() => { setTab('ACTIVE'); setPage(1); }} role="tab" type="button">Activos ({patients.filter((patient) => patient.status === 'ACTIVE').length})</Button><Button aria-selected={tab === 'INACTIVE'} data-action-id="PATIENT-TAB-INACTIVE" className={tab === 'INACTIVE' ? 'tab active' : 'tab'} onClick={() => { setTab('INACTIVE'); setPage(1); }} role="tab" type="button">Inactivos ({patients.filter((patient) => patient.status === 'INACTIVE').length})</Button><Button aria-selected={tab === 'IMPORT'} data-action-id="PATIENT-TAB-IMPORT" className={tab === 'IMPORT' ? 'tab active' : 'tab'} onClick={() => { setTab('IMPORT'); setImportOpen(true); }} role="tab" type="button">Carga masiva</Button></div>
      <Panel><div className="table-heading"><div><label className="search-label" htmlFor="patient-search">Buscar paciente</label><input id="patient-search" data-action-id="PATIENT-SEARCH" onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Nombre, documento, teléfono o aseguradora" type="search" value={query} /></div>{query ? <Button className="button-secondary" data-action-id="PATIENT-SEARCH-CLEAR" onClick={() => { setQuery(''); setPage(1); }} type="button">Limpiar búsqueda</Button> : null}</div></Panel>
      <Panel><div className="table-heading"><h2>Resultados</h2><div><StatusTag>{visiblePatients.length} visibles</StatusTag><label> Mostrar <select data-action-id="PATIENT-PAGE-SIZE" onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} value={pageSize}><option value="5">5</option><option value="10">10</option><option value="25">25</option></select></label></div></div>{visiblePatients.length ? <div className="table-wrap"><table><thead><tr><th aria-sort={sort === 'fullName' ? (direction === 1 ? 'ascending' : 'descending') : 'none'}><Button aria-label="Ordenar por paciente" data-action-id="PATIENT-SORT-NAME" onClick={() => { setDirection(sort === 'fullName' ? (direction * -1) as 1 | -1 : 1); setSort('fullName'); setPage(1); }} type="button">Paciente {sort === 'fullName' ? (direction === 1 ? '↑' : '↓') : '↕'}</Button></th><th aria-sort={sort === 'documentId' ? (direction === 1 ? 'ascending' : 'descending') : 'none'}><Button aria-label="Ordenar por documento" data-action-id="PATIENT-SORT-DOCUMENT" onClick={() => { setDirection(sort === 'documentId' ? (direction * -1) as 1 | -1 : 1); setSort('documentId'); setPage(1); }} type="button">Documento {sort === 'documentId' ? (direction === 1 ? '↑' : '↓') : '↕'}</Button></th><th>Aseguradora</th><th>Contacto demo</th><th>Acción</th></tr></thead><tbody>{pageRows.map((patient) => <tr key={patient.id}><td><Link data-action-id="PATIENT-DETAIL-NAVIGATE" href={`/patients/${patient.id}`}>{patient.fullName}</Link></td><td>{patient.documentType}: {patient.documentId}</td><td>{patient.insurer ?? 'Sin dato'}</td><td>{patient.phone ?? 'Sin dato'}</td><td>{can('patients:write') ? <Button data-action-id={patient.status === 'ACTIVE' ? 'PATIENT-INACTIVATE' : 'PATIENT-REACTIVATE'} onClick={() => updatePatient({ ...patient, status: patient.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })} type="button">{patient.status === 'ACTIVE' ? 'Inactivar' : 'Reactivar'}</Button> : 'Solo lectura'}</td></tr>)}</tbody></table></div> : <EmptyState detail="Cambie el criterio o agregue un registro sintético." title="Sin resultados" />}</Panel>
      <nav className="pagination" aria-label="Paginación de pacientes"><Button data-action-id="PATIENT-PAGE-PREVIOUS" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} type="button">Anterior</Button>{Array.from({ length: pages }, (_, index) => <Button aria-current={currentPage === index + 1 ? 'page' : undefined} className={currentPage === index + 1 ? 'active' : undefined} data-action-id="PATIENT-PAGINATE" key={index} onClick={() => setPage(index + 1)} type="button">{index + 1}</Button>)}<Button data-action-id="PATIENT-PAGE-NEXT" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)} type="button">Siguiente</Button></nav>
      <Dialog description="Los datos administrativos sintéticos se validan y persisten en el proveedor configurado." footer={<><Button className="button-secondary" data-action-id={editingPatient ? "PATIENT-EDIT-CANCEL" : "PATIENT-CREATE-CANCEL"} onClick={closeDialog} type="button">Cancelar</Button><Button data-action-id={editingPatient ? "PATIENT-EDIT-SUBMIT" : "PATIENT-CREATE-SUBMIT"} form="patient-form" type="submit">{editingPatient ? 'Guardar cambios' : 'Guardar registro'}</Button></>} onClose={closeDialog} open={isOpen || linkedDialogOpen || editDialogOpen} title={editingPatient ? 'Editar paciente' : 'Agregar paciente'}>
        <form className="form-grid" id="patient-form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset><legend>Datos generales</legend><label>Tipo de documento<select {...form.register('documentType')} data-action-id="PATIENT-DOCUMENT-TYPE" onChange={(event) => changeDocumentType(event.target.value as PatientForm['documentType'])}><option value="DUI">DUI</option><option value="PASSPORT">Pasaporte</option><option value="OTHER">Otro documento</option></select></label><label>Número de documento<input {...documentInput} aria-describedby="document-help" inputMode={documentType === 'DUI' ? 'numeric' : undefined} onChange={(event) => { const value = documentType === 'DUI' ? maskDui(event.target.value) : event.target.value; form.setValue('documentId', value, { shouldDirty: true }); form.clearErrors('documentId'); }} placeholder={documentRules[documentType].mask ?? 'Identificador'} />{form.formState.errors.documentId ? <span className="field-error" role="alert">{form.formState.errors.documentId.message}</span> : null}</label><span className="field-help" id="document-help">{documentRules[documentType].help}</span><label>Nombre completo<input {...form.register('fullName')} autoComplete="name" />{form.formState.errors.fullName ? <span className="field-error" role="alert">{form.formState.errors.fullName.message}</span> : null}</label><label>Fecha de nacimiento<input {...form.register('birthDate')} type="date" />{form.formState.errors.birthDate ? <span className="field-error" role="alert">{form.formState.errors.birthDate.message}</span> : null}</label><fieldset><legend>Sexo</legend><label><input {...form.register('sex')} type="radio" value="M" /> Masculino</label><label><input {...form.register('sex')} type="radio" value="F" /> Femenino</label>{form.formState.errors.sex ? <span className="field-error" role="alert">{form.formState.errors.sex.message}</span> : null}</fieldset><label>Teléfono celular<input {...form.register('phone')} autoComplete="tel" />{form.formState.errors.phone ? <span className="field-error" role="alert">{form.formState.errors.phone.message}</span> : null}</label><label>Empresa<input {...form.register('company')} />{form.formState.errors.company ? <span className="field-error" role="alert">{form.formState.errors.company.message}</span> : null}</label><label>Teléfono de casa<input {...form.register('homePhone')} /></label><label>Correo<input {...form.register('email')} type="email" autoComplete="email" />{form.formState.errors.email ? <span className="field-error" role="alert">{form.formState.errors.email.message}</span> : null}</label><label><input {...form.register('retired')} type="checkbox" /> Jubilado</label><label>Tipo de sangre<select {...form.register('bloodType')}><option value="">Seleccione</option><option value="O+">O+</option><option value="O-">O-</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option><option value="AB-">AB-</option></select></label><label>Estado civil<input {...form.register('civilStatus')} /></label><label>Nacionalidad<input {...form.register('nationality')} /></label><label>Ocupación<input {...form.register('occupation')} /></label></fieldset>
          <fieldset><legend>Notificaciones</legend><label><input {...form.register('botmakerConsent')} data-action-id="PATIENT-BOTMAKER-CONSENT" type="checkbox" /> Consentimiento para notificaciones Botmaker</label><p className="field-help">Se conserva como preferencia y no envía mensajes ni confirma entrega.</p></fieldset><fieldset><legend>Información de seguro</legend><label>Tipo de paciente<select {...form.register('insurance.status')} data-action-id="PATIENT-INSURANCE-TOGGLE"><option value="REGULAR">Paciente regular</option><option value="INSURED">Paciente asegurado</option></select></label>{insuranceStatus === 'INSURED' ? <div className="form-grid"><label>Aseguradora<select {...form.register('insurance.insurer')}><option value="">Seleccione</option><option value="Aseguradora de demostración">Aseguradora de demostración</option><option value="Cobertura sintética QA">Cobertura sintética QA</option></select>{form.formState.errors.insurance?.insurer ? <span className="field-error" role="alert">{form.formState.errors.insurance.insurer.message}</span> : null}</label><label><input {...form.register('insurance.isPolicyHolder')} type="checkbox" /> El paciente es el titular</label><label>Número de póliza<input {...form.register('insurance.policyNumber')} />{form.formState.errors.insurance?.policyNumber ? <span className="field-error" role="alert">{form.formState.errors.insurance.policyNumber.message}</span> : null}</label><label>Certificado o unidad<input {...form.register('insurance.certificateOrUnit')} /></label><label>Identificación del titular<input {...form.register('insurance.holderDocumentId')} />{form.formState.errors.insurance?.holderDocumentId ? <span className="field-error" role="alert">{form.formState.errors.insurance.holderDocumentId.message}</span> : null}</label><label>Nombre del titular<input {...form.register('insurance.holderFullName')} />{form.formState.errors.insurance?.holderFullName ? <span className="field-error" role="alert">{form.formState.errors.insurance.holderFullName.message}</span> : null}</label><label>Fecha de nacimiento del titular<input {...form.register('insurance.holderBirthDate')} type="date" />{form.formState.errors.insurance?.holderBirthDate ? <span className="field-error" role="alert">{form.formState.errors.insurance.holderBirthDate.message}</span> : null}</label><label>Fecha efectiva<input {...form.register('insurance.effectiveDate')} type="date" /></label></div> : <p className="field-help">No se aplican reglas de cobertura para pacientes regulares.</p>}</fieldset>
          <fieldset><legend>Contactos</legend><Button data-action-id="PATIENT-CONTACT-ADD" onClick={() => append(createContact(contacts.length === 0))} type="button">Agregar contacto</Button>{form.formState.errors.contacts?.message ? <span className="field-error" role="alert">{form.formState.errors.contacts.message}</span> : null}{contactFields.map((field, index) => <fieldset key={field.fieldKey}><legend>Contacto {index + 1}</legend><label>Nombre<input {...form.register(`contacts.${index}.fullName`)} /></label><label>Teléfono<input {...form.register(`contacts.${index}.phone`)} /></label><label>Correo<input {...form.register(`contacts.${index}.email`)} type="email" />{form.formState.errors.contacts?.[index]?.email ? <span className="field-error" role="alert">{form.formState.errors.contacts[index].email.message}</span> : null}</label><label>Parentesco<input {...form.register(`contacts.${index}.relationship`)} /></label><label>Rol<input {...form.register(`contacts.${index}.role`)} /></label><label>País<input {...form.register(`contacts.${index}.country`)} /></label><p>{contacts[index]?.isPrimary ? 'Contacto principal' : 'Contacto secundario'}</p><Button data-action-id="PATIENT-CONTACT-PRIMARY" onClick={() => setPrimaryContact(index)} type="button">Definir principal</Button><Button className="button-secondary" data-action-id="PATIENT-CONTACT-REMOVE" onClick={() => remove(index)} type="button">Eliminar contacto</Button></fieldset>)}</fieldset>
          <fieldset><legend>Dirección</legend><label>Enlace de ubicación<input {...form.register('address.locationUrl')} placeholder="Enlace de ubicación" /></label><Button className="button-secondary" data-action-id="PATIENT-ADDRESS-LOOKUP" onClick={lookupAddress} type="button">Consultar enlace</Button><label>Dirección<input {...form.register('address.line')} />{form.formState.errors.address?.line ? <span className="field-error" role="alert">{form.formState.errors.address.line.message}</span> : null}</label><label>Coordenadas<input {...form.register('address.coordinates')} placeholder="Marcador o coordenadas" /></label><label>Comentario o referencia<input {...form.register('address.comments')} />{form.formState.errors.address?.comments ? <span className="field-error" role="alert">{form.formState.errors.address.comments.message}</span> : null}</label><Button className="button-secondary" data-action-id="PATIENT-ADDRESS-CLEAR" onClick={clearAddress} type="button">Limpiar dirección</Button>{addressNotice ? <p className="field-help" role="status">{addressNotice}</p> : null}</fieldset>
        </form>
      </Dialog>
      <Dialog description="Carga local CSV de datos exclusivamente sintéticos. Encabezados requeridos: document, firstName, lastName." footer={<><Button className="button-secondary" data-action-id="PATIENT-IMPORT-CANCEL" onClick={() => { setImportOpen(false); setImportPreview(null); }} type="button">Cancelar</Button><Button data-action-id="PATIENT-IMPORT-CONFIRM" disabled={!importPreview?.rows.length || Boolean(importPreview.errors.length)} onClick={confirmImport} type="button">Importar pacientes</Button></>} onClose={() => { setImportOpen(false); setImportPreview(null); }} open={importOpen} title="Importar pacientes"><label>Archivo CSV<input accept=".csv,text/csv" data-action-id="PATIENT-IMPORT-FILE" onChange={(event) => { void selectImportFile(event.target.files?.[0]); }} type="file" /></label>{importPreview ? <div data-action-id="PATIENT-IMPORT-PREVIEW"><p role="status">Archivo cargado: {importPreview.fileName}</p><p>{importPreview.rows.length} filas válidas de {importPreview.totalRows}.</p>{importPreview.errors.length ? <ul role="alert">{importPreview.errors.map((error) => <li key={error}>{error}</li>)}</ul> : <div className="table-wrap"><table><thead><tr><th>Documento</th><th>Nombre</th><th>Correo</th><th>Empresa</th></tr></thead><tbody>{importPreview.rows.map((patient) => <tr key={patient.id}><td>{patient.documentType} {patient.documentId}</td><td>{patient.fullName}</td><td>{patient.email ?? 'Sin dato'}</td><td>{patient.company ?? 'Sin dato'}</td></tr>)}</tbody></table></div>}</div> : null}</Dialog>
    </div>
  );
}
