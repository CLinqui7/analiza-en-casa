'use client';

import Link from 'next/link';
import { EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
import { searchPatients } from '@analiza/domain';
import { useAuth, useWorkspace } from '@/components/providers';

function durationLabel(startDate: string, endDate?: string) {
  if (!endDate) return 'En curso';
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 'No documentada';
  return `${Math.floor((end - start) / 86_400_000) + 1} día(s)`;
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
    label: 'Hospitalizaci\u00f3n',
    actionId: 'CLINICAL-HOSPITALIZATION-CASE-COLUMN-FILTER',
  },
  { key: 'triage', label: 'Triage', actionId: 'CLINICAL-HOSPITALIZATION-TRIAGE-COLUMN-FILTER' },
  { key: 'company', label: 'Empresa', actionId: 'CLINICAL-HOSPITALIZATION-COMPANY-COLUMN-FILTER' },
  {
    key: 'clinician',
    label: 'Cl\u00ednico',
    actionId: 'CLINICAL-HOSPITALIZATION-CLINICIAN-COLUMN-FILTER',
  },
  { key: 'start', label: 'Inicio', actionId: 'CLINICAL-HOSPITALIZATION-START-COLUMN-FILTER' },
  { key: 'end', label: 'Fin', actionId: 'CLINICAL-HOSPITALIZATION-END-COLUMN-FILTER' },
  {
    key: 'duration',
    label: 'Duraci\u00f3n',
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
  const { hospitalizations, patients, quotes } = useWorkspace();
  const { can } = useAuth();
  const [query, setQuery] = useState('');
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] =
    useState<Record<ClinicalColumn, string>>(emptyColumnFilters);
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

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Clínico</p>
          <h1>Hospitalización Clínica</h1>
          <p>
            Consulta de datos sintéticos disponibles. No asigna estado clínico, triage, activación
            ni transiciones asistenciales.
          </p>
        </div>
        <StatusTag>{entries.length} registros</StatusTag>
      </header>
      <Panel>
        <div className="form-grid form-grid-compact" aria-describedby="clinical-filter-boundary">
          <label>
            Estado clínico
            <select
              aria-label="Estado clínico"
              data-action-id="CLINICAL-HOSPITALIZATION-STATUS-FILTER"
              disabled
              value=""
            >
              <option value="">Sin configuración aprobada</option>
            </select>
          </label>
          <label>
            Activado por
            <select
              aria-label="Activado por"
              data-action-id="CLINICAL-HOSPITALIZATION-ACTIVATOR-FILTER"
              disabled
              value=""
            >
              <option value="">Sin configuración aprobada</option>
            </select>
          </label>
          <label>
            Tipo de servicio
            <select
              aria-label="Tipo de servicio"
              data-action-id="CLINICAL-HOSPITALIZATION-SERVICE-FILTER"
              disabled
              value=""
            >
              <option value="">Sin catálogo aprobado</option>
            </select>
          </label>
          <label>
            Tipo de atención
            <select
              aria-label="Tipo de atención"
              data-action-id="CLINICAL-HOSPITALIZATION-CARE-FILTER"
              disabled
              value=""
            >
              <option value="">Sin catálogo aprobado</option>
            </select>
          </label>
        </div>
        <div className="form-grid form-grid-compact" aria-describedby="clinical-filter-boundary">
          <label>
            Activos
            <select
              aria-label="Activos"
              data-action-id="CLINICAL-HOSPITALIZATION-ACTIVES-FILTER"
              disabled
              value=""
            >
              <option value="">Sin estado activo aprobado</option>
            </select>
          </label>
          <button
            aria-describedby="clinical-filter-boundary"
            data-action-id="CLINICAL-HOSPITALIZATION-FILTER-APPLY"
            disabled
            type="button"
          >
            Aplicar
          </button>
        </div>
        <p className="notice" id="clinical-filter-boundary" role="status">
          Los filtros clínicos observados requieren catálogos, roles y máquina de estados aprobados
          (CH09-Q002/Q004); por eso no se aplican como reglas locales.
        </p>
        <label className="search-label" htmlFor="clinical-case-search">
          Buscar hospitalización o paciente
        </label>
        <input
          data-action-id="CLINICAL-HOSPITALIZATION-SEARCH"
          id="clinical-case-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre, documento, teléfono u hospitalización"
          type="search"
          value={query}
        />
      </Panel>
      <Panel>
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Acciones</th>
                  <th>Paciente</th>
                  <th>DUI/NIT</th>
                  <th>Hospitalización</th>
                  <th>Triage</th>
                  <th>Empresa</th>
                  <th>Clínico</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Duración</th>
                </tr>
                <tr className="table-filter-row">
                  <th scope="col" />
                  {clinicalColumns.map(({ key, label, actionId }) => (
                    <th key={key} scope="col">
                      <input
                        aria-label={`Filtrar ${label}`}
                        data-action-id={actionId}
                        onChange={(event) =>
                          setColumnFilters((current) => ({ ...current, [key]: event.target.value }))
                        }
                        placeholder={label}
                        type="search"
                        value={columnFilters[key]}
                      />
                    </th>
                  ))}
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
                  const menuOpen = openActionMenuId === hospitalization.id;
                  return (
                    <tr key={hospitalization.id}>
                      <td>
                        <div className="clinical-row-actions">
                          <button
                            aria-controls={`clinical-hospitalization-actions-${hospitalization.id}`}
                            aria-expanded={menuOpen}
                            aria-label="Acciones de hospitalización"
                            className="clinical-row-menu-toggle"
                            data-action-id="CLINICAL-HOSPITALIZATION-ACTIONS-MENU"
                            onClick={() =>
                              setOpenActionMenuId((current) =>
                                current === hospitalization.id ? null : hospitalization.id,
                              )
                            }
                            type="button"
                          >
                            <span aria-hidden="true">⋯</span>
                          </button>
                          {menuOpen ? (
                            <div
                              aria-describedby={`clinical-hospitalization-boundary-${hospitalization.id}`}
                              className="clinical-row-menu"
                              id={`clinical-hospitalization-actions-${hospitalization.id}`}
                              role="menu"
                            >
                              {quote && can('quotes:read') ? (
                                <Link
                                  data-action-id="CLINICAL-HOSPITALIZATION-QUOTE-VIEW"
                                  href={`/quotes/${quote.id}`}
                                  role="menuitem"
                                >
                                  Ver cotizaciones
                                </Link>
                              ) : null}
                              <button
                                data-action-id="CLINICAL-HOSPITALIZATION-PROFILE-OPEN"
                                disabled
                                role="menuitem"
                                type="button"
                              >
                                Perfil clínico
                              </button>
                              <button
                                data-action-id="CLINICAL-HOSPITALIZATION-RELIEF-DOCUMENT-OPEN"
                                disabled
                                role="menuitem"
                                type="button"
                              >
                                Doc de Relevos
                              </button>
                              <button
                                data-action-id="CLINICAL-HOSPITALIZATION-READMISSION-OPEN"
                                disabled
                                role="menuitem"
                                type="button"
                              >
                                Reingresos
                              </button>
                              <button
                                data-action-id="CLINICAL-HOSPITALIZATION-REINFECTION-OPEN"
                                disabled
                                role="menuitem"
                                type="button"
                              >
                                Reinfecciones
                              </button>
                              <button
                                data-action-id="CLINICAL-HOSPITALIZATION-ULCERATION-OPEN"
                                disabled
                                role="menuitem"
                                type="button"
                              >
                                Ulceraciones
                              </button>
                              <button
                                data-action-id="CLINICAL-HOSPITALIZATION-NEAR-MISS-OPEN"
                                disabled
                                role="menuitem"
                                type="button"
                              >
                                Near miss
                              </button>
                              <p
                                className="field-help"
                                id={`clinical-hospitalization-boundary-${hospitalization.id}`}
                              >
                                Perfil, documento y eventos clínicos requieren modelo, autorización,
                                auditoría y definiciones aprobadas (CH09-Q006); no se inician desde
                                este listado.
                              </p>
                            </div>
                          ) : null}
                        </div>
                        <Link
                          className="text-link"
                          data-action-id="CLINICAL-HOSPITALIZATION-DETAIL"
                          href={`/hospitalizations/${hospitalization.id}`}
                        >
                          Ver hospitalización
                        </Link>
                      </td>
                      <td>{patient?.fullName ?? 'No disponible'}</td>
                      <td>{patient?.documentId ?? 'No documentado'}</td>
                      <td>
                        <code>{hospitalization.id}</code>
                      </td>
                      <td>{patient?.triageStatus ?? 'No documentado'}</td>
                      <td>{patient?.company ?? 'No documentada'}</td>
                      <td>No documentado</td>
                      <td>{hospitalization.startDate}</td>
                      <td>{hospitalization.endDate ?? 'En curso'}</td>
                      <td>{durationLabel(hospitalization.startDate, hospitalization.endDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
        {!entries.length && (
          <EmptyState
            detail="Ajuste la búsqueda. Los filtros clínicos permanecen bloqueados hasta contar con reglas aprobadas."
            title="Sin hospitalizaciones coincidentes"
          />
        )}
      </Panel>
    </div>
  );
}
