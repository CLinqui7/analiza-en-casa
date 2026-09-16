'use client';

import { movementDelta } from '@analiza/domain';
import { EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useAuth, useDashboardWorkspace } from '@/components/providers';
import { filterDashboardReadings, getDashboardActions } from '@/lib/dashboard-activity';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { videoParitySummary } from '@/lib/video-parity-summary';
import { isCoreRelease } from '@/lib/release-profile';
import { CoreDashboard } from '@/components/core-dashboard';
import { DemoDataButton } from '@/components/demo-data-button';

const currency = new Intl.NumberFormat('es-SV', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

function displayMetric(value: number | undefined, unit = '') {
  return value === undefined ? '—' : `${value}${unit}`;
}

function displayDate(value: string) {
  return new Date(value).toLocaleString('es-SV', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function BarRow({ label, value, maximum }: { label: string; value: number; maximum: number }) {
  const width = value === 0 ? 0 : Math.max(8, Math.round((value / Math.max(maximum, 1)) * 100));
  return (
    <li className="dashboard-bar-row">
      <span>{label}</span>
      <span className="dashboard-bar-track" aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </span>
      <strong>{value}</strong>
    </li>
  );
}

export default function DashboardPage() {
  return isCoreRelease ? <CoreDashboard /> : <FullDashboard />;
}

function FullDashboard() {
  const {
    auditEntries,
    catalogItems,
    clinicalDocuments,
    error,
    hospitalizations,
    insuranceRequests,
    inventoryMovements,
    loading,
    nursingResources,
    patients,
    payments,
    quotes,
    shifts,
    vitalReadings,
  } = useDashboardWorkspace();
  const { can } = useAuth();
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [dashboardMonth, setDashboardMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const supabaseConfigured = Boolean(getSupabaseBrowserClient());
  const recentReadings = filterDashboardReadings(vitalReadings, dateRange);
  const actions = getDashboardActions(shifts, hospitalizations, patients, dateRange);
  const visibleActions = actions.filter((action) =>
    action.kind === 'SHIFT' ? can('agenda:read') : can('cases:read'),
  );
  const latestQuotes = useMemo(() => {
    const latest = new Map<string, (typeof quotes)[number]>();
    for (const quote of quotes) {
      const rootId = quote.rootQuoteId ?? quote.originalQuoteId ?? quote.id;
      const current = latest.get(rootId);
      if (!current || quote.version > current.version) latest.set(rootId, quote);
    }
    return [...latest.values()];
  }, [quotes]);
  const insuredPatients = patients.filter((patient) => {
    const insurer = patient.insurance?.insurer ?? patient.insurer;
    return Boolean(insurer && !insurer.toLowerCase().includes('sin aseguradora'));
  });
  const openHospitalizations = hospitalizations.filter((item) => item.status !== 'CLOSED');
  const informationRequired = insuranceRequests.filter(
    (request) => request.status === 'INFO_REQUIRED',
  ).length;
  const scheduledShifts = shifts
    .filter((shift) => shift.status === 'SCHEDULED')
    .slice()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const visitsThisMonth = shifts.filter(
    (shift) => shift.status !== 'CANCELLED' && shift.startsAt.startsWith(dashboardMonth),
  ).length;
  const sentQuoteValueThisMonth = latestQuotes
    .filter(
      (quote) =>
        quote.status === 'SENT' && (quote.sentAt ?? quote.createdAt).startsWith(dashboardMonth),
    )
    .reduce((sum, quote) => sum + quote.total, 0);
  const appliedPaymentsThisMonth = payments
    .filter(
      (payment) => payment.status === 'APPLIED' && payment.createdAt.startsWith(dashboardMonth),
    )
    .reduce((sum, payment) => sum + payment.amount, 0);
  const quoteFunnel = [
    { label: 'Borradores', value: latestQuotes.filter((quote) => quote.status === 'DRAFT').length },
    { label: 'Enviadas', value: latestQuotes.filter((quote) => quote.status === 'SENT').length },
    {
      label: 'Seguro en revisión',
      value: insuranceRequests.filter((request) => request.status === 'INSURER_REVIEW').length,
    },
    { label: 'Información requerida', value: informationRequired },
    {
      label: 'Aprobadas',
      value: insuranceRequests.filter((request) => request.status === 'APPROVED').length,
    },
  ];
  const funnelMaximum = Math.max(...quoteFunnel.map((item) => item.value), 1);
  const inventoryBalances = useMemo(() => {
    const balances = new Map<string, number>();
    for (const movement of inventoryMovements) {
      balances.set(movement.itemId, (balances.get(movement.itemId) ?? 0) + movementDelta(movement));
    }
    return [...balances.entries()]
      .map(([itemId, balance]) => ({
        itemId,
        balance,
        name: catalogItems.find((item) => item.id === itemId)?.name ?? itemId,
      }))
      .sort((a, b) => a.balance - b.balance)
      .slice(0, 4);
  }, [catalogItems, inventoryMovements]);
  const quoteMonths = useMemo(() => {
    const totals = new Map<string, number>();
    for (const quote of latestQuotes) {
      const month = quote.createdAt.slice(0, 7);
      totals.set(month, (totals.get(month) ?? 0) + quote.total);
    }
    return [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, total]) => ({ month, total }));
  }, [latestQuotes]);
  const maximumQuoteMonth = Math.max(...quoteMonths.map((item) => item.total), 1);

  return (
    <div className="page-stack dashboard-page">
      <header className="page-header page-header-actions dashboard-hero">
        <div>
          <span className="dashboard-studio-pill">Operación domiciliaria · Studio</span>
          <h1>Una vista clara de tu operación</h1>
          <p>Pacientes, coordinación y seguimiento, en un solo lugar.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/tutorial">
            Tutorial y ayuda
          </Link>
          <DemoDataButton />
          <label className="dashboard-month-control">
            <input
              aria-label="Mes del dashboard"
              data-action-id="DASHBOARD-MONTH"
              onChange={(event) => setDashboardMonth(event.target.value)}
              type="month"
              value={dashboardMonth}
            />
          </label>
          {can('patients:write') ? (
            <Link
              className="button"
              data-action-id="DASHBOARD-PATIENT-CREATE"
              href="/patients?create=1"
            >
              + Nuevo paciente
            </Link>
          ) : null}
        </div>
      </header>

      {loading ? (
        <Panel>
          <p role="status">Cargando indicadores sintéticos…</p>
        </Panel>
      ) : null}
      {error ? (
        <Panel>
          <p className="field-error" role="alert">
            No fue posible cargar el dashboard: {error}
          </p>
        </Panel>
      ) : null}

      {!loading && !error ? (
        <>
          <section className="dashboard-kpi-grid" aria-label="Indicadores operativos">
            <Panel className="dashboard-kpi-card">
              <span className="dashboard-kpi-icon" aria-hidden="true">
                ▦
              </span>
              <div>
                <small>Pacientes activos</small>
                <strong>{patients.filter((item) => item.status === 'ACTIVE').length}</strong>
                <span>Directorio de pacientes</span>
              </div>
            </Panel>
            <Panel className="dashboard-kpi-card">
              <span className="dashboard-kpi-icon" aria-hidden="true">
                ✓
              </span>
              <div>
                <small>Pacientes particulares</small>
                <strong>{patients.length - insuredPatients.length}</strong>
                <span>Sin aseguradora registrada</span>
              </div>
            </Panel>
            <Panel className="dashboard-kpi-card">
              <span className="dashboard-kpi-icon" aria-hidden="true">
                $
              </span>
              <div>
                <small>Pacientes asegurados</small>
                <strong>{insuredPatients.length}</strong>
                <span>Cobertura registrada</span>
              </div>
            </Panel>
            <Panel className="dashboard-kpi-card">
              <span className="dashboard-kpi-icon" aria-hidden="true">
                ▣
              </span>
              <div>
                <small>Hospitalizaciones abiertas</small>
                <strong>{openHospitalizations.length}</strong>
                <span>Casos activos o pendientes de cierre</span>
              </div>
            </Panel>
          </section>

          <section className="studio-dashboard-overview">
            <Panel className="dashboard-card">
              <div className="dashboard-card-heading">
                <div>
                  <h2>Resumen de cotizaciones por mes</h2>
                  <p>
                    Importes cotizados registrados; no equivalen a ventas ni facturación cobrada.
                  </p>
                </div>
                <Link href="/quotes">Ver cotizaciones →</Link>
              </div>
              <div
                className="studio-chart"
                role="img"
                aria-label={`Cotizaciones por mes: ${quoteMonths.map((item) => `${item.month}: ${currency.format(item.total)}`).join(', ') || 'Sin datos'}`}
              >
                <div className="studio-chart-grid" aria-hidden="true" />
                {quoteMonths.length ? (
                  quoteMonths.map((item) => (
                    <div key={item.month} className="studio-chart-column">
                      <strong>{currency.format(item.total)}</strong>
                      <div
                        style={{
                          height: `${Math.max(2, (item.total / maximumQuoteMonth) * 165)}px`,
                        }}
                      />
                      <span>
                        {new Date(`${item.month}-15T12:00:00`).toLocaleDateString('es-SV', {
                          month: 'short',
                          year: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="Sin importes registrados"
                    detail="Las cotizaciones del equipo aparecerán en este gráfico."
                  />
                )}
              </div>
            </Panel>
            <Panel className="dashboard-card">
              <div className="dashboard-card-heading">
                <div>
                  <h2>Accesos rápidos</h2>
                  <p>Continúa con las tareas de hoy.</p>
                </div>
              </div>
              <div className="studio-shortcuts">
                {can('patients:read') ? (
                  <Link href="/patients">
                    <span>♙</span>
                    <strong>Pacientes</strong>
                  </Link>
                ) : null}
                {can('cases:write') ? (
                  <Link href="/hospitalizations">
                    <span>⊞</span>
                    <strong>Hospitalización</strong>
                  </Link>
                ) : null}
                {can('quotes:write') ? (
                  <Link data-action-id="DASHBOARD-QUOTE-CREATE" href="/quotes?create=1">
                    <span>▧</span>
                    <strong>Cotizaciones</strong>
                  </Link>
                ) : null}
                {can('agenda:read') ? (
                  <Link href="/agenda">
                    <span>▦</span>
                    <strong>Agenda</strong>
                  </Link>
                ) : null}
                {can('insurance:read') ? (
                  <Link href="/insurance">
                    <span>✓</span>
                    <strong>Preautorizaciones</strong>
                  </Link>
                ) : null}
                {can('clinical:read') ? (
                  <Link href="/clinical">
                    <span>∿</span>
                    <strong>Clínica</strong>
                  </Link>
                ) : null}
              </div>
              <div className="studio-overview-foot">
                <span>{scheduledShifts.length} turnos programados</span>
                <span>{informationRequired} solicitudes requieren información</span>
                <span>Pagos del mes: {currency.format(appliedPaymentsThisMonth)}</span>
              </div>
            </Panel>
          </section>

          <section className="dashboard-primary-grid" aria-label="Resumen operativo">
            <Panel className="dashboard-card dashboard-funnel-card">
              <div className="dashboard-card-heading">
                <div>
                  <h2>Embudo de cotizaciones</h2>
                  <p>Distribución del estado documentado.</p>
                </div>
                {can('quotes:read') ? <Link href="/quotes">Ver flujo</Link> : null}
              </div>
              <ul className="dashboard-bar-list">
                {quoteFunnel.map((item) => (
                  <BarRow key={item.label} {...item} maximum={funnelMaximum} />
                ))}
              </ul>
            </Panel>

            <Panel className="dashboard-card dashboard-shifts-card">
              <div className="dashboard-card-heading">
                <div>
                  <h2>Turnos programados</h2>
                  <p>Agenda registrada, sin inferencias clínicas.</p>
                </div>
                {can('agenda:read') ? <Link href="/agenda">Abrir agenda</Link> : null}
              </div>
              {scheduledShifts.length ? (
                <ul className="dashboard-turn-list">
                  {scheduledShifts.slice(0, 4).map((shift) => {
                    const patient = patients.find((item) => item.id === shift.patientId);
                    const resource = nursingResources.find((item) => item.id === shift.resourceId);
                    return (
                      <li key={shift.id}>
                        <span className="dashboard-turn-dot" aria-hidden="true" />
                        <div>
                          <strong>{resource?.displayName ?? 'Recurso no disponible'}</strong>
                          <span>{patient?.fullName ?? 'Sin paciente asignado'}</span>
                          <small>
                            {displayDate(shift.startsAt)} — {displayDate(shift.endsAt)}
                          </small>
                        </div>
                        <StatusTag tone="success">Programado</StatusTag>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  title="Sin turnos programados"
                  detail="Registre un turno para mostrarlo en este panel."
                />
              )}
            </Panel>
          </section>

          <section className="dashboard-secondary-grid" aria-label="Acciones y existencias">
            <Panel className="dashboard-card dashboard-cases-card">
              <div className="dashboard-card-heading">
                <div>
                  <h2>Casos que requieren acción</h2>
                  <p>Hospitalizaciones abiertas con la siguiente acción registrada.</p>
                </div>
                {can('cases:read') ? <Link href="/hospitalizations">Ver casos</Link> : null}
              </div>
              {openHospitalizations.length ? (
                <div
                  className="dashboard-case-table"
                  role="table"
                  aria-label="Casos que requieren acción"
                >
                  <div className="dashboard-case-head" role="row">
                    <span role="columnheader">Caso</span>
                    <span role="columnheader">Paciente</span>
                    <span role="columnheader">Estado</span>
                    <span role="columnheader">Próxima acción</span>
                    <span role="columnheader">Acciones</span>
                  </div>
                  {openHospitalizations.slice(0, 6).map((hospitalization) => {
                    const patient = patients.find((item) => item.id === hospitalization.patientId);
                    return (
                      <div key={hospitalization.id} role="row">
                        <strong role="cell">{hospitalization.id}</strong>
                        <span role="cell">{patient?.fullName ?? 'No disponible'}</span>
                        <span role="cell">
                          <StatusTag
                            tone={hospitalization.status === 'ACTIVE' ? 'success' : 'warning'}
                          >
                            {hospitalization.status === 'ACTIVE' ? 'Activo' : 'Pendiente de cierre'}
                          </StatusTag>
                        </span>
                        <span role="cell">
                          {hospitalization.nextAction ?? 'Sin próxima acción documentada'}
                        </span>
                        <span role="cell">
                          <Link href={`/hospitalizations/${hospitalization.id}`}>Abrir →</Link>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="Sin casos abiertos"
                  detail="No hay hospitalizaciones activas o pendientes de cierre."
                />
              )}
            </Panel>

            <Panel className="dashboard-card dashboard-stock-card">
              <div className="dashboard-card-heading">
                <div>
                  <h2>Existencias registradas</h2>
                  <p>Balance derivado del kardex.</p>
                </div>
                {can('inventory:read') ? <Link href="/inventory">Gestionar</Link> : null}
              </div>
              {inventoryBalances.length ? (
                <ul className="dashboard-stock-list">
                  {inventoryBalances.map((item) => (
                    <li key={item.itemId}>
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.itemId}</small>
                      </div>
                      <span>{item.balance} unidades</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="Sin movimientos"
                  detail="El kardex no tiene existencias registradas."
                />
              )}
            </Panel>
          </section>

          <section className="dashboard-insights-grid" aria-label="Indicadores de gestión">
            <Panel className="dashboard-card dashboard-goals-card">
              <div className="dashboard-card-heading">
                <div>
                  <h2>Agenda y cotizaciones del mes</h2>
                  <p>Los turnos programados no equivalen a visitas realizadas ni a ventas.</p>
                </div>
                {can('agenda:read') ? <Link href="/agenda">Abrir agenda</Link> : null}
              </div>
              <div className="dashboard-split-metrics">
                <div>
                  <strong data-testid="dashboard-monthly-visits">{visitsThisMonth}</strong>
                  <span>Turnos del mes</span>
                </div>
                <div>
                  <strong data-testid="dashboard-monthly-sent-quotes">
                    {currency.format(sentQuoteValueThisMonth)}
                  </strong>
                  <span>Valor cotizado enviado</span>
                </div>
                <div className="dashboard-goal-pending">
                  <Link href="/reports/visits-goals">
                    <strong>Visitas y metas →</strong>
                  </Link>
                  <span>Resultados y objetivos por profesional</span>
                </div>
              </div>
            </Panel>
            <Panel className="dashboard-card">
              <div className="dashboard-card-heading">
                <div>
                  <h2>Pacientes por modalidad</h2>
                  <p>Clasificación según la aseguradora registrada.</p>
                </div>
                {can('patients:read') ? <Link href="/patients">Ver pacientes</Link> : null}
              </div>
              <div className="dashboard-split-metrics">
                <div>
                  <strong data-testid="dashboard-insured-patients">{insuredPatients.length}</strong>
                  <span>Asegurados</span>
                </div>
                <div>
                  <strong data-testid="dashboard-private-patients">
                    {patients.length - insuredPatients.length}
                  </strong>
                  <span>Particulares</span>
                </div>
                <div>
                  <strong>{patients.filter((item) => item.status === 'ACTIVE').length}</strong>
                  <span>Activos</span>
                </div>
                <div>
                  <strong>{patients.filter((item) => item.status === 'INACTIVE').length}</strong>
                  <span>Inactivos</span>
                </div>
              </div>
            </Panel>
            <Panel className="dashboard-card">
              <div className="dashboard-card-heading">
                <div>
                  <h2>Valor de cotizaciones por mes</h2>
                  <p>Totales registrados; no se presentan como facturación cobrada.</p>
                </div>
                <Link href="/quotes">Detalle</Link>
              </div>
              {quoteMonths.length ? (
                <ul className="dashboard-month-bars">
                  {quoteMonths.map((item) => (
                    <li key={item.month}>
                      <span>{item.month}</span>
                      <span className="dashboard-bar-track">
                        <span
                          style={{
                            width: `${Math.max(8, Math.round((item.total / maximumQuoteMonth) * 100))}%`,
                          }}
                        />
                      </span>
                      <strong>{currency.format(item.total)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="Sin cotizaciones"
                  detail="No hay valores mensuales documentados."
                />
              )}
            </Panel>
          </section>

          <Panel className="dashboard-card dashboard-audit-card">
            <div className="dashboard-card-heading">
              <div>
                <h2>Actividad reciente</h2>
                <p>Últimos cambios auditados en esta sesión.</p>
              </div>
              {can('audit:read') ? <Link href="/audit">Auditoría completa</Link> : null}
            </div>
            {auditEntries.length ? (
              <ul className="dashboard-audit-list">
                {auditEntries.slice(0, 6).map((entry) => (
                  <li key={entry.id}>
                    <span className="dashboard-turn-dot" aria-hidden="true" />
                    <div>
                      <strong>{entry.action}</strong>
                      <span>{entry.subject}</span>
                    </div>
                    <time>{displayDate(entry.at)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Sin eventos auditados"
                detail="No hay eventos disponibles en esta sesión."
              />
            )}
          </Panel>

          <details className="dashboard-technical-details">
            <summary>Mediciones, filtros y control de migración</summary>
            <Panel>
              <h2>Indicadores clínicos documentados</h2>
              <p className="field-help">
                Sin reglas de alertas o estados de tratamientos aprobadas, esos indicadores se
                mantienen sin cálculo.
              </p>
              <dl className="definition-list" aria-label="Indicadores clínicos documentados">
                {[
                  ['Pacientes con alertas', 'Sin regla aprobada'],
                  ['Pacientes activos', patients.filter((item) => item.status === 'ACTIVE').length],
                  ['Tratamientos actualizados', 'Sin definición aprobada'],
                  ['Tratamientos por finalizar', 'Sin definición aprobada'],
                  [
                    'Planes de cuidado',
                    clinicalDocuments.filter((item) => item.type === 'CARE_PLAN').length,
                  ],
                  ['Incidentes', 'Sin fuente registrada'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <div className="page-stack">
              <Panel>
                <div className="table-heading dashboard-filter-heading">
                  <div>
                    <h2>Actividad por fecha</h2>
                    <p>Filtra mediciones y acciones por su fecha registrada.</p>
                  </div>
                  <button
                    className="button button-secondary"
                    data-action-id="DASHBOARD-DATE-CLEAR"
                    disabled={!dateRange.from && !dateRange.to}
                    onClick={() => setDateRange({ from: '', to: '' })}
                    type="button"
                  >
                    Limpiar fechas
                  </button>
                </div>
                <div className="form-grid form-grid-compact dashboard-date-filters">
                  <label>
                    Desde
                    <input
                      data-action-id="DASHBOARD-DATE-FROM"
                      onChange={(event) =>
                        setDateRange((current) => ({ ...current, from: event.target.value }))
                      }
                      type="date"
                      value={dateRange.from}
                    />
                  </label>
                  <label>
                    Hasta
                    <input
                      data-action-id="DASHBOARD-DATE-TO"
                      onChange={(event) =>
                        setDateRange((current) => ({ ...current, to: event.target.value }))
                      }
                      type="date"
                      value={dateRange.to}
                    />
                  </label>
                </div>
              </Panel>
              <Panel>
                <div className="table-heading">
                  <div>
                    <h2>Próximas acciones filtradas</h2>
                    <p>Turnos y acciones de casos según el rango.</p>
                  </div>
                  <StatusTag>{visibleActions.length} visibles</StatusTag>
                </div>
                {visibleActions.length ? (
                  <ul className="action-list">
                    {visibleActions.map((action) => (
                      <li className="action-card" key={action.id}>
                        <strong>{action.patientName}</strong>
                        <span>{action.detail}</span>
                        <span>{displayDate(action.occursAt)}</span>
                        <Link href={action.href}>Abrir</Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title="Sin acciones para este rango"
                    detail="Ajuste el rango o registre una acción documentada."
                  />
                )}
              </Panel>
              <Panel>
                <div className="table-heading">
                  <div>
                    <h2>Últimas mediciones individuales</h2>
                    <p>Registros documentados sin clasificarlos como normales o anormales.</p>
                  </div>
                  <StatusTag tone="warning">Sin clasificar</StatusTag>
                </div>
                {recentReadings.length ? (
                  <div
                    aria-label="Tabla de últimas mediciones individuales"
                    className="table-wrap"
                    tabIndex={0}
                  >
                    <table aria-label="Últimas mediciones individuales">
                      <thead>
                        <tr>
                          <th>Acciones</th>
                          <th>Paciente</th>
                          <th>FC</th>
                          <th>FR</th>
                          <th>Oxígeno</th>
                          <th>Sistólica</th>
                          <th>Diastólica</th>
                          <th>Temp</th>
                          <th>Dolor</th>
                          <th>Glicemia</th>
                          <th>Fecha</th>
                          <th>Recurso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentReadings.map((reading) => {
                          const patient = patients.find((item) => item.id === reading.patientId);
                          return (
                            <tr key={reading.id}>
                              <td>
                                {patient && can('patients:read') ? (
                                  <Link
                                    data-action-id="DASHBOARD-MEASUREMENT-OPEN"
                                    href={`/patients/${patient.id}`}
                                  >
                                    Ver paciente →
                                  </Link>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td>{patient?.fullName ?? 'Paciente no disponible'}</td>
                              <td>{displayMetric(reading.heartRate)}</td>
                              <td>{displayMetric(reading.respiratoryRate)}</td>
                              <td>{displayMetric(reading.oxygenSaturation, '%')}</td>
                              <td>{displayMetric(reading.systolic)}</td>
                              <td>{displayMetric(reading.diastolic)}</td>
                              <td>{displayMetric(reading.temperature, ' °C')}</td>
                              <td>{displayMetric(reading.pain)}</td>
                              <td>{displayMetric(reading.glucose)}</td>
                              <td>{displayDate(reading.measuredAt)}</td>
                              <td>{reading.professional ?? 'No disponible'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title="Sin mediciones individuales"
                    detail="Registre una medición para verla aquí; el dashboard no infiere alertas."
                  />
                )}
              </Panel>
              <section className="two-column">
                <Panel>
                  <h2>Control de migración</h2>
                  <dl className="definition-list">
                    <div>
                      <dt>Requisitos trazados</dt>
                      <dd>{videoParitySummary.total}</dd>
                    </div>
                    <div>
                      <dt>Exactos / parciales / faltantes</dt>
                      <dd>
                        {videoParitySummary.EXACT ?? 0} / {videoParitySummary.PARTIAL ?? 0} /{' '}
                        {videoParitySummary.MISSING ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt>Capítulos verificados</dt>
                      <dd>{videoParitySummary.chapters}/17</dd>
                    </div>
                    <div>
                      <dt>SHA de implementación</dt>
                      <dd>
                        <code>{videoParitySummary.sourceSha?.slice(0, 12) ?? 'pendiente'}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Supabase navegador</dt>
                      <dd>
                        {supabaseConfigured
                          ? 'Configurado con clave pública'
                          : 'No configurado en demo local'}
                      </dd>
                    </div>
                  </dl>
                </Panel>
                <Panel>
                  <h2>Documentos clínicos</h2>
                  <dl className="definition-list">
                    <div>
                      <dt>Planes de cuidado</dt>
                      <dd>
                        {
                          clinicalDocuments.filter((document) => document.type === 'CARE_PLAN')
                            .length
                        }
                      </dd>
                    </div>
                    <div>
                      <dt>Evoluciones</dt>
                      <dd>
                        {
                          clinicalDocuments.filter(
                            (document) => document.type === 'CLINICAL_EVOLUTION',
                          ).length
                        }
                      </dd>
                    </div>
                    <div>
                      <dt>Firmados</dt>
                      <dd>
                        {
                          clinicalDocuments.filter((document) => document.status === 'SIGNED')
                            .length
                        }
                      </dd>
                    </div>
                  </dl>
                </Panel>
              </section>
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}
