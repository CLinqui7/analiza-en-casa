'use client';
import { isServerDataMode } from '@/lib/data-mode';

import { isCoreRelease } from '@/lib/release-profile';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Hospitalization, Quote } from '@analiza/contracts';
import {
  filterHospitalizations,
  hospitalizationDurationDays,
  searchHospitalizations,
  searchQuotes,
} from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';
import {
  admissionPeriodsFor,
  normalizeAdmissionPeriods,
  type AdmissionPeriod,
} from '@/lib/hospitalization-periods';
import {
  privateFileDownloadHref,
  type PrivateFileMetadata,
  uploadPrivateFiles,
} from '@/lib/private-files';

const accountTypes = ['SEGURO', 'PARTICULAR', 'EMPRESA'] as const;
const priorities = ['LOW', 'MEDIUM', 'HIGH'] as const;
const statuses = ['ACTIVE', 'PENDING_CLOSE', 'CLOSED'] as const;
const pageSizes = [5, 10, 25, 50] as const;
const formSchema = z.object({
  patientId: z.string().min(1, 'Seleccione un paciente.'),
  startDate: z.string().min(1, 'Indique la fecha de ingreso.'),
  endDate: z.string(),
  accountType: z.enum(accountTypes),
  insurer: z.string().trim(),
  manager: z.string().trim(),
  priority: z.enum(priorities),
  diagnosisSummary: z.string().trim(),
  primaryDoctorId: z.string().trim(),
  secondaryDoctorId: z.string().trim(),
  nextAction: z.string().trim(),
  admissionPeriods: z.array(
    z.object({ admissionDate: z.string(), dischargeDate: z.string().optional() }),
  ),
});
type HospitalizationForm = z.infer<typeof formSchema>;
const statusLabels: Record<Hospitalization['status'], string> = {
  ACTIVE: 'Activo',
  PENDING_CLOSE: 'Pendiente de cierre',
  CLOSED: 'Cerrado',
};
const statusTone = (status: Hospitalization['status']) =>
  status === 'ACTIVE' ? 'success' : status === 'PENDING_CLOSE' ? 'warning' : 'neutral';

function blankForm(): HospitalizationForm {
  return {
    patientId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    accountType: 'PARTICULAR',
    insurer: '',
    manager: '',
    priority: 'MEDIUM',
    diagnosisSummary: '',
    primaryDoctorId: '',
    secondaryDoctorId: '',
    nextAction: '',
    admissionPeriods: [],
  };
}
function formFor(item: Hospitalization): HospitalizationForm {
  const [primary] = admissionPeriodsFor(item);
  return {
    patientId: item.patientId,
    startDate: primary.admissionDate,
    endDate: primary.dischargeDate ?? '',
    accountType: item.accountType as HospitalizationForm['accountType'],
    insurer: item.insurer ?? '',
    manager: item.manager ?? '',
    priority: item.priority ?? 'MEDIUM',
    diagnosisSummary: item.diagnosisSummary ?? '',
    primaryDoctorId: item.primaryDoctorId ?? '',
    secondaryDoctorId: item.secondaryDoctorId ?? '',
    nextAction: item.nextAction ?? '',
    admissionPeriods: admissionPeriodsFor(item).slice(1),
  };
}

export default function HospitalizationsPage() {
  const {
    addHospitalization,
    error,
    doctors,
    catalogItems,
    hospitalizations,
    loading,
    patients,
    providerMode,
    updateHospitalization,
  } = useWorkspace();
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState<Hospitalization | null>(null);
  const [creating, setCreating] = useState(false);
  const [dismissedRequestedEdit, setDismissedRequestedEdit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingPrivateFiles, setPendingPrivateFiles] = useState<File[]>([]);
  const [privateFiles, setPrivateFiles] = useState<Record<string, PrivateFileMetadata[]>>({});
  const [tab, setTab] = useState<'ACTIVE' | 'QUOTES' | 'PIC'>('ACTIVE');
  const [query, setQuery] = useState(() => searchParams.get('search') ?? '');
  const [patientQuery, setPatientQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState({
    status: '' as Hospitalization['status'] | '',
    startDate: '',
    accountType: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({
    status: '' as Hospitalization['status'] | '',
    startDate: '',
    accountType: '',
  });
  const [pageSize, setPageSize] = useState<(typeof pageSizes)[number]>(10);
  const [page, setPage] = useState(1);
  const requestedEdit = searchParams.get('edit');
  const automaticEdit =
    !dismissedRequestedEdit && requestedEdit && can('cases:write')
      ? (hospitalizations.find((candidate) => candidate.id === requestedEdit) ?? null)
      : null;
  const activeEdit = editing ?? automaticEdit;
  const form = useForm<HospitalizationForm>({
    resolver: zodResolver(formSchema),
    defaultValues: blankForm(),
    values: automaticEdit ? formFor(automaticEdit) : undefined,
  });
  const additionalPeriods = useWatch({ control: form.control, name: 'admissionPeriods' }) ?? [];
  const entries = useMemo(
    () =>
      filterHospitalizations(
        searchHospitalizations(hospitalizations, patients, query),
        appliedFilters,
      ),
    [appliedFilters, hospitalizations, patients, query],
  );
  const accountOptions = useMemo(
    () => [...new Set(hospitalizations.map((item) => item.accountType))].sort(),
    [hospitalizations],
  );
  const insurerOptions = useMemo(
    () =>
      [
        ...new Set([
          ...catalogItems
            .filter((item) => item.category === 'INSURERS' && item.status === 'ACTIVE')
            .map((item) => item.name),
          ...patients.map((item) => item.insurer).filter((item): item is string => Boolean(item)),
        ]),
      ].sort(),
    [catalogItems, patients],
  );
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleEntries = entries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const dialogOpen = creating || Boolean(activeEdit);
  const resetFilters = () => {
    const cleared = {
      status: '' as Hospitalization['status'] | '',
      startDate: '',
      accountType: '',
    };
    setDraftFilters(cleared);
    setAppliedFilters(cleared);
    setPage(1);
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
    setDismissedRequestedEdit(true);
    form.reset(blankForm());
    setPendingPrivateFiles([]);
  };
  const openCreate = () => {
    setMessage(null);
    setActionError(null);
    setEditing(null);
    setDismissedRequestedEdit(true);
    form.reset(blankForm());
    setCreating(true);
  };
  const openEdit = (item: Hospitalization) => {
    setMessage(null);
    setActionError(null);
    setCreating(false);
    setDismissedRequestedEdit(true);
    setEditing(item);
    form.reset(formFor(item));
  };

  async function submit(values: HospitalizationForm) {
    let admissionPeriods: AdmissionPeriod[];
    try {
      admissionPeriods = normalizeAdmissionPeriods([
        { admissionDate: values.startDate, dischargeDate: values.endDate || undefined },
        ...values.admissionPeriods,
      ]);
    } catch (exception) {
      form.setError('startDate', {
        message: exception instanceof Error ? exception.message : 'Revise los períodos de ingreso.',
      });
      return;
    }
    const [primary] = admissionPeriods;
    const data = {
      ...values,
      startDate: primary.admissionDate,
      endDate: primary.dischargeDate,
      admissionPeriods,
      insurer: values.insurer || undefined,
      manager: values.manager || undefined,
      diagnosisSummary: values.diagnosisSummary || undefined,
      primaryDoctorId: values.primaryDoctorId || undefined,
      secondaryDoctorId: values.secondaryDoctorId || undefined,
      nextAction: values.nextAction || undefined,
    };
    const record = activeEdit
      ? { ...activeEdit, ...data }
      : {
          id: `HOS-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          ...data,
          status: 'ACTIVE' as const,
        };
    const saved = activeEdit
      ? await updateHospitalization({ ...activeEdit, ...data })
      : await addHospitalization(record);
    if (!saved) return;
    if (isServerDataMode(providerMode) && pendingPrivateFiles.length) {
      try {
        const uploaded = await uploadPrivateFiles(
          'hospitalization',
          record.id,
          pendingPrivateFiles,
        );
        setPrivateFiles((current) => ({
          ...current,
          [record.id]: [...(current[record.id] ?? []), ...uploaded],
        }));
      } catch (cause) {
        setActionError(
          `La hospitalización fue guardada, pero los archivos privados no se cargaron: ${
            cause instanceof Error ? cause.message : 'intente nuevamente desde Editar.'
          }`,
        );
      }
    }
    if (activeEdit) {
      setMessage('Hospitalización actualizada y persistida con evidencia de auditoría.');
    } else {
      setMessage(
        isServerDataMode(providerMode)
          ? 'Hospitalización registrada.'
          : 'Hospitalización guardada con evidencia de auditoría.',
      );
    }
    close();
  }

  return (
    <div className="page-stack hospitalizations-page">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Financiero</p>
          <h1>Hospitalización</h1>
          <p>Coordinación de ingresos, responsables, enfermería asignada y seguimiento del caso.</p>
        </div>
        {can('cases:write') ? (
          <Button data-action-id="HOSPITALIZATION-CREATE" onClick={openCreate} type="button">
            Nueva hospitalización
          </Button>
        ) : null}
      </header>
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="notice error" role="alert">
          No fue posible persistir la información: {error}
        </p>
      ) : null}
      {actionError ? (
        <p className="notice error" role="alert">
          {actionError}
        </p>
      ) : null}
      {Object.values(privateFiles).flat().length ? (
        <p className="notice success" role="status">
          Archivos privados cargados en esta sesión:{' '}
          {Object.values(privateFiles)
            .flat()
            .map((file, index) => (
              <span key={file.id}>
                {index ? ', ' : ''}
                <a href={privateFileDownloadHref(file.id)}>{file.name}</a>
              </span>
            ))}
        </p>
      ) : null}
      {!isCoreRelease && (
        <div className="hospitalization-tabs-shell">
          <div className="hospitalization-tabs-heading">
            <div>
              <h2>Relación de pacientes por empresa</h2>
              <p>Organización administrativa de casos y seguimiento.</p>
            </div>
            <StatusTag>Conteo no configurado</StatusTag>
          </div>
          <div className="tabs" role="tablist" aria-label="Hospitalización administrativa">
            <button
              aria-selected={tab === 'ACTIVE'}
              className={`tab ${tab === 'ACTIVE' ? 'active' : ''}`}
              data-action-id="HOSPITALIZATION-TAB-ACTIVE"
              onClick={() => setTab('ACTIVE')}
              role="tab"
              type="button"
            >
              Activos
            </button>
            <button
              aria-selected={tab === 'QUOTES'}
              className={`tab ${tab === 'QUOTES' ? 'active' : ''}`}
              data-action-id="HOSPITALIZATION-TAB-QUOTES"
              onClick={() => setTab('QUOTES')}
              role="tab"
              type="button"
            >
              Cotizaciones
            </button>
            <button
              aria-selected={tab === 'PIC'}
              className={`tab ${tab === 'PIC' ? 'active' : ''}`}
              data-action-id="HOSPITALIZATION-TAB-PIC"
              onClick={() => setTab('PIC')}
              role="tab"
              type="button"
            >
              Ejecución de cotización
            </button>
          </div>
        </div>
      )}
      {tab === 'ACTIVE' ? (
        <>
          <Panel className="hospitalization-filter-panel">
            <div className="table-heading">
              <div>
                <h2>Buscar y filtrar</h2>
                <p>Encuentre rápidamente un caso por paciente, documento o identificador.</p>
              </div>
              <StatusTag>{entries.length} hospitalizaciones</StatusTag>
            </div>
            <div className="hospitalization-filter-bar">
              <label className="hospitalization-search-field" htmlFor="hospitalization-search">
                <span aria-hidden="true">⌕</span>
                <input
                  aria-label="Buscar hospitalización"
                  data-action-id="HOSPITALIZATION-SEARCH"
                  id="hospitalization-search"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Paciente, documento o caso"
                  type="search"
                  value={query}
                />
                {query ? (
                  <button
                    aria-label="Limpiar búsqueda"
                    className="hospitalization-search-clear"
                    data-action-id="HOSPITALIZATION-SEARCH-CLEAR"
                    onClick={() => {
                      setQuery('');
                      setPage(1);
                    }}
                    type="button"
                  >
                    ×
                  </button>
                ) : null}
              </label>
              <label>
                <span>Estado</span>
                <select
                  aria-label="Estado administrativo"
                  data-action-id="HOSPITALIZATION-FILTER-STATUS"
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      status: event.target.value as Hospitalization['status'] | '',
                    }))
                  }
                  value={draftFilters.status}
                >
                  <option value="">Todos</option>
                  {statuses.map((item) => (
                    <option key={item} value={item}>
                      {statusLabels[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Ingreso</span>
                <input
                  aria-label="Fecha de ingreso"
                  data-action-id="HOSPITALIZATION-FILTER-DATE"
                  onChange={(event) =>
                    setDraftFilters((current) => ({ ...current, startDate: event.target.value }))
                  }
                  type="date"
                  value={draftFilters.startDate}
                />
              </label>
              <label>
                <span>Cuenta</span>
                <select
                  aria-label="Tipo de cuenta"
                  data-action-id="HOSPITALIZATION-FILTER-ACCOUNT-TYPE"
                  onChange={(event) =>
                    setDraftFilters((current) => ({ ...current, accountType: event.target.value }))
                  }
                  value={draftFilters.accountType}
                >
                  <option value="">Todos</option>
                  {accountOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <div className="action-row hospitalization-filter-actions">
                <Button
                  data-action-id="HOSPITALIZATION-FILTER-APPLY"
                  onClick={() => {
                    setAppliedFilters(draftFilters);
                    setPage(1);
                  }}
                  type="button"
                >
                  Aplicar
                </Button>
                <Button
                  className="button-secondary"
                  data-action-id="HOSPITALIZATION-FILTER-CLEAR"
                  onClick={resetFilters}
                  type="button"
                >
                  Limpiar
                </Button>
              </div>
            </div>
          </Panel>
          <Panel className="hospitalization-table-panel">
            {loading ? (
              <p role="status">Cargando hospitalizaciones…</p>
            ) : entries.length ? (
              <>
                <div className="table-heading">
                  <div>
                    <h2>Gestión de hospitalizaciones</h2>
                    <p>Casos activos y seguimiento administrativo.</p>
                  </div>
                  <StatusTag>{visibleEntries.length} visibles</StatusTag>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Acciones</th>
                        <th>Identificador</th>
                        <th>Paciente</th>
                        <th>Empresa</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Períodos</th>
                        <th>Duración</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEntries.map((item) => {
                        const patient = patients.find(
                          (candidate) => candidate.id === item.patientId,
                        );
                        const duration = hospitalizationDurationDays(item);
                        return (
                          <tr key={item.id}>
                            <td>
                              <div className="hospitalization-row-actions">
                                <Link
                                  className="hospitalization-manage-link"
                                  data-action-id="HOSPITALIZATION-DETAIL-NAVIGATE"
                                  href={`/hospitalizations/${item.id}`}
                                >
                                  Gestionar <span aria-hidden="true">→</span>
                                </Link>
                                {can('cases:write') ? (
                                  <Button
                                    aria-label={`Editar ${item.id}`}
                                    className="button-secondary hospitalization-edit-action"
                                    data-action-id="HOSPITALIZATION-EDIT"
                                    onClick={() => openEdit(item)}
                                    title={`Editar ${item.id}`}
                                    type="button"
                                  >
                                    ✎
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                            <td>
                              <Link
                                data-action-id="HOSPITALIZATION-DETAIL-NAVIGATE"
                                href={`/hospitalizations/${item.id}`}
                              >
                                {item.id}
                              </Link>
                              <br />
                              <small>{patient?.documentId ?? 'No disponible'}</small>
                            </td>
                            <td>{patient?.fullName ?? 'No disponible'}</td>
                            <td>{patient?.company ?? 'No disponible'}</td>
                            <td>{item.accountType}</td>
                            <td>
                              <StatusTag tone={statusTone(item.status)}>
                                {statusLabels[item.status]}
                              </StatusTag>
                            </td>
                            <td>
                              {admissionPeriodsFor(item).length}
                              <br />
                              <small>Ingreso / egreso administrativos</small>
                            </td>
                            <td>
                              {duration === undefined ? 'No disponible' : `${duration} días`}
                              <br />
                              <small>Derivada de fechas administrativas</small>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="table-heading">
                  <label>
                    Registros por página
                    <select
                      data-action-id="HOSPITALIZATION-PAGE-SIZE"
                      onChange={(event) => {
                        setPageSize(Number(event.target.value) as (typeof pageSizes)[number]);
                        setPage(1);
                      }}
                      value={pageSize}
                    >
                      {pageSizes.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <Button
                      className="button-secondary"
                      data-action-id="HOSPITALIZATION-PAGE-PREV"
                      disabled={currentPage === 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                      type="button"
                    >
                      Anterior
                    </Button>
                    <span>
                      {' '}
                      Página {currentPage} de {totalPages}{' '}
                    </span>
                    <Button
                      className="button-secondary"
                      data-action-id="HOSPITALIZATION-PAGE-NEXT"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                      type="button"
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                detail={
                  query ||
                  appliedFilters.status ||
                  appliedFilters.startDate ||
                  appliedFilters.accountType
                    ? 'Ajuste o restablezca los filtros para ver los registros.'
                    : 'Cree una hospitalización para iniciar la coordinación.'
                }
                title={
                  query ||
                  appliedFilters.status ||
                  appliedFilters.startDate ||
                  appliedFilters.accountType
                    ? 'Sin resultados'
                    : 'Sin hospitalizaciones'
                }
              />
            )}
          </Panel>
          <Panel>
            <h2>Pacientes inactivos</h2>
            <p>
              La búsqueda, paginación y columnas operativas certificadas se reutilizan en{' '}
              <Link href="/patients?tab=INACTIVE">Pacientes · Inactivos</Link>.
            </p>
          </Panel>
        </>
      ) : null}
      {tab === 'QUOTES' ? <HospitalizationQuoteTracking /> : null}
      {tab === 'PIC' ? (
        <Panel>
          <h2>Ejecución de cotización</h2>
          <EmptyState
            detail="No se demuestran reglas, estados ni acciones de PIC en CH03; la superficie queda visible sin inventar un flujo."
            title="Configuración pendiente"
          />
        </Panel>
      ) : null}
      <Dialog
        description="Registre la información administrativa del caso. Los accesos y el personal de atención se gestionan en Hospitalización Clínica."
        footer={
          <>
            <Button
              className="button-secondary"
              data-action-id={
                activeEdit ? 'HOSPITALIZATION-EDIT-CANCEL' : 'HOSPITALIZATION-CREATE-CANCEL'
              }
              onClick={close}
              type="button"
            >
              Cancelar
            </Button>
            <Button
              data-action-id={
                activeEdit ? 'HOSPITALIZATION-EDIT-SUBMIT' : 'HOSPITALIZATION-CREATE-SUBMIT'
              }
              form="hospitalization-form"
              type="submit"
            >
              {activeEdit ? 'Guardar cambios' : 'Guardar hospitalización'}
            </Button>
          </>
        }
        onClose={close}
        open={dialogOpen}
        title={activeEdit ? `Editar ${activeEdit.id}` : 'Nueva hospitalización'}
      >
        <form
          className="form-grid"
          id="hospitalization-form"
          noValidate
          onSubmit={form.handleSubmit(submit)}
        >
          <label>
            Buscar paciente por nombre o DUI
            <input
              onChange={(event) => setPatientQuery(event.target.value)}
              type="search"
              value={patientQuery}
            />
          </label>
          <label>
            Paciente
            <select {...form.register('patientId')}>
              <option value="">Seleccione un paciente</option>
              {patients
                .filter((patient) =>
                  `${patient.fullName} ${patient.documentId}`
                    .toLocaleLowerCase('es')
                    .includes(patientQuery.toLocaleLowerCase('es')),
                )
                .map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.documentId} · {patient.fullName}
                  </option>
                ))}
            </select>
            {form.formState.errors.patientId ? (
              <span className="field-error">{form.formState.errors.patientId.message}</span>
            ) : null}
          </label>
          <label>
            Fecha de ingreso
            <input
              data-action-id="HOSPITALIZATION-ADMISSION-DATE"
              {...form.register('startDate')}
              type="date"
            />
            {form.formState.errors.startDate ? (
              <span className="field-error">{form.formState.errors.startDate.message}</span>
            ) : null}
          </label>
          <label>
            Fecha de egreso (opcional)
            <input
              data-action-id="HOSPITALIZATION-DISCHARGE-DATE"
              {...form.register('endDate')}
              type="date"
            />
          </label>
          <div className="full">
            <div className="table-heading">
              <div>
                <h3>Períodos adicionales</h3>
                <p className="field-help">
                  Registre más de una fecha de ingreso/egreso sin inferir una transición clínica.
                </p>
              </div>
              <Button
                className="button-secondary"
                data-action-id="HOSPITALIZATION-ADMISSION-PERIOD-ADD"
                onClick={() =>
                  form.setValue('admissionPeriods', [
                    ...additionalPeriods,
                    { admissionDate: '', dischargeDate: undefined },
                  ])
                }
                type="button"
              >
                Agregar período
              </Button>
            </div>
            {additionalPeriods.map((period, index) => (
              <div className="form-grid" key={`${index}-${period.admissionDate}`}>
                <label>
                  Ingreso adicional {index + 1}
                  <input
                    data-action-id="HOSPITALIZATION-ADMISSION-PERIOD-DATE"
                    onChange={(event) =>
                      form.setValue(
                        'admissionPeriods',
                        additionalPeriods.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, admissionDate: event.target.value }
                            : item,
                        ),
                      )
                    }
                    type="date"
                    value={period.admissionDate}
                  />
                </label>
                <label>
                  Egreso adicional {index + 1}
                  <input
                    data-action-id="HOSPITALIZATION-DISCHARGE-PERIOD-DATE"
                    onChange={(event) =>
                      form.setValue(
                        'admissionPeriods',
                        additionalPeriods.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, dischargeDate: event.target.value || undefined }
                            : item,
                        ),
                      )
                    }
                    type="date"
                    value={period.dischargeDate ?? ''}
                  />
                </label>
                <Button
                  aria-label={`Quitar período ${index + 1}`}
                  className="button-secondary"
                  data-action-id="HOSPITALIZATION-ADMISSION-PERIOD-REMOVE"
                  onClick={() =>
                    form.setValue(
                      'admissionPeriods',
                      additionalPeriods.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  type="button"
                >
                  Quitar período
                </Button>
              </div>
            ))}
          </div>
          {isServerDataMode(providerMode) ? (
            <label className="full">
              Archivos privados de hospitalización
              <input
                data-action-id="HOSPITALIZATION-ATTACHMENTS"
                multiple
                onChange={(event) =>
                  setPendingPrivateFiles(Array.from(event.currentTarget.files ?? []))
                }
                type="file"
              />
              <span className="field-help">
                Los bytes se cargan después de guardar y cada descarga vuelve a comprobar
                autorización.
              </span>
            </label>
          ) : (
            <p className="notice warning full" role="status">
              Los archivos demo no se almacenan como archivos privados ni se presentan como
              descargas autorizadas.
            </p>
          )}
          <label>
            Tipo de cuenta
            <select {...form.register('accountType')}>
              {accountTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Aseguradora
            <select {...form.register('insurer')}>
              <option value="">Particular / sin aseguradora</option>
              {insurerOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Responsable administrativo
            <input {...form.register('manager')} />
          </label>
          <label>
            Prioridad
            <select {...form.register('priority')}>
              {priorities.map((item) => (
                <option key={item} value={item}>
                  {item === 'LOW' ? 'Baja' : item === 'MEDIUM' ? 'Media' : 'Alta'}
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            Resumen diagnóstico
            <textarea {...form.register('diagnosisSummary')} rows={3} />
          </label>
          <label>
            Médico tratante principal
            <select {...form.register('primaryDoctorId')}>
              <option value="">Sin asignar</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.fullName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Médico tratante secundario
            <select {...form.register('secondaryDoctorId')}>
              <option value="">Sin asignar</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            Próxima acción
            <textarea {...form.register('nextAction')} rows={2} />
          </label>
          <p className="notice full" role="status">
            Los dispositivos, accesos y enfermeras asignadas se completan después en{' '}
            <Link href="/clinical/hospitalizations">Hospitalización Clínica</Link>.
          </p>
        </form>
      </Dialog>
    </div>
  );
}

function HospitalizationQuoteTracking() {
  const { patients, quotes } = useWorkspace();
  const { can } = useAuth();
  const [query, setQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState({
    status: '' as Quote['status'] | '',
    createdDate: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({
    status: '' as Quote['status'] | '',
    createdDate: '',
  });
  const [pageSize, setPageSize] = useState<(typeof pageSizes)[number]>(10);
  const [page, setPage] = useState(1);
  const visible = useMemo(
    () =>
      searchQuotes(quotes, patients, query).filter(
        (quote) =>
          (!appliedFilters.status || quote.status === appliedFilters.status) &&
          (!appliedFilters.createdDate ||
            quote.createdAt.slice(0, 10) === appliedFilters.createdDate),
      ),
    [appliedFilters, patients, query, quotes],
  );
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageQuotes = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const clearFilters = () => {
    const cleared = { status: '' as Quote['status'] | '', createdDate: '' };
    setDraftFilters(cleared);
    setAppliedFilters(cleared);
    setPage(1);
  };
  return (
    <Panel>
      <div className="table-heading">
        <h2>Cotizaciones</h2>
        {can('quotes:write') ? (
          <Link
            className="button"
            data-action-id="HOSPITALIZATION-QUOTE-CREATE"
            href="/quotes?create=1"
          >
            + Nuevo
          </Link>
        ) : null}
      </div>
      <div className="form-grid">
        <label>
          Estado
          <select
            data-action-id="HOSPITALIZATION-QUOTE-FILTER-STATUS"
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                status: event.target.value as Quote['status'] | '',
              }))
            }
            value={draftFilters.status}
          >
            <option value="">Seleccione</option>
            <option value="DRAFT">Pendiente</option>
            <option value="SENT">Enviada</option>
          </select>
        </label>
        <label>
          Fecha de creación
          <input
            data-action-id="HOSPITALIZATION-QUOTE-FILTER-DATE"
            onChange={(event) =>
              setDraftFilters((current) => ({ ...current, createdDate: event.target.value }))
            }
            type="date"
            value={draftFilters.createdDate}
          />
        </label>
        <div className="action-row">
          <Button
            data-action-id="HOSPITALIZATION-QUOTE-FILTER-APPLY"
            onClick={() => {
              setAppliedFilters(draftFilters);
              setPage(1);
            }}
            type="button"
          >
            Aplicar
          </Button>
          <Button
            className="button-secondary"
            data-action-id="HOSPITALIZATION-QUOTE-FILTER-CLEAR"
            onClick={clearFilters}
            type="button"
          >
            Limpiar
          </Button>
        </div>
        <label className="full">
          Buscar cotización
          <input
            data-action-id="HOSPITALIZATION-QUOTE-SEARCH"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Paciente, documento o cotización"
            type="search"
            value={query}
          />
        </label>
      </div>
      {visible.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>DUI/NIT</th>
                  <th>Nro.</th>
                  <th>Estado</th>
                  <th>Envío preautorización</th>
                  <th>Respuesta seguro</th>
                  <th>Envío de reclamo</th>
                  <th>Creación</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {pageQuotes.map((quote) => {
                  const patient = patients.find((candidate) => candidate.id === quote.patientId);
                  return (
                    <tr key={quote.id}>
                      <td>{patient?.fullName ?? 'No disponible'}</td>
                      <td>{patient?.documentId ?? 'No disponible'}</td>
                      <td>
                        <Link href={`/quotes/${quote.id}`}>{quote.id}</Link>
                      </td>
                      <td>
                        <StatusTag tone={quote.status === 'SENT' ? 'success' : 'warning'}>
                          {quote.status === 'SENT' ? 'Enviada' : 'Pendiente'}
                        </StatusTag>
                      </td>
                      <td>
                        <StatusTag>No enviado</StatusTag>
                      </td>
                      <td>
                        <StatusTag>No aplica</StatusTag>
                      </td>
                      <td>
                        <StatusTag>Pendiente</StatusTag>
                      </td>
                      <td>{new Date(quote.createdAt).toLocaleDateString('es-SV')}</td>
                      <td>USD {quote.total.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="table-heading">
            <label>
              Registros
              <select
                data-action-id="HOSPITALIZATION-QUOTE-PAGE-SIZE"
                onChange={(event) => {
                  setPageSize(Number(event.target.value) as (typeof pageSizes)[number]);
                  setPage(1);
                }}
                value={pageSize}
              >
                {pageSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Página {currentPage} de {totalPages} ({visible.length} registros)
            </p>
            <div>
              <Button
                className="button-secondary"
                data-action-id="HOSPITALIZATION-QUOTE-PAGE-PREV"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                type="button"
              >
                Anterior
              </Button>
              <Button
                className="button-secondary"
                data-action-id="HOSPITALIZATION-QUOTE-PAGE-NEXT"
                disabled={currentPage === totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                type="button"
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          detail="No hay cotizaciones para la búsqueda o filtros actuales."
          title="Sin cotizaciones"
        />
      )}
      <p className="field-help">
        Los estados de envío, respuesta y reclamo son superficies seguras: no se crean
        preautorizaciones, envíos ni reclamos desde esta tabla.{' '}
        <Link data-action-id="QUOTE-INSURANCE-OPEN" href="/insurance">
          Abrir preautorizaciones y reclamos
        </Link>
        .
      </p>
    </Panel>
  );
}
