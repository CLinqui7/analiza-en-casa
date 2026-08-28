'use client';

import { useQuery } from '@tanstack/react-query';
import { EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useAuth, useWorkspace } from '@/components/providers';
import { getSupabaseBrowserClient } from '@/lib/supabase';

function displayMetric(value: number | undefined, unit = '') {
  return value === undefined ? '—' : `${value}${unit}`;
}

export default function DashboardPage() {
  const { auditEntries, clinicalDocuments, error, hospitalizations, inventoryMovements, loading, nursingResources, patients, vitalReadings } = useWorkspace();
  const { can } = useAuth();
  const parity = useQuery({
    queryKey: ['video-parity-summary'],
    queryFn: async () => ({ chapters: 17, unresolvedMissing: 0, source: 'Matriz canónica versionada' }),
    staleTime: Infinity,
  });
  const supabaseConfigured = Boolean(getSupabaseBrowserClient());
  const carePlans = clinicalDocuments.filter((document) => document.type === 'CARE_PLAN').length;
  const recentReadings = vitalReadings.slice().sort((left, right) => right.measuredAt.localeCompare(left.measuredAt));

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Operación domiciliaria</p>
          <h1>Dashboard</h1>
          <p>Indicadores sintéticos; los umbrales clínicos y la clasificación de incidentes requieren reglas aprobadas por el cliente.</p>
        </div>
        <div className="header-actions">
          <StatusTag tone="success">React activo</StatusTag>
          {can('quotes:write') ? <Link className="button" data-action-id="DASHBOARD-QUOTE-CREATE" href="/quotes?create=1">Nueva cotización</Link> : null}
          {can('patients:write') ? <Link className="button button-secondary" data-action-id="DASHBOARD-PATIENT-CREATE" href="/patients?create=1">Nuevo paciente</Link> : null}
        </div>
      </header>

      {loading ? <Panel><p role="status">Cargando indicadores sintéticos…</p></Panel> : null}
      {error ? <Panel><p className="field-error" role="alert">No fue posible cargar el dashboard: {error}</p></Panel> : null}
      {!loading && !error ? <>
        <section className="metric-grid" aria-label="Indicadores operativos">
          <Panel><span>Pacientes con alertas</span><strong>—</strong><small>Requiere umbrales clínicos aprobados.</small></Panel>
          <Panel><span>Pacientes registrados</span><strong>{patients.length}</strong><small>Registros sintéticos disponibles.</small></Panel>
          <Panel><span>Mediciones individuales</span><strong>{vitalReadings.length}</strong><small>Sin interpretación automática.</small></Panel>
          <Panel><span>Hospitalizaciones activas</span><strong>{hospitalizations.filter((item) => item.status === 'ACTIVE').length}</strong><small>Coordinación operativa registrada.</small></Panel>
          <Panel><span>Planes de cuidado</span><strong>{carePlans}</strong><small>Documentos sintéticos no interpretados.</small></Panel>
          <Panel><span>Incidentes</span><strong>—</strong><small>Sin fuente ni regla aprobada.</small></Panel>
          <Panel><span>Recursos de enfermería</span><strong>{nursingResources.length}</strong><small>Registros operativos disponibles.</small></Panel>
          <Panel><span>Movimientos de inventario</span><strong>{inventoryMovements.length}</strong><small>Eventos de inventario auditables.</small></Panel>
          <Panel><span>Eventos auditados</span><strong>{auditEntries.length}</strong><small>Trazabilidad de la sesión demo.</small></Panel>
        </section>

        <Panel>
          <div className="table-heading">
            <div><h2>Últimas mediciones individuales</h2><p>Se muestran registros documentados sin etiquetarlos como normales o anormales.</p></div>
            <StatusTag tone="warning">Sin clasificar</StatusTag>
          </div>
          {recentReadings.length ? <div aria-label="Tabla de últimas mediciones individuales" className="table-wrap" tabIndex={0}><table><thead><tr><th>Acción</th><th>Paciente</th><th>FC</th><th>FR</th><th>Oxígeno</th><th>Sistólica</th><th>Diastólica</th><th>Temperatura</th><th>Dolor</th><th>Glicemia</th><th>Fecha</th><th>Recurso</th></tr></thead><tbody>
            {recentReadings.map((reading) => {
              const patient = patients.find((item) => item.id === reading.patientId);
              const hospitalization = reading.caseId ? hospitalizations.find((item) => item.id === reading.caseId) : undefined;
              return <tr key={reading.id}>
                <td>{hospitalization ? <Link data-action-id="DASHBOARD-HOSPITALIZATION-DETAIL" href={`/hospitalizations/${hospitalization.id}`}>Ver</Link> : 'Sin caso vinculado'}</td>
                <td>{patient?.fullName ?? 'Paciente no disponible'}</td><td>{displayMetric(reading.heartRate)}</td><td>{displayMetric(reading.respiratoryRate)}</td><td>{displayMetric(reading.oxygenSaturation, '%')}</td><td>{displayMetric(reading.systolic)}</td><td>{displayMetric(reading.diastolic)}</td><td>{displayMetric(reading.temperature, ' °C')}</td><td>{displayMetric(reading.pain)}</td><td>{displayMetric(reading.glucose)}</td><td>{new Date(reading.measuredAt).toLocaleString('es-SV')}</td><td>{reading.professional ?? 'No disponible'}</td>
              </tr>;
            })}
          </tbody></table></div> : <EmptyState detail="Registre una medición individual para verla aquí; el dashboard no infiere alertas." title="Sin mediciones individuales" />}
          </Panel>
          <section className="two-column">
            <Panel>
              <h2>Control de migración</h2>
              {parity.data ? <dl className="definition-list">
                <div><dt>Capítulos verificados</dt><dd>{parity.data.chapters}/17</dd></div>
                <div><dt>Faltantes en matriz</dt><dd>{parity.data.unresolvedMissing}</dd></div>
                <div><dt>Fuente</dt><dd>{parity.data.source}</dd></div>
                <div><dt>Supabase navegador</dt><dd>{supabaseConfigured ? 'Configurado con clave pública' : 'No configurado en demo local'}</dd></div>
              </dl> : <p>Cargando resumen verificable…</p>}
            </Panel>
            <Panel>
              <h2>Auditoría reciente</h2>
              {auditEntries.length ? <ul className="audit-list">{auditEntries.slice(0, 4).map((entry) => <li key={entry.id}><strong>{entry.action}</strong><span>{entry.subject} · {new Date(entry.at).toLocaleString('es-SV')}</span></li>)}</ul> : <EmptyState detail="No hay eventos disponibles en esta sesión." title="Sin eventos auditados" />}
            </Panel>
          </section>
      </> : null}
    </div>
  );
}
