'use client';

import { EmptyState, Panel, StatusTag } from '@analiza/ui';

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

export default function HealthReportPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Clínico</p>
          <h1>Reporte de salud</h1>
          <p>Superficie factual de solo lectura; no muestra registros clínicos ni identificatorios.</p>
        </div>
        <StatusTag tone="warning">Fuente pendiente</StatusTag>
      </header>

      <Panel>
        <p className="notice" id="health-report-data-boundary" role="status">
          El reporte observado requiere una fuente autorizada por organización, roles, minimización de
          campos, filtros, auditoría de acceso y retención aprobados (CH16-Q008). La ruta clínica y
          los datos de otros módulos no se reutilizan como autorización.
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
