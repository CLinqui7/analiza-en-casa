'use client';

import { Button, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useState } from 'react';

export default function MedicationCatalogPage() {
  const [query, setQuery] = useState('');
  const queryDetail = query.trim()
    ? `No hay medicamentos documentados para “${query.trim()}”.`
    : 'No existe una fuente autorizada de medicamentos para este catálogo.';

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Items</p>
          <h1>Items / Medicamentos</h1>
          <p>
            Superficie factual de solo lectura basada en CH15-E0046. No carga filas, ni define
            identidad farmacéutica, precios, impuestos, descuentos, lotes, estados o reglas
            clínicas.
          </p>
        </div>
        <div className="action-row">
          <Button
            aria-describedby="catalog-medications-export-help"
            className="button-secondary"
            data-action-id="CATALOG-MEDICATIONS-EXPORT"
            disabled
            type="button"
          >
            Excel
          </Button>
          <Button
            aria-describedby="catalog-medications-create-help"
            data-action-id="CATALOG-MEDICATIONS-CREATE"
            disabled
            type="button"
          >
            Nuevo
          </Button>
        </div>
      </header>

      <p className="field-help" id="catalog-medications-export-help">
        La exportación requiere columnas, minimización y autorización aprobadas.
      </p>
      <p className="field-help" id="catalog-medications-create-help">
        El alta requiere catálogo fuente, roles, campos, validación, auditoría y reglas clínicas
        aprobadas.
      </p>

      <Panel>
        <div className="table-heading">
          <h2>Medicamentos</h2>
          <StatusTag>0 registros</StatusTag>
        </div>
        <div className="table-controls">
          <label>
            Registros
            <select
              aria-label="Registros de medicamentos por página"
              data-action-id="CATALOG-MEDICATIONS-PAGE-SIZE"
              disabled
              value="50"
              onChange={() => undefined}
            >
              <option value="50">50</option>
            </select>
          </label>
          <label>
            Buscar medicamentos
            <input
              data-action-id="CATALOG-MEDICATIONS-SEARCH"
              onChange={(event) => setQuery(event.target.value)}
              value={query}
            />
          </label>
          <div className="action-row" aria-label="Paginación de medicamentos">
            <Button data-action-id="CATALOG-MEDICATIONS-PAGE-PREV" disabled type="button">
              Anterior
            </Button>
            <Button data-action-id="CATALOG-MEDICATIONS-PAGE-NEXT" disabled type="button">
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
                <th>Impuesto</th>
                <th>Descuento</th>
                <th>Lotes</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7}>
                  <EmptyState detail={queryDetail} title="Sin medicamentos documentados" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Link
        className="button button-secondary"
        data-action-id="CATAL-MEDICATIONS-BACK"
        href="/catalogs"
      >
        Volver a Catálogos
      </Link>
    </div>
  );
}
