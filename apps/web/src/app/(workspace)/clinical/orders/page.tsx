'use client';

import { searchPatients } from '@analiza/domain';
import { Button, Dialog, EmptyState, StatusTag } from '@analiza/ui';
import { useMemo, useState } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';

type PatientTab = 'ACTIVE' | 'INACTIVE';

const pageSize = 5;

function patientBirthDate(value: string | undefined) {
  return value ?? 'No documentada';
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function MedicalOrdersPage() {
  const { can } = useAuth();
  const { hospitalizations, loading, patients } = useWorkspace();
  const [tab, setTab] = useState<PatientTab>('ACTIVE');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [menuPatientId, setMenuPatientId] = useState<string | null>(null);
  const [isDocumentChoiceOpen, setDocumentChoiceOpen] = useState(false);

  const matchingPatients = useMemo(
    () => searchPatients(patients, query).filter((patient) => patient.status === tab),
    [patients, query, tab],
  );
  const activePatients = patients.filter((patient) => patient.status === 'ACTIVE').length;
  const inactivePatients = patients.length - activePatients;
  const hospitalizedPatients = new Set(hospitalizations.map((item) => item.patientId)).size;
  const pageCount = Math.max(1, Math.ceil(matchingPatients.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visiblePatients = matchingPatients.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function selectTab(next: PatientTab) {
    setTab(next);
    setPage(1);
    setMenuPatientId(null);
  }

  return (
    <div className="page-stack medical-orders-page">
      <header className="medical-orders-hero">
        <div className="medical-orders-hero-copy">
          <span className="medical-orders-hero-icon" aria-hidden="true">
            Rx
          </span>
          <div>
            <p className="eyebrow">Gestión clínica</p>
            <h1>Orden Médica</h1>
            <p>
              Consulta pacientes y hospitalizaciones registradas para organizar la documentación
              médica desde un solo listado.
            </p>
          </div>
        </div>
        <div className="medical-orders-summary" aria-label="Resumen de pacientes">
          <div>
            <span>Activos</span>
            <strong>{activePatients}</strong>
          </div>
          <div>
            <span>Inactivos</span>
            <strong>{inactivePatients}</strong>
          </div>
          <div>
            <span>Hospitalizados</span>
            <strong>{hospitalizedPatients}</strong>
          </div>
        </div>
      </header>

      <section className="medical-orders-controls" aria-labelledby="medical-orders-filters">
        <div className="medical-orders-controls-topline">
          <div>
            <p className="eyebrow">Directorio clínico</p>
            <h2 id="medical-orders-filters">Filtra los pacientes</h2>
          </div>
          <span className="medical-orders-results-count">
            {matchingPatients.length} {matchingPatients.length === 1 ? 'resultado' : 'resultados'}
          </span>
        </div>

        <div className="medical-orders-filter-row">
          <div
            aria-label="Listado de Orden Médica"
            className="tab-row medical-orders-tabs"
            role="tablist"
          >
            <button
              aria-selected={tab === 'ACTIVE'}
              data-action-id="MEDICAL-ORDER-TAB-ACTIVE"
              onClick={() => selectTab('ACTIVE')}
              role="tab"
              type="button"
            >
              Activos <span aria-hidden="true">{activePatients}</span>
            </button>
            <button
              aria-selected={tab === 'INACTIVE'}
              data-action-id="MEDICAL-ORDER-TAB-INACTIVE"
              onClick={() => selectTab('INACTIVE')}
              role="tab"
              type="button"
            >
              Inactivos <span aria-hidden="true">{inactivePatients}</span>
            </button>
            <button
              aria-describedby="medical-order-undefined-tabs"
              data-action-id="MEDICAL-ORDER-TAB-CHANGES"
              disabled
              role="tab"
              type="button"
            >
              Tratamientos con cambios
            </button>
            <button
              aria-describedby="medical-order-undefined-tabs"
              data-action-id="MEDICAL-ORDER-TAB-UPDATES"
              disabled
              role="tab"
              type="button"
            >
              Actualizaciones
            </button>
          </div>

          <label className="medical-orders-search" htmlFor="medical-order-search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Buscar orden médica</span>
            <input
              data-action-id="MEDICAL-ORDER-SEARCH"
              id="medical-order-search"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nombre o DUI"
              type="search"
              value={query}
            />
          </label>
        </div>

        <details className="medical-orders-upcoming">
          <summary>
            <span>Funciones en preparación</span>
            <span aria-hidden="true">⌄</span>
          </summary>
          <div>
            <p id="medical-order-undefined-tabs" role="status">
              Tratamientos con cambios y Actualizaciones se habilitarán cuando esté aprobado su
              modelo de versiones y estados.
            </p>
            <div className="medical-orders-upcoming-actions">
              <Button
                aria-describedby="medical-order-view-block"
                data-action-id="MEDICAL-ORDER-VIEW"
                disabled
                type="button"
              >
                Ver órdenes
              </Button>
              <Button
                aria-describedby="medical-order-xpo-block"
                data-action-id="MEDICAL-ORDER-XPO"
                disabled
                type="button"
              >
                Registro XPO
              </Button>
            </div>
          </div>
        </details>
      </section>

      <section
        className="medical-orders-directory"
        aria-labelledby="medical-orders-directory-title"
      >
        <div className="medical-orders-directory-heading">
          <div>
            <p className="eyebrow">Pacientes registrados</p>
            <h2 id="medical-orders-directory-title">
              {tab === 'ACTIVE' ? 'Pacientes activos' : 'Pacientes inactivos'}
            </h2>
            <p>Selecciona las acciones disponibles para preparar la documentación del paciente.</p>
          </div>
          <span>{pageSize} por página</span>
        </div>

        {loading ? (
          <div className="medical-orders-loading" role="status">
            <span />
            Cargando pacientes…
          </div>
        ) : visiblePatients.length ? (
          <div className="table-wrap medical-orders-table-wrap" tabIndex={0}>
            <table className="medical-orders-table">
              <thead>
                <tr>
                  <th scope="col">Acciones</th>
                  <th scope="col">Nombre</th>
                  <th scope="col">DUI</th>
                  <th scope="col">Fecha Nac.</th>
                  <th scope="col">Triage</th>
                  <th scope="col">Hospitalización</th>
                  <th scope="col">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {visiblePatients.map((patient) => {
                  const hospitalization = hospitalizations.find(
                    (candidate) => candidate.patientId === patient.id,
                  );
                  const menuOpen = menuPatientId === patient.id;
                  return (
                    <tr className={menuOpen ? 'has-open-menu' : undefined} key={patient.id}>
                      <td>
                        <div className="medical-order-row-actions">
                          <button
                            aria-expanded={menuOpen}
                            aria-label={`Acciones para ${patient.fullName}`}
                            className="medical-order-menu-button"
                            data-action-id="MEDICAL-ORDER-MENU-OPEN"
                            onClick={() => setMenuPatientId(menuOpen ? null : patient.id)}
                            type="button"
                          >
                            <span aria-hidden="true">•••</span>
                          </button>
                          {menuOpen ? (
                            <div
                              aria-label={`Menú de ${patient.fullName}`}
                              className="row-action-menu medical-order-action-menu"
                              role="menu"
                            >
                              <div className="medical-order-action-menu-heading">
                                <span>{initials(patient.fullName)}</span>
                                <div>
                                  <strong>{patient.fullName}</strong>
                                  <small>{patient.documentId}</small>
                                </div>
                              </div>
                              {can('medical-orders:write') ? (
                                <Button
                                  data-action-id="MEDICAL-ORDER-CREATE"
                                  onClick={() => setDocumentChoiceOpen(true)}
                                  type="button"
                                >
                                  Nuevo
                                </Button>
                              ) : null}
                              <Button
                                aria-describedby="medical-order-view-block"
                                data-action-id="MEDICAL-ORDER-VIEW"
                                disabled
                                type="button"
                              >
                                Ver Órdenes
                              </Button>
                              <Button
                                aria-describedby="medical-order-xpo-block"
                                data-action-id="MEDICAL-ORDER-XPO"
                                disabled
                                type="button"
                              >
                                Registro XPO
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="medical-order-patient">
                          <span aria-hidden="true">{initials(patient.fullName)}</span>
                          <div>
                            <strong>{patient.fullName}</strong>
                            <small>{patient.phone ?? 'Sin teléfono registrado'}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="medical-order-document">{patient.documentId}</span>
                      </td>
                      <td>{patientBirthDate(patient.birthDate)}</td>
                      <td>
                        <StatusTag>No documentado</StatusTag>
                      </td>
                      <td>
                        {hospitalization ? (
                          <code className="medical-order-case">{hospitalization.id}</code>
                        ) : (
                          <span className="medical-order-muted">Sin hospitalización</span>
                        )}
                      </td>
                      <td>
                        <StatusTag tone={patient.status === 'ACTIVE' ? 'success' : 'neutral'}>
                          {patient.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                        </StatusTag>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            detail="Prueba con otro nombre, documento o estado del paciente."
            title="No hay registros disponibles"
          />
        )}

        <p className="sr-only" id="medical-order-view-block">
          Ver Órdenes permanece bloqueado hasta definir el modelo y versionado de órdenes.
        </p>
        <p className="sr-only" id="medical-order-xpo-block">
          Registro XPO permanece bloqueado por CH10-Q012.
        </p>
        <div
          aria-label="Paginación de Orden Médica"
          className="pagination medical-orders-pagination"
        >
          <Button
            className="button-secondary"
            data-action-id="MEDICAL-ORDER-PAGE-PREV"
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            type="button"
          >
            Anterior
          </Button>
          <span aria-current="page">
            Página <strong>{currentPage}</strong> de {pageCount}
          </span>
          <Button
            className="button-secondary"
            data-action-id="MEDICAL-ORDER-PAGE-NEXT"
            disabled={currentPage === pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            type="button"
          >
            Siguiente
          </Button>
        </div>
      </section>

      <Dialog
        description="Selecciona el tipo de documento que necesitas preparar para este paciente."
        footer={
          <Button
            className="button-secondary"
            onClick={() => setDocumentChoiceOpen(false)}
            type="button"
          >
            Cerrar
          </Button>
        }
        onClose={() => setDocumentChoiceOpen(false)}
        open={isDocumentChoiceOpen}
        title="¿Qué quieres crear?"
      >
        <div className="medical-order-document-options">
          <Button disabled type="button">
            <span aria-hidden="true">Rx</span>
            <span>
              <strong>Orden Médica</strong>
              <small>Disponible al aprobar el contrato clínico.</small>
            </span>
          </Button>
          <Button disabled type="button">
            <span aria-hidden="true">▤</span>
            <span>
              <strong>Tarjeta de medicamentos</strong>
              <small>Requiere reglas aprobadas de autorización y dosis.</small>
            </span>
          </Button>
          <p role="status">
            La creación clínica permanece bloqueada hasta contar con definiciones aprobadas.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
