'use client';

import { Button, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useWorkspace } from '@/components/providers';
import {
  paymentLocalDate,
  paymentMethodLabel,
  paymentReportCsv,
  paymentReportRows,
  paymentStatusLabel,
  type PaymentReportFilters,
} from '@/lib/payment-report';

const money = (value: number) =>
  new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value);

export function PaymentsReportPage() {
  const { payments, quotes, patients } = useWorkspace();
  const [filters, setFilters] = useState<PaymentReportFilters>({
    query: '',
    status: 'ALL',
    from: '',
    to: '',
  });
  const rows = useMemo(
    () => paymentReportRows(payments, quotes, patients, filters),
    [payments, quotes, patients, filters],
  );
  const totals = rows.reduce(
    (sum, { payment }) => {
      if (payment.status === 'APPLIED') sum.applied += payment.amount;
      else sum.voided += payment.amount;
      return sum;
    },
    { applied: 0, voided: 0 },
  );

  function downloadCsv() {
    const blob = new Blob(['\uFEFF', paymentReportCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'reporte-pagos.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-stack payments-page">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Reportes y control</p>
          <h1>Reporte de pagos</h1>
          <p>Todos los pagos reportados de esta organización, incluidos los reversados.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/receivables">
            Cuentas por cobrar
          </Link>
          <Button disabled={!rows.length} onClick={downloadCsv} type="button">
            Descargar CSV
          </Button>
        </div>
      </header>
      <Panel>
        <div className="table-heading">
          <h2>Filtros</h2>
          <StatusTag>{rows.length} registros</StatusTag>
        </div>
        <div className="filter-grid">
          <label>
            Buscar paciente, cotización o referencia
            <input
              onChange={(event) =>
                setFilters((current) => ({ ...current, query: event.target.value }))
              }
              type="search"
              value={filters.query}
            />
          </label>
          <label>
            Estado
            <select
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as PaymentReportFilters['status'],
                }))
              }
              value={filters.status}
            >
              <option value="ALL">Todos</option>
              <option value="APPLIED">Aplicados</option>
              <option value="VOIDED">Reversados</option>
            </select>
          </label>
          <label>
            Desde
            <input
              onChange={(event) =>
                setFilters((current) => ({ ...current, from: event.target.value }))
              }
              type="date"
              value={filters.from}
            />
          </label>
          <label>
            Hasta
            <input
              onChange={(event) =>
                setFilters((current) => ({ ...current, to: event.target.value }))
              }
              type="date"
              value={filters.to}
            />
          </label>
        </div>
      </Panel>
      <section className="studio-metrics" aria-label="Resumen de pagos filtrados">
        {[
          ['#', 'Registros', rows.length, 'Aplicados y reversados'],
          ['✓', 'Aplicados', totals.applied, 'Monto vigente'],
          ['↶', 'Reversados', totals.voided, 'Monto de pagos reversados'],
        ].map(([icon, label, value, detail]) => (
          <Panel key={label}>
            <article>
              <span aria-hidden="true">{icon}</span>
              <div>
                <small>{label}</small>
                <strong>{label === 'Registros' ? value : money(Number(value))}</strong>
                <p>{detail}</p>
              </div>
            </article>
          </Panel>
        ))}
      </section>
      <Panel>
        <div className="table-heading">
          <h2>Movimientos reportados</h2>
          <p>La aplicación y reversión de pagos se gestionan en Cuentas por cobrar.</p>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th>Cotización</th>
                  <th>Monto</th>
                  <th>Medio</th>
                  <th>Referencia</th>
                  <th>Estado</th>
                  <th>Motivo de reversión</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ payment, patientName, quoteCode }) => (
                  <tr key={payment.id}>
                    <td title={payment.createdAt}>
                      {paymentLocalDate(payment.createdAt)} ·{' '}
                      {new Date(payment.createdAt).toLocaleTimeString('es-SV', {
                        timeZone: 'America/El_Salvador',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>{patientName}</td>
                    <td title={payment.quoteId}>{quoteCode}</td>
                    <td>{money(payment.amount)}</td>
                    <td>
                      {payment.paymentMethod
                        ? paymentMethodLabel[payment.paymentMethod]
                        : 'No registrado'}
                    </td>
                    <td>{payment.reference || '—'}</td>
                    <td>{paymentStatusLabel[payment.status]}</td>
                    <td>{payment.voidReason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Sin pagos para estos filtros"
            detail="Los pagos aplicados y reversados aparecerán aquí cuando existan registros."
          />
        )}
      </Panel>
    </div>
  );
}
