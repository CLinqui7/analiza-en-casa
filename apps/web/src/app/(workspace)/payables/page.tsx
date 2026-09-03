'use client';

import { Button, EmptyState, Panel } from '@analiza/ui';
import { useState } from 'react';

export default function PayablesPage() {
  const [query, setQuery] = useState('');

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Financiero · lectura sola</p>
          <h1>Cuentas por pagar</h1>
          <p>
            Resumen factual de la superficie observada. No genera planillas, pagos, reclamos ni
            movimientos financieros.
          </p>
        </div>
      </header>
      <div aria-label="Pestañas de cuentas por pagar" className="tabs" role="tablist">
        <button
          aria-selected="true"
          className="tab active"
          data-action-id="PAYABLES-SUMMARY-TAB"
          role="tab"
          type="button"
        >
          Resumen
        </button>
        <button
          aria-describedby="payables-service-payments-help"
          className="tab"
          data-action-id="PAYABLES-SERVICE-PAYMENTS-TAB"
          disabled
          role="tab"
          type="button"
        >
          Pagos de Servicio
        </button>
      </div>
      <p className="field-help" id="payables-service-payments-help">
        El listado y sus estados requieren la definición de pago, visita y permisos
        (CH12-Q001/Q002/Q003).
      </p>
      <Panel>
        <div className="table-heading">
          <div>
            <h2>Facturas</h2>
            <p className="field-help">No hay facturas sintéticas documentadas para este resumen.</p>
          </div>
          <div className="action-row">
            <Button
              aria-describedby="payables-financial-actions-help"
              data-action-id="PAYABLES-STATEMENT-GENERATE"
              disabled
              type="button"
            >
              Generar planilla
            </Button>
            <Button
              aria-describedby="payables-financial-actions-help"
              className="button-secondary"
              data-action-id="PAYABLES-RESTRICTIONS"
              disabled
              type="button"
            >
              Restricciones
            </Button>
            <Button
              aria-describedby="payables-financial-actions-help"
              className="button-secondary"
              data-action-id="PAYABLES-DOWNLOAD"
              disabled
              type="button"
            >
              Descargar
            </Button>
            <Button
              aria-describedby="payables-financial-actions-help"
              className="button-secondary"
              data-action-id="PAYABLES-CLEAR-TABLE"
              disabled
              type="button"
            >
              Limpiar Tabla
            </Button>
          </div>
        </div>
        <p className="field-help" id="payables-financial-actions-help">
          Requiere definición aprobada de período, autorizaciones, reportes, reversibilidad y
          auditoría (CH12-Q002/Q007/Q008/Q009/Q010).
        </p>
        <div className="filter-grid">
          <label>
            Registros
            <select aria-label="Registros por página" disabled value="10">
              <option value="10">10</option>
            </select>
          </label>
          <label>
            Buscar facturas
            <input
              data-action-id="PAYABLES-INVOICE-SEARCH"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en el resumen"
              type="search"
              value={query}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Acc</th>
                <th>Estatus</th>
                <th>DUI/NIT</th>
                <th>Nombre usuario</th>
                <th>Fecha Inicio</th>
                <th>Fecha Final</th>
                <th>Monto</th>
                <th>Fecha de Creación</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    detail={
                      query
                        ? `No hay facturas documentadas para “${query}”.`
                        : 'No hay facturas documentadas en la organización demo.'
                    }
                    title="Sin facturas documentadas"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="field-help">Mostrando página 0 de 0 · Anterior · Siguiente</p>
      </Panel>
      <Panel>
        <h2>Reclamos</h2>
        <EmptyState
          detail="No se crean ni se presentan reclamos sin una definición aprobada de su alcance, estados, permisos y auditoría (CH12-Q011)."
          title="Sin reclamos documentados"
        />
      </Panel>
    </div>
  );
}
