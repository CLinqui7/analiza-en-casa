'use client';

import { Button, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useState } from 'react';

export default function DiscountsCatalogPage() {
  const [query, setQuery] = useState('');
  const queryDetail = query.trim()
    ? `No hay perfiles de descuento documentados para “${query.trim()}”.`
    : 'No existe una fuente autorizada de perfiles de descuento para esta matriz.';

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Items</p>
          <h1>Descuentos</h1>
          <p>
            Superficie factual de solo lectura basada en la evidencia de Descuentos de CH15 y CH16.
            No carga perfiles ni define categorías, porcentajes, cálculos, precios, impuestos o
            efectos aguas abajo.
          </p>
        </div>
        <div className="action-row">
          <Button
            aria-describedby="catalog-discounts-export-help"
            className="button-secondary"
            data-action-id="CATALOG-DISCOUNTS-EXPORT"
            disabled
            type="button"
          >
            Excel
          </Button>
          <Button
            aria-describedby="catalog-discounts-create-help"
            data-action-id="CATALOG-DISCOUNTS-CREATE"
            disabled
            type="button"
          >
            Nuevo
          </Button>
        </div>
      </header>

      <p className="field-help" id="catalog-discounts-export-help">
        La exportación requiere columnas, minimización y autorización aprobadas.
      </p>
      <p className="field-help" id="catalog-discounts-create-help">
        La creación requiere fuente, categorías, reglas, roles, validación, auditoría y efectos
        aprobados.
      </p>

      <Panel>
        <div className="table-heading">
          <h2>Perfiles de descuento</h2>
          <StatusTag>0 registros</StatusTag>
        </div>
        <div className="table-controls">
          <label>
            Registros
            <select
              aria-label="Registros de descuentos por página"
              data-action-id="CATALOG-DISCOUNTS-PAGE-SIZE"
              disabled
              value="10"
              onChange={() => undefined}
            >
              <option value="10">10</option>
            </select>
          </label>
          <label>
            Buscar descuentos
            <input
              data-action-id="CATALOG-DISCOUNTS-SEARCH"
              onChange={(event) => setQuery(event.target.value)}
              value={query}
            />
          </label>
          <div className="action-row" aria-label="Paginación de descuentos">
            <Button data-action-id="CATALOG-DISCOUNTS-PAGE-PREV" disabled type="button">
              Anterior
            </Button>
            <Button data-action-id="CATALOG-DISCOUNTS-PAGE-NEXT" disabled type="button">
              Siguiente
            </Button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Acciones</th>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Servicios</th>
                <th>Laboratorios</th>
                <th>Medicamentos</th>
                <th>Equipos</th>
                <th>Insumos</th>
                <th>Honorarios</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={9}>
                  <EmptyState detail={queryDetail} title="Sin perfiles de descuento documentados" />
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
