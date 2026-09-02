'use client';

import { Button, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useState } from 'react';

export default function FeesCatalogPage() {
  const [query, setQuery] = useState('');
  const queryDetail = query.trim()
    ? `No hay honorarios documentados para “${query.trim()}”.`
    : 'No existe una fuente autorizada de honorarios para este catálogo.';

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Items</p>
          <h1>Items / Honorarios</h1>
          <p>
            Superficie factual de solo lectura basada en CH15-E0094. No carga filas, ni define
            recursos elegibles, precios, impuestos, descuentos, Giftcard, liquidación o reglas clínicas.
          </p>
        </div>
        <div className="action-row">
          <Button aria-describedby="catalog-fees-export-help" className="button-secondary" data-action-id="CATALOG-FEES-EXPORT" disabled type="button">
            Excel
          </Button>
          <Button aria-describedby="catalog-fees-create-help" data-action-id="CATALOG-FEES-CREATE" disabled type="button">
            Nuevo
          </Button>
        </div>
      </header>

      <p className="field-help" id="catalog-fees-export-help">
        La exportación requiere columnas, minimización y autorización aprobadas.
      </p>
      <p className="field-help" id="catalog-fees-create-help">
        El alta requiere una fuente, recurso elegible, roles, campos, validación, auditoría y reglas financieras aprobadas.
      </p>

      <Panel>
        <div className="table-heading">
          <h2>Honorarios</h2>
          <StatusTag>0 registros</StatusTag>
        </div>
        <div className="table-controls">
          <label>
            Registros
            <select aria-label="Registros de honorarios por página" data-action-id="CATALOG-FEES-PAGE-SIZE" disabled value="50" onChange={() => undefined}>
              <option value="50">50</option>
            </select>
          </label>
          <label>
            Buscar honorarios
            <input data-action-id="CATALOG-FEES-SEARCH" onChange={(event) => setQuery(event.target.value)} value={query} />
          </label>
          <div className="action-row" aria-label="Paginación de honorarios">
            <Button data-action-id="CATALOG-FEES-PAGE-PREV" disabled type="button">Anterior</Button>
            <Button data-action-id="CATALOG-FEES-PAGE-NEXT" disabled type="button">Siguiente</Button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Acciones</th>
                <th>Código</th>
                <th>Nombre</th>
                <th>Impuesto</th>
                <th>Descuento</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6}>
                  <EmptyState detail={queryDetail} title="Sin honorarios documentados" />
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
