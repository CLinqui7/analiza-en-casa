'use client';

import Link from 'next/link';
import { Panel, StatusTag } from '@analiza/ui';
import { useAuth, useDashboardWorkspace } from './providers';

export function CoreDashboard() {
  const { patients, hospitalizations, shifts, loading, error } = useDashboardWorkspace();
  const { can } = useAuth();
  if (loading) return <p role="status">Cargando datos del servidor…</p>;
  if (error)
    return (
      <p className="notice warning" role="alert">
        No fue posible cargar la información: {error}
      </p>
    );
  const active = hospitalizations.filter((row) => row.status === 'ACTIVE');
  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Analiza en Casa</p>
          <h1>Dashboard</h1>
          <p>Pacientes, hospitalizaciones y turnos de tu organización.</p>
        </div>
        {can('patients:write') && (
          <Link className="button" href="/patients?create=1">
            Nuevo paciente
          </Link>
        )}
      </header>
      <p className="notice">Prueba funcional · MongoDB · Usa únicamente datos ficticios.</p>
      <div className="dashboard-grid">
        {can('patients:read') && (
          <Panel>
            <p>Pacientes registrados</p>
            <h2>{patients.length}</h2>
            <Link href="/patients">Abrir pacientes →</Link>
          </Panel>
        )}
        {can('cases:read') && (
          <Panel>
            <p>Hospitalizaciones activas</p>
            <h2>{active.length}</h2>
            <Link href="/hospitalizations">Abrir hospitalizaciones →</Link>
          </Panel>
        )}
        {can('agenda:read') && (
          <Panel>
            <p>Turnos registrados</p>
            <h2>{shifts.length}</h2>
            <Link href="/agenda">Abrir agenda →</Link>
          </Panel>
        )}
      </div>
      {can('cases:read') && (
        <Panel>
          <h2>Hospitalizaciones activas</h2>
          {active.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Ingreso</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {active.slice(0, 10).map((row) => (
                    <tr key={row.id}>
                      <td>
                        {patients.find((patient) => patient.id === row.patientId)?.fullName ??
                          'Paciente'}
                      </td>
                      <td>{row.startDate}</td>
                      <td>
                        <StatusTag tone="success">Activo</StatusTag>
                      </td>
                      <td>
                        <Link href={`/hospitalizations/${encodeURIComponent(row.id)}`}>
                          Abrir →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No hay hospitalizaciones activas.</p>
          )}
        </Panel>
      )}
    </div>
  );
}
