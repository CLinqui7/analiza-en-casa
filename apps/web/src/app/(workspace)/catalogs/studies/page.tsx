'use client';

import { Button, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useState } from 'react';

export default function DiagnosticStudiesCatalogPage() {
  const [query, setQuery] = useState('');
  const queryDetail = query.trim()
    ? `No hay estudios diagnósticos documentados para “${query.trim()}”.`
    : 'No existe una fuente autorizada de estudios diagnósticos para este catálogo.';

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Items</p>
          <h1>Items / Estudios Dx</h1>
          <p>
            Superficie factual de solo lectura basada en CH15-E0084. No carga filas, ni define
            fuente, precios, impuestos, descuentos, estados, reglas clínicas o comportamiento de escritura.
          </p>
        </div>
        <div className="action-row">
          <Button aria-describedby="catalog-studies-export-help" className="button-secondary" data-action-id="CATALOG-STUDIES-EXPORT" disabled type="button">
            Excel
          </Button>
          <Button aria-describedby="catalog-studies-create-help" data-action-id="CATALOG-STUDIES-CREATE" disabled type="button">
            Nuevo
          </Button>
        </div>
      </header>

      <p className="field-help" id="catalog-studies-export-help">
        La exportación requiere columnas, minimización y autorización aprobadas.
      </p>
      <p className="field-help" id="catalog-studies-create-help">
        El alta requiere fuente, roles, campos, validación, auditoría y reglas clínicas aprobadas.
      </p>

      <Panel>
        <div className="table-heading">
          <h2>Estudios Dx</h2>
          <StatusTag>0 registros</StatusTag>
        </div>
        <div className="table-controls">
          <label>
            Registros
            <select aria-label="Registros de estudios por página" data-action-id="CATALOG-STUDIES-PAGE-SIZE" disabled value="50" onChange={() => undefined}>
              <option value="50">50</option>
            </select>
          </label>
          <label>
            Buscar estudios diagnósticos
            <input data-action-id="CATALOG-STUDIES-SEARCH" onChange={(event) => setQuery(event.target.value)} value={query} />
          </label>
          <div className="action-row" aria-label="Paginación de estudios diagnósticos">
            <Button data-action-id="CATALOG-STUDIES-PAGE-PREV" disabled type="button">Anterior</Button>
            <Button data-action-id="CATALOG-STUDIES-PAGE-NEXT" disabled type="button">Siguiente</Button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Acciones</th>
                <th>Código</th>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Impuesto</th>
                <th>Descuento</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7}>
                  <EmptyState detail={queryDetail} title="Sin estudios diagnósticos documentados" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Link className="button button-secondary" href="/catalogs">
        Volver a Catálogos
      </Link>
    </div>
  );
}
