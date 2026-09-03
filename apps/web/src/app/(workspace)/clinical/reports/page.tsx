'use client';

import { EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';

const reportColumns = [
  'Acciones',
  'Cédula',
  'Nombre',
  'Empresa',
  'Hospitalización',
  'Período',
  'Auditoría',
  'Triage',
  'Estatus',
];

const reportSections = [
  {
    id: 'information',
    label: 'Información Principal',
    actionId: 'HEALTH-REPORT-SECTION-INFORMATION',
  },
  { id: 'clinical', label: 'Evaluación Clínica', actionId: 'HEALTH-REPORT-SECTION-CLINICAL' },
  { id: 'medical', label: 'Atención Médica', actionId: 'HEALTH-REPORT-SECTION-MEDICAL' },
  {
    id: 'treatments',
    label: 'Tratamientos y Órdenes',
    actionId: 'HEALTH-REPORT-SECTION-TREATMENTS',
  },
  { id: 'events', label: 'Eventos Clínicos', actionId: 'HEALTH-REPORT-SECTION-EVENTS' },
  { id: 'evidence', label: 'Evidencia y Documentos', actionId: 'HEALTH-REPORT-SECTION-EVIDENCE' },
] as const;

type ReportSectionId = (typeof reportSections)[number]['id'];

export default function HealthReportPage() {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<ReportSectionId>('information');
  const activeSection =
    reportSections.find((section) => section.id === selectedSection) ?? reportSections[0];

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Clínico</p>
          <h1>Reporte de salud</h1>
          <p>
            Superficie factual de solo lectura; no muestra registros clínicos ni identificatorios.
          </p>
        </div>
        <StatusTag tone="warning">Fuente pendiente</StatusTag>
      </header>

      <Panel>
        <p className="notice" id="health-report-data-boundary" role="status">
          El reporte observado requiere una fuente autorizada por organización, roles, minimización
          de campos, filtros, auditoría de acceso y retención aprobados (CH16-Q008). La ruta clínica
          y los datos de otros módulos no se reutilizan como autorización.
        </p>
        <label className="search-label" htmlFor="health-report-search">
          Buscar en reporte de salud
        </label>
        <input
          aria-describedby="health-report-data-boundary"
          data-action-id="HEALTH-REPORT-SEARCH"
          disabled
          id="health-report-search"
          placeholder="Fuente de reportes pendiente de aprobación"
          readOnly
          type="search"
          value=""
        />
      </Panel>

      <Panel>
        <section aria-labelledby="health-report-actions-title">
          <h2 id="health-report-actions-title">Acciones de hospitalización</h2>
          <p className="notice" id="health-report-actions-boundary" role="status">
            El menú observado se conserva sin contexto de hospitalización. No abre ni consulta
            historia clínica, Claims, visitas, notas, auditorías o Registro XPO hasta contar con la
            relación, autorización y auditoría aprobadas (CH17-Q007).
          </p>
          <button
            aria-controls="health-report-hospitalization-actions"
            aria-describedby="health-report-actions-boundary"
            aria-expanded={actionsOpen}
            data-action-id="HEALTH-REPORT-HOSPITALIZATION-ACTIONS-OPEN"
            onClick={() => setActionsOpen((open) => !open)}
            type="button"
          >
            Acciones de hospitalización
          </button>
          {actionsOpen ? (
            <ul
              aria-label="Acciones observadas de hospitalización"
              className="action-menu-surface"
              id="health-report-hospitalization-actions"
              role="menu"
            >
              <li aria-disabled="true" role="menuitem">
                Historia clínica
              </li>
              <li aria-disabled="true" role="menuitem">
                Reporte Claims
              </li>
              <li aria-disabled="true" role="menuitem">
                Ver visitas
              </li>
              <li aria-disabled="true" role="menuitem">
                Notas de servicio
              </li>
              <li aria-disabled="true" role="menuitem">
                Reporte de salud
              </li>
              <li aria-disabled="true" role="menuitem">
                Auditorías
              </li>
              <li aria-disabled="true" role="menuitem">
                Registro XPO
              </li>
            </ul>
          ) : null}
        </section>
      </Panel>

      <Panel>
        <section aria-labelledby="health-report-sections-title">
          <h2 id="health-report-sections-title">Secciones observadas del reporte</h2>
          <p className="notice" id="health-report-sections-boundary" role="status">
            Las pestañas reproducen sólo la navegación visible. No cargan Información Principal,
            Evaluación Clínica, Atención Médica, Tratamientos y Órdenes, Eventos Clínicos ni
            Evidencia y Documentos porque CH16-Q008 no autoriza una fuente ni campos de reporte.
          </p>
          <div aria-label="Secciones observadas del reporte de salud" role="tablist">
            {reportSections.map((section) => (
              <button
                aria-controls="health-report-active-section"
                aria-describedby="health-report-sections-boundary"
                aria-selected={selectedSection === section.id}
                data-action-id={section.actionId}
                id={`health-report-tab-${section.id}`}
                key={section.id}
                onClick={() => setSelectedSection(section.id)}
                role="tab"
                type="button"
              >
                {section.label}
              </button>
            ))}
          </div>
          <div
            aria-labelledby={`health-report-tab-${activeSection.id}`}
            id="health-report-active-section"
            role="tabpanel"
          >
            <EmptyState
              detail="No se consulta ni reutiliza información de pacientes, hospitalizaciones, seguros, datos clínicos, auditorías o documentos."
              title={`${activeSection.label}: sin contenido autorizado`}
            />
          </div>
        </section>
      </Panel>

      <Panel>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {reportColumns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={reportColumns.length}>
                  <EmptyState
                    detail="No se consultan ni se copian pacientes, hospitalizaciones, signos vitales ni auditorías hasta contar con el contrato aprobado."
                    title="Sin registros autorizados para mostrar"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <nav aria-label="Paginación del reporte de salud" className="pagination">
          <button
            aria-describedby="health-report-data-boundary"
            data-action-id="HEALTH-REPORT-PAGE-PREV"
            disabled
            type="button"
          >
            Anterior
          </button>
          <span aria-current="page">1</span>
          <button
            aria-describedby="health-report-data-boundary"
            data-action-id="HEALTH-REPORT-PAGE-NEXT"
            disabled
            type="button"
          >
            Siguiente
          </button>
        </nav>
      </Panel>
    </div>
  );
}
