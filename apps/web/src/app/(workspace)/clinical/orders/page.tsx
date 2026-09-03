'use client';

import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { searchPatients } from '@analiza/domain';
import { useMemo, useState } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';

type PatientTab = 'ACTIVE' | 'INACTIVE';

const pageSize = 5;

function patientBirthDate(value: string | undefined) {
  return value ?? 'No documentada';
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
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Clínico · listado factual</p>
          <h1>Orden Médica</h1>
          <p>
            Pacientes y hospitalizaciones ya registradas, sin inferir órdenes, tratamientos ni
            estados clínicos.
          </p>
        </div>
      </header>

      <Panel>
        <div aria-label="Listado de Orden Médica" className="tab-row" role="tablist">
          <button
            aria-selected={tab === 'ACTIVE'}
            data-action-id="MEDICAL-ORDER-TAB-ACTIVE"
            onClick={() => selectTab('ACTIVE')}
            role="tab"
            type="button"
          >
            Activos
          </button>
          <button
            aria-selected={tab === 'INACTIVE'}
            data-action-id="MEDICAL-ORDER-TAB-INACTIVE"
            onClick={() => selectTab('INACTIVE')}
            role="tab"
            type="button"
          >
            Inactivos
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
        <p id="medical-order-undefined-tabs" role="status">
          Tratamientos con cambios y Actualizaciones permanecen deshabilitados: CH10-Q011 no define
          su unidad de versionado ni sus estados.
        </p>
        <div className="toolbar-row">
          <div>
            <span className="field-label">Registros</span>
            <span aria-label="Registros por página">{pageSize}</span>
          </div>
          <label className="search-label" htmlFor="medical-order-search">
            Buscar orden médica
            <input
              data-action-id="MEDICAL-ORDER-SEARCH"
              id="medical-order-search"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Nombre o cédula"
              type="search"
              value={query}
            />
          </label>
        </div>
      </Panel>

      <Panel>
        {loading ? (
          <p role="status">Cargando…</p>
        ) : visiblePatients.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Acciones</th>
                  <th scope="col">Nombre</th>
                  <th scope="col">Cédula</th>
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
                    <tr key={patient.id}>
                      <td>
                        <button
                          aria-expanded={menuOpen}
                          aria-label={`Acciones para ${patient.fullName}`}
                          className="icon-button"
                          data-action-id="MEDICAL-ORDER-MENU-OPEN"
                          onClick={() => setMenuPatientId(menuOpen ? null : patient.id)}
                          type="button"
                        >
                          ⋯
                        </button>
                        {menuOpen ? (
                          <div
                            aria-label={`Menú de ${patient.fullName}`}
                            className="row-action-menu"
                            role="menu"
                          >
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
                      </td>
                      <td>{patient.fullName}</td>
                      <td>{patient.documentId}</td>
                      <td>{patientBirthDate(patient.birthDate)}</td>
                      <td>
                        <StatusTag>No documentado</StatusTag>
                      </td>
                      <td>{hospitalization?.id ?? 'Sin hospitalización'}</td>
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
            detail="Ajuste la búsqueda o seleccione otra pestaña factual."
            title="No hay registros disponibles"
          />
        )}
        <p className="visually-hidden" id="medical-order-view-block">
          Ver Órdenes permanece bloqueado hasta definir el modelo y versionado de órdenes.
        </p>
        <p className="visually-hidden" id="medical-order-xpo-block">
          Registro XPO permanece bloqueado por CH10-Q012.
        </p>
        <div aria-label="Paginación" className="pagination">
          <Button
            data-action-id="MEDICAL-ORDER-PAGE-PREV"
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            type="button"
          >
            Anterior
          </Button>
          <span aria-current="page">{currentPage}</span>
          <Button
            data-action-id="MEDICAL-ORDER-PAGE-NEXT"
            disabled={currentPage === pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            type="button"
          >
            Siguiente
          </Button>
        </div>
      </Panel>

      <Dialog
        description="Elegir un tipo es visible en la evidencia; iniciar un documento clínico sigue bloqueado hasta definir datos, autorización y auditoría."
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
        <div className="page-stack">
          <Button disabled type="button">
            Orden Médica
          </Button>
          <Button disabled type="button">
            Tarjeta de medicamentos
          </Button>
          <p role="status">
            La creación clínica permanece bloqueada hasta contar con definiciones aprobadas.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
