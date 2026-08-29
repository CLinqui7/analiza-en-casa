'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Hospitalization } from '@analiza/contracts';
import { searchHospitalizations } from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';

const accountTypes = ['SEGURO', 'PARTICULAR', 'EMPRESA'] as const;
const priorities = ['LOW', 'MEDIUM', 'HIGH'] as const;
const statuses = ['ACTIVE', 'PENDING_CLOSE', 'CLOSED'] as const;
const pageSizes = [5, 10, 25, 50] as const;
const formSchema = z.object({
  patientId: z.string().min(1, 'Seleccione un paciente.'),
  startDate: z.string().min(1, 'Indique la fecha de inicio.'),
  accountType: z.enum(accountTypes),
  insurer: z.string().trim(), manager: z.string().trim(), priority: z.enum(priorities), diagnosisSummary: z.string().trim(),
  nextAction: z.string().trim(), devices: z.string().trim(),
});
type HospitalizationForm = z.infer<typeof formSchema>;
const statusLabels: Record<Hospitalization['status'], string> = { ACTIVE: 'Activo', PENDING_CLOSE: 'Pendiente de cierre', CLOSED: 'Cerrado' };
const statusTone = (status: Hospitalization['status']) => status === 'ACTIVE' ? 'success' : status === 'PENDING_CLOSE' ? 'warning' : 'neutral';

function blankForm(): HospitalizationForm {
  return { patientId: '', startDate: new Date().toISOString().slice(0, 10), accountType: 'PARTICULAR', insurer: '', manager: '', priority: 'MEDIUM', diagnosisSummary: '', nextAction: '', devices: '' };
}
function formFor(item: Hospitalization): HospitalizationForm {
  return { patientId: item.patientId, startDate: item.startDate, accountType: item.accountType as HospitalizationForm['accountType'], insurer: item.insurer ?? '', manager: item.manager ?? '', priority: item.priority ?? 'MEDIUM', diagnosisSummary: item.diagnosisSummary ?? '', nextAction: item.nextAction ?? '', devices: item.devices?.join(', ') ?? '' };
}

export default function HospitalizationsPage() {
  const { addHospitalization, error, hospitalizations, loading, patients, updateHospitalization } = useWorkspace();
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState<Hospitalization | null>(null);
  const [creating, setCreating] = useState(false);
  const [dismissedRequestedEdit, setDismissedRequestedEdit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Hospitalization['status'] | ''>('');
  const [startDate, setStartDate] = useState('');
  const [accountType, setAccountType] = useState('');
  const [pageSize, setPageSize] = useState<(typeof pageSizes)[number]>(10);
  const [page, setPage] = useState(1);
  const requestedEdit = searchParams.get('edit');
  const automaticEdit = !dismissedRequestedEdit && requestedEdit && can('cases:write')
    ? hospitalizations.find((candidate) => candidate.id === requestedEdit) ?? null : null;
  const activeEdit = editing ?? automaticEdit;
  const form = useForm<HospitalizationForm>({ resolver: zodResolver(formSchema), defaultValues: blankForm(), values: automaticEdit ? formFor(automaticEdit) : undefined });
  const entries = useMemo(() => searchHospitalizations(hospitalizations, patients, query)
    .filter((item) => !status || item.status === status)
    .filter((item) => !startDate || item.startDate === startDate)
    .filter((item) => !accountType || item.accountType === accountType), [accountType, hospitalizations, patients, query, startDate, status]);
  const accountOptions = useMemo(() => [...new Set(hospitalizations.map((item) => item.accountType))].sort(), [hospitalizations]);
  const insurerOptions = useMemo(() => [...new Set(patients.map((item) => item.insurer).filter((item): item is string => Boolean(item)))].sort(), [patients]);
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleEntries = entries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const dialogOpen = creating || Boolean(activeEdit);
  const resetFilters = () => { setStatus(''); setStartDate(''); setAccountType(''); setPage(1); };
  const close = () => { setCreating(false); setEditing(null); setDismissedRequestedEdit(true); form.reset(blankForm()); };
  const openCreate = () => { setMessage(null); setEditing(null); setDismissedRequestedEdit(true); form.reset(blankForm()); setCreating(true); };
  const openEdit = (item: Hospitalization) => { setMessage(null); setCreating(false); setDismissedRequestedEdit(true); setEditing(item); form.reset(formFor(item)); };

  function submit(values: HospitalizationForm) {
    const data = { ...values, insurer: values.insurer || undefined, manager: values.manager || undefined, diagnosisSummary: values.diagnosisSummary || undefined, nextAction: values.nextAction || undefined, devices: values.devices ? values.devices.split(',').map((value) => value.trim()).filter(Boolean) : undefined };
    if (activeEdit) {
      updateHospitalization({ ...activeEdit, ...data });
      setMessage('Hospitalización actualizada y persistida con evidencia de auditoría.');
    } else {
      addHospitalization({ id: `HOS-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, ...data, status: 'ACTIVE' });
      setMessage('Hospitalización sintética persistida con evidencia de auditoría.');
    }
    close();
  }

  return <div className="page-stack">
    <header className="page-header page-header-actions"><div><p className="eyebrow">Operaciones</p><h1>Hospitalizaciones</h1><p>Registros sintéticos de coordinación; no infiere reglas clínicas, financieras ni de cobertura.</p></div>{can('cases:write') ? <Button data-action-id="HOSPITALIZATION-CREATE" onClick={openCreate} type="button">Nueva hospitalización</Button> : null}</header>
    {message ? <p className="notice success" role="status">{message}</p> : null}{error ? <p className="notice error" role="alert">No fue posible persistir la información: {error}</p> : null}
    <Panel><div className="table-heading"><h2>Registros</h2><StatusTag>{entries.length} hospitalizaciones</StatusTag></div><div className="form-grid">
      <label className="full" htmlFor="hospitalization-search">Buscar hospitalización</label><input data-action-id="HOSPITALIZATION-SEARCH" id="hospitalization-search" onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Nombre, documento u hospitalización" type="search" value={query} />
      <Button className="button-secondary" data-action-id="HOSPITALIZATION-SEARCH-CLEAR" disabled={!query} onClick={() => { setQuery(''); setPage(1); }} type="button">Limpiar búsqueda</Button>
      <label>Estado administrativo<select data-action-id="HOSPITALIZATION-FILTER-STATE" onChange={(event) => { setStatus(event.target.value as Hospitalization['status'] | ''); setPage(1); }} value={status}><option value="">Todos</option>{statuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}</select></label>
      <label>Fecha de inicio<input data-action-id="HOSPITALIZATION-FILTER-START-DATE" onChange={(event) => { setStartDate(event.target.value); setPage(1); }} type="date" value={startDate} /></label>
      <label>Tipo de cuenta<select data-action-id="HOSPITALIZATION-FILTER-ACCOUNT-TYPE" onChange={(event) => { setAccountType(event.target.value); setPage(1); }} value={accountType}><option value="">Todos</option>{accountOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <Button className="button-secondary" data-action-id="HOSPITALIZATION-FILTER-RESET" onClick={resetFilters} type="button">Restablecer filtros</Button>
    </div></Panel>
    <Panel>{loading ? <p role="status">Cargando hospitalizaciones…</p> : entries.length ? <><div className="table-wrap"><table><thead><tr><th>Acciones</th><th>Hospitalización</th><th>Documento</th><th>Paciente</th><th>Fecha de ingreso</th><th>Tipo de cuenta</th><th>Estado</th><th>Responsable</th><th>Próxima acción</th></tr></thead><tbody>{visibleEntries.map((item) => {
      const patient = patients.find((candidate) => candidate.id === item.patientId);
      return <tr key={item.id}><td><Link data-action-id="HOSPITALIZATION-DETAIL-NAVIGATE" href={`/hospitalizations/${item.id}`}>Ver</Link>{can('cases:write') ? <Button className="button-link" data-action-id="HOSPITALIZATION-EDIT" onClick={() => openEdit(item)} type="button">Editar</Button> : null}</td><td><Link data-action-id="HOSPITALIZATION-DETAIL-NAVIGATE" href={`/hospitalizations/${item.id}`}>{item.id}</Link></td><td>{patient?.documentId ?? 'No disponible'}</td><td>{patient?.fullName ?? 'No disponible'}</td><td>{item.startDate}</td><td>{item.accountType}</td><td><StatusTag tone={statusTone(item.status)}>{statusLabels[item.status]}</StatusTag></td><td>{item.manager ?? 'No asignado'}</td><td>{item.nextAction ?? 'Sin acción documentada'}</td></tr>;
    })}</tbody></table></div><div className="table-heading"><label>Registros por página<select data-action-id="HOSPITALIZATION-PAGE-SIZE" onChange={(event) => { setPageSize(Number(event.target.value) as (typeof pageSizes)[number]); setPage(1); }} value={pageSize}>{pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></label><div><Button className="button-secondary" data-action-id="HOSPITALIZATION-PAGE-PREV" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">Anterior</Button><span> Página {currentPage} de {totalPages} </span><Button className="button-secondary" data-action-id="HOSPITALIZATION-PAGE-NEXT" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">Siguiente</Button></div></div></> : <EmptyState detail={query || status || startDate || accountType ? 'Ajuste o restablezca los filtros para ver los registros.' : 'Cree una hospitalización para iniciar la coordinación.'} title={query || status || startDate || accountType ? 'Sin resultados' : 'Sin hospitalizaciones'} />}</Panel>
    <Dialog description="Los campos se conservan como información operativa sintética; las reglas clínicas, financieras y de cobertura no se infieren." footer={<><Button className="button-secondary" data-action-id={activeEdit ? 'HOSPITALIZATION-EDIT-CANCEL' : 'HOSPITALIZATION-CREATE-CANCEL'} onClick={close} type="button">Cancelar</Button><Button data-action-id={activeEdit ? 'HOSPITALIZATION-EDIT-SUBMIT' : 'HOSPITALIZATION-CREATE-SUBMIT'} form="hospitalization-form" type="submit">{activeEdit ? 'Guardar cambios' : 'Guardar hospitalización'}</Button></>} onClose={close} open={dialogOpen} title={activeEdit ? `Editar ${activeEdit.id}` : 'Nueva hospitalización'}><form className="form-grid" id="hospitalization-form" noValidate onSubmit={form.handleSubmit(submit)}>
      <label className="full">Paciente<select {...form.register('patientId')}><option value="">Seleccione un paciente</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.documentId} · {patient.fullName}</option>)}</select>{form.formState.errors.patientId ? <span className="field-error">{form.formState.errors.patientId.message}</span> : null}</label>
      <label>Fecha de inicio<input {...form.register('startDate')} type="date" />{form.formState.errors.startDate ? <span className="field-error">{form.formState.errors.startDate.message}</span> : null}</label><label>Tipo de cuenta<select {...form.register('accountType')}>{accountTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Aseguradora<select {...form.register('insurer')}><option value="">Particular / sin aseguradora</option>{insurerOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Responsable administrativo<input {...form.register('manager')} /></label><label>Prioridad<select {...form.register('priority')}>{priorities.map((item) => <option key={item} value={item}>{item === 'LOW' ? 'Baja' : item === 'MEDIUM' ? 'Media' : 'Alta'}</option>)}</select></label><label className="full">Resumen diagnóstico<textarea {...form.register('diagnosisSummary')} rows={3} /></label><label className="full">Próxima acción<textarea {...form.register('nextAction')} rows={2} /></label><label className="full">Dispositivos / accesos<input {...form.register('devices')} placeholder="Separados por coma" /></label>
    </form></Dialog>
  </div>;
}
