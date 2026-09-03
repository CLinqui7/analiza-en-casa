'use client';

import { Button, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useState } from 'react';

export default function ServicesCatalogPage() {
  const [query, setQuery] = useState('');
  const queryDetail = query.trim()
    ? `No hay servicios documentados para “${query.trim()}”.`
    : 'No existe una fuente autorizada de servicios para este catálogo.';

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Items</p>
          <h1>Items / Servicios</h1>
          <p>
            Superficie factual de solo lectura basada en CH15-E0122. No carga filas, ni define tipos
            de producto, categorías, precios, impuestos, descuentos o reglas clínicas o financieras.
          </p>
        </div>
        <div className="action-row">
          <Button
            aria-describedby="catalog-services-export-help"
            className="button-secondary"
            data-action-id="CATALOG-SERVICES-EXPORT"
            disabled
            type="button"
          >
            Excel
          </Button>
          <Button
            aria-describedby="catalog-services-create-help"
            data-action-id="CATALOG-SERVICES-CREATE"
            disabled
            type="button"
          >
            Nuevo
          </Button>
        </div>
      </header>

      <p className="field-help" id="catalog-services-export-help">
        La exportación requiere columnas, minimización y autorización aprobadas.
      </p>
      <p className="field-help" id="catalog-services-create-help">
        El alta requiere una fuente, roles, campos, validación, auditoría y reglas de catálogo
        aprobadas.
      </p>

      <Panel>
        <div className="table-heading">
          <h2>Servicios</h2>
          <StatusTag>0 registros</StatusTag>
        </div>
        <div className="table-controls">
          <label>
            Registros
            <select
              aria-label="Registros de servicios por página"
              data-action-id="CATALOG-SERVICES-PAGE-SIZE"
              disabled
              value="50"
              onChange={() => undefined}
            >
              <option value="50">50</option>
            </select>
          </label>
          <label>
            Buscar servicios
            <input
              data-action-id="CATALOG-SERVICES-SEARCH"
              onChange={(event) => setQuery(event.target.value)}
              value={query}
            />
          </label>
          <div className="action-row" aria-label="Paginación de servicios">
            <Button data-action-id="CATALOG-SERVICES-PAGE-PREV" disabled type="button">
              Anterior
            </Button>
            <Button data-action-id="CATALOG-SERVICES-PAGE-NEXT" disabled type="button">
              Siguiente
            </Button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Acciones</th>
                <th>Código</th>
                <th>Nombre</th>
                <th>Tipo de producto</th>
                <th>Categoría</th>
                <th>Impuesto</th>
                <th>Descuento</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={8}>
                  <EmptyState detail={queryDetail} title="Sin servicios documentados" />
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
