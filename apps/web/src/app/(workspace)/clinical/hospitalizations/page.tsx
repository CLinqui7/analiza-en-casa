'use client';

import { searchPatients } from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';

function durationLabel(startDate: string, endDate?: string) {
  if (!endDate) return 'En curso';
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 'No documentada';
  const days = Math.floor((end - start) / 86_400_000) + 1;
  return `${days} ${days === 1 ? 'día' : 'días'}`;
}

function initials(name?: string) {
  if (!name) return '—';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

type ClinicalColumn =
  | 'patient'
  | 'document'
  | 'hospitalization'
  | 'triage'
  | 'company'
  | 'clinician'
  | 'start'
  | 'end'
  | 'duration';

const clinicalColumns: Array<{ key: ClinicalColumn; label: string; actionId: string }> = [
  { key: 'patient', label: 'Paciente', actionId: 'CLINICAL-HOSPITALIZATION-PATIENT-COLUMN-FILTER' },
  {
    key: 'document',
    label: 'DUI/NIT',
    actionId: 'CLINICAL-HOSPITALIZATION-DOCUMENT-COLUMN-FILTER',
  },
  {
    key: 'hospitalization',
    label: 'Hospitalización',
    actionId: 'CLINICAL-HOSPITALIZATION-CASE-COLUMN-FILTER',
  },
  { key: 'triage', label: 'Triage', actionId: 'CLINICAL-HOSPITALIZATION-TRIAGE-COLUMN-FILTER' },
  { key: 'company', label: 'Empresa', actionId: 'CLINICAL-HOSPITALIZATION-COMPANY-COLUMN-FILTER' },
  {
    key: 'clinician',
    label: 'Clínico',
    actionId: 'CLINICAL-HOSPITALIZATION-CLINICIAN-COLUMN-FILTER',
  },
  { key: 'start', label: 'Inicio', actionId: 'CLINICAL-HOSPITALIZATION-START-COLUMN-FILTER' },
  { key: 'end', label: 'Fin', actionId: 'CLINICAL-HOSPITALIZATION-END-COLUMN-FILTER' },
  {
    key: 'duration',
    label: 'Duración',
    actionId: 'CLINICAL-HOSPITALIZATION-DURATION-COLUMN-FILTER',
  },
];

const emptyColumnFilters: Record<ClinicalColumn, string> = {
  patient: '',
  document: '',
  hospitalization: '',
  triage: '',
  company: '',
  clinician: '',
  start: '',
  end: '',
  duration: '',
};

function textMatches(value: string, query: string) {
  return (
    !query.trim() || value.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))
  );
}

export default function ClinicalHospitalizationsPage() {
  const { hospitalizations, nursingResources, patients, quotes, updateHospitalization } =
    useWorkspace();
  const { can } = useAuth();
  const [query, setQuery] = useState('');
  const [columnFilters, setColumnFilters] =
    useState<Record<ClinicalColumn, string>>(emptyColumnFilters);
  const [careCaseId, setCareCaseId] = useState<string | null>(null);
  const [careDevices, setCareDevices] = useState('');
  const [careNurseIds, setCareNurseIds] = useState<string[]>([]);
  const [careMessage, setCareMessage] = useState<string | null>(null);
  const [careSaving, setCareSaving] = useState(false);
  const careCase = hospitalizations.find((item) => item.id === careCaseId);

  function openCare(caseId: string) {
    const hospitalization = hospitalizations.find((item) => item.id === caseId);
    if (!hospitalization) return;
    setCareCaseId(caseId);
    setCareDevices(hospitalization.devices?.join(', ') ?? '');
    setCareNurseIds(hospitalization.assignedNursingResourceIds ?? []);
    setCareMessage(null);
  }

  async function saveCare() {
    if (!careCase) return;
    setCareSaving(true);
    const saved = await updateHospitalization({
      ...careCase,
      devices: careDevices
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      assignedNursingResourceIds: careNurseIds,
    });
    setCareSaving(false);
    if (saved) {
      setCareMessage('Atención clínica actualizada correctamente.');
      setCareCaseId(null);
    }
  }

  const patientIds = new Set(searchPatients(patients, query).map((patient) => patient.id));
  const columnValue = (
    hospitalization: (typeof hospitalizations)[number],
    column: ClinicalColumn,
  ) => {
    const patient = patients.find((candidate) => candidate.id === hospitalization.patientId);
    switch (column) {
      case 'patient':
        return patient?.fullName ?? 'No disponible';
      case 'document':
        return patient?.documentId ?? 'No documentado';
      case 'hospitalization':
        return hospitalization.id;
      case 'triage':
        return patient?.triageStatus ?? 'No documentado';
      case 'company':
        return patient?.company ?? 'No documentada';
      case 'clinician':
        return 'No documentado';
      case 'start':
        return hospitalization.startDate;
      case 'end':
        return hospitalization.endDate ?? 'En curso';
      case 'duration':
        return durationLabel(hospitalization.startDate, hospitalization.endDate);
    }
  };

  const entries = hospitalizations.filter(
    (hospitalization) =>
      (!query.trim() ||
        patientIds.has(hospitalization.patientId) ||
        hospitalization.id
          .toLocaleLowerCase('es')
          .includes(query.trim().toLocaleLowerCase('es'))) &&
      clinicalColumns.every(({ key }) =>
        textMatches(columnValue(hospitalization, key), columnFilters[key]),
      ),
  );
  const activeCount = hospitalizations.filter((item) => !item.endDate).length;
  const completedCount = hospitalizations.length - activeCount;
  const filtersActive =
    Boolean(query.trim()) || Object.values(columnFilters).some((value) => Boolean(value.trim()));

  return (
    <div className="page-stack clinical-hospitalizations-page">
      <header className="clinical-page-hero">
        <div className="clinical-page-title">
          <div className="clinical-page-icon" aria-hidden="true">
            ✚
          </div>
          <div>
            <p className="eyebrow">Atención clínica</p>
            <h1>Hospitalizaciones clínicas</h1>
            <p>
              Consulta cada caso, abre el expediente y administra la atención del equipo desde una
              sola vista.
            </p>
          </div>
        </div>
        <div className="clinical-page-summary" aria-label="Resumen de hospitalizaciones">
          <div>
            <span>Total</span>
            <strong>{hospitalizations.length}</strong>
          </div>
          <div>
            <span>En curso</span>
            <strong>{activeCount}</strong>
          </div>
          <div>
            <span>Finalizadas</span>
            <strong>{completedCount}</strong>
          </div>
        </div>
      </header>

      <Panel className="clinical-search-panel">
        <div className="clinical-search-row">
          <label className="clinical-primary-search" htmlFor="clinical-case-search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Buscar hospitalización o paciente</span>
            <input
              data-action-id="CLINICAL-HOSPITALIZATION-SEARCH"
              id="clinical-case-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por paciente, DUI, teléfono o número de hospitalización"
              type="search"
              value={query}
            />
          </label>
          {filtersActive ? (
            <Button
              className="button-secondary clinical-clear-filters"
              onClick={() => {
                setQuery('');
                setColumnFilters(emptyColumnFilters);
              }}
              type="button"
            >
              Limpiar filtros
            </Button>
          ) : null}
          <StatusTag>{entries.length} visibles</StatusTag>
        </div>

        <details className="clinical-filter-disclosure">
          <summary>
            <span>
              <strong>Filtros avanzados</strong>
              <small>Afina la lista por paciente, documento, fechas o estado.</small>
            </span>
            <span className="clinical-filter-chevron" aria-hidden="true">
              ⌄
            </span>
          </summary>
          <div className="clinical-column-filter-grid">
            {clinicalColumns.map(({ key, label, actionId }) => (
              <label key={key}>
                {label}
                <input
                  aria-label={`Filtrar ${label}`}
                  data-action-id={actionId}
                  onChange={(event) =>
                    setColumnFilters((current) => ({ ...current, [key]: event.target.value }))
                  }
                  placeholder={`Filtrar ${label.toLocaleLowerCase('es')}`}
                  type="search"
                  value={columnFilters[key]}
                />
              </label>
            ))}
          </div>
          <div className="clinical-upcoming-filters" id="clinical-filter-boundary">
            <div>
              <strong>Filtros clínicos en preparación</strong>
              <span>Se habilitarán cuando existan catálogos y estados clínicos configurados.</span>
            </div>
            <div className="clinical-disabled-filter-grid">
              {[
                ['Estado clínico', 'CLINICAL-HOSPITALIZATION-STATUS-FILTER'],
                ['Activado por', 'CLINICAL-HOSPITALIZATION-ACTIVATOR-FILTER'],
                ['Tipo de servicio', 'CLINICAL-HOSPITALIZATION-SERVICE-FILTER'],
                ['Tipo de atención', 'CLINICAL-HOSPITALIZATION-CARE-FILTER'],
                ['Activos', 'CLINICAL-HOSPITALIZATION-ACTIVES-FILTER'],
              ].map(([label, actionId]) => (
                <label key={actionId}>
                  {label}
                  <select aria-label={label} data-action-id={actionId} disabled value="">
                    <option value="">Pendiente de configuración</option>
                  </select>
                </label>
              ))}
              <button
                aria-describedby="clinical-filter-boundary"
                data-action-id="CLINICAL-HOSPITALIZATION-FILTER-APPLY"
                disabled
                type="button"
              >
                Aplicar
              </button>
            </div>
          </div>
        </details>
      </Panel>

      <Panel className="clinical-directory-panel">
        <div className="clinical-directory-heading">
          <div>
            <p className="eyebrow">Directorio clínico</p>
            <h2>Casos hospitalizados</h2>
            <p>Selecciona un caso para consultar su expediente o actualizar la atención.</p>
          </div>
          <StatusTag tone={activeCount ? 'warning' : 'neutral'}>
            {activeCount ? `${activeCount} en curso` : 'Sin casos activos'}
          </StatusTag>
        </div>

        {entries.length ? (
          <div className="table-wrap clinical-directory-table-wrap" tabIndex={0}>
            <table className="clinical-directory-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>DUI/NIT</th>
                  <th>Hospitalización</th>
                  <th>Triage</th>
                  <th>Empresa</th>
                  <th>Clínico</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Duración</th>
                  <th className="clinical-actions-heading">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((hospitalization) => {
                  const patient = patients.find(
                    (candidate) => candidate.id === hospitalization.patientId,
                  );
                  const quote = quotes.find(
                    (candidate) =>
                      candidate.caseId === hospitalization.id &&
                      candidate.patientId === hospitalization.patientId,
                  );
                  const isActive = !hospitalization.endDate;
                  return (
                    <tr key={hospitalization.id}>
                      <td>
                        <div className="clinical-patient-cell">
                          <span className="clinical-patient-avatar" aria-hidden="true">
                            {initials(patient?.fullName)}
                          </span>
                          <div>
                            <strong>{patient?.fullName ?? 'Paciente sin nombre'}</strong>
                            <small>{patient?.phone ?? 'Sin teléfono documentado'}</small>
                          </div>
                        </div>
                      </td>
                      <td>{patient?.documentId ?? 'No documentado'}</td>
                      <td>
                        <code className="clinical-case-code">{hospitalization.id}</code>
                      </td>
                      <td>
                        <StatusTag tone={patient?.triageStatus ? 'warning' : 'neutral'}>
                          {patient?.triageStatus ?? 'Sin triage'}
                        </StatusTag>
                      </td>
                      <td>
                        {patient?.company ?? <span className="clinical-muted">Sin empresa</span>}
                      </td>
                      <td>
                        <span className="clinical-muted">No asignado</span>
                      </td>
                      <td>{hospitalization.startDate}</td>
                      <td>
                        <span className={`clinical-case-state ${isActive ? 'is-active' : ''}`}>
                          {hospitalization.endDate ?? 'En curso'}
                        </span>
                      </td>
                      <td>{durationLabel(hospitalization.startDate, hospitalization.endDate)}</td>
                      <td>
                        <div className="clinical-table-actions">
                          <Link
                            className="clinical-table-action clinical-table-action-primary"
                            data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"
                            href={`/hospitalizations/${hospitalization.id}`}
                          >
                            Abrir
                          </Link>
                          {can('cases:write') ? (
                            <button
                              className="clinical-table-action"
                              data-action-id="CLINICAL-HOSPITALIZATION-CARE-EDIT"
                              onClick={() => openCare(hospitalization.id)}
                              type="button"
                            >
                              Atención
                            </button>
                          ) : null}
                          {quote && can('quotes:read') ? (
                            <Link
                              className="clinical-table-action clinical-table-action-icon"
                              data-action-id="CLINICAL-HOSPITALIZATION-QUOTE-VIEW"
                              href={`/quotes/${quote.id}`}
                              title="Ver cotización"
                              aria-label="Ver cotización"
                            >
                              <span aria-hidden="true">$</span>
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            detail="Prueba con otro nombre, documento o número de hospitalización."
            title="No encontramos hospitalizaciones"
          />
        )}
      </Panel>

      {careMessage ? (
        <p className="notice success" role="status">
          {careMessage}
        </p>
      ) : null}

      <Dialog
        description="Registra los accesos del paciente y asigna las cuentas de enfermería responsables de la atención."
        footer={
          <>
            <Button className="button-secondary" onClick={() => setCareCaseId(null)} type="button">
              Cancelar
            </Button>
            <Button disabled={careSaving} onClick={() => void saveCare()} type="button">
              {careSaving ? 'Guardando…' : 'Guardar atención'}
            </Button>
          </>
        }
        onClose={() => setCareCaseId(null)}
        open={Boolean(careCase)}
        title={`Atención clínica${careCase ? ` · ${careCase.id}` : ''}`}
      >
        <div className="form-grid" id="clinical-attention">
          <label className="full">
            Dispositivos / accesos
            <input
              onChange={(event) => setCareDevices(event.target.value)}
              placeholder="Ej.: catéter, sonda, acceso venoso"
              value={careDevices}
            />
            <span className="field-help">Separe varios elementos con comas.</span>
          </label>
          <fieldset className="full assignment-fieldset">
            <legend>Enfermeras asignadas para la atención</legend>
            <div className="assignment-option-grid">
              {nursingResources.map((resource) => (
                <label key={resource.id}>
                  <input
                    checked={careNurseIds.includes(resource.id)}
                    disabled={!resource.userId}
                    onChange={(event) =>
                      setCareNurseIds((current) =>
                        event.target.checked
                          ? [...new Set([...current, resource.id])]
                          : current.filter((id) => id !== resource.id),
                      )
                    }
                    type="checkbox"
                  />
                  <span>
                    <strong>{resource.displayName}</strong>
                    <small>{resource.userId ? resource.territory : 'Sin cuenta vinculada'}</small>
                  </span>
                </label>
              ))}
            </div>
            {!nursingResources.length ? (
              <p className="field-help">Primero registre recursos en Equipo de enfermería.</p>
            ) : null}
          </fieldset>
        </div>
      </Dialog>
    </div>
  );
}
