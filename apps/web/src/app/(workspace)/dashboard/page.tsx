'use client';

import { EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useAuth, useWorkspace } from '@/components/providers';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { videoParitySummary } from '@/lib/video-parity-summary';

function displayMetric(value: number | undefined, unit = '') {
  return value === undefined ? '—' : `${value}${unit}`;
}

export default function DashboardPage() {
  const { auditEntries, clinicalDocuments, error, hospitalizations, loading, patients, vitalReadings } = useWorkspace();
  const { can } = useAuth();
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
          <Panel><span>Pacientes activos</span><strong>{patients.filter((item) => item.status === 'ACTIVE').length}</strong><small>Registros sintéticos activos.</small></Panel>
          <Panel><span>Tratamientos actualizados</span><strong>—</strong><small>Sin fuente ni regla aprobada.</small></Panel>
          <Panel><span>Tratamientos por finalizar</span><strong>—</strong><small>Sin fuente ni regla aprobada.</small></Panel>
          <Panel><span>Planes de cuidado</span><strong>{carePlans}</strong><small>Documentos sintéticos no interpretados.</small></Panel>
          <Panel><span>Incidentes</span><strong>—</strong><small>Sin fuente ni regla aprobada.</small></Panel>
        </section>

        <Panel>
          <div className="table-heading">
            <div><h2>Últimas mediciones individuales</h2><p>Se muestran registros documentados sin etiquetarlos como normales o anormales.</p></div>
            <StatusTag tone="warning">Sin clasificar</StatusTag>
          </div>
          {recentReadings.length ? <div aria-label="Tabla de últimas mediciones individuales" className="table-wrap" tabIndex={0}><table><thead><tr><th>Acciones</th><th>Paciente</th><th>FC</th><th>FR</th><th>Oxígeno</th><th>Sistólica</th><th>Diastólica</th><th>Temp</th><th>Dolor</th><th>Glicemia</th><th>Fecha</th><th>Recurso</th></tr></thead><tbody>
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
              <dl className="definition-list">
                <div><dt>Requisitos trazados</dt><dd>{videoParitySummary.total}</dd></div>
                <div><dt>Exactos / parciales / faltantes</dt><dd>{videoParitySummary.EXACT ?? 0} / {videoParitySummary.PARTIAL ?? 0} / {videoParitySummary.MISSING ?? 0}</dd></div>
                <div><dt>Bloqueados</dt><dd>{(videoParitySummary.BLOCKED_CLIENT ?? 0) + (videoParitySummary.BLOCKED_INTEGRATION ?? 0)}</dd></div>
                <div><dt>Capítulos verificados</dt><dd>{videoParitySummary.chapters}/17</dd></div>
                <div><dt>SHA de matriz</dt><dd><code>{videoParitySummary.sourceSha.slice(0, 12)}</code></dd></div>
                <div><dt>Fecha de generación</dt><dd>{videoParitySummary.generatedAt}</dd></div>
                <div><dt>Supabase navegador</dt><dd>{supabaseConfigured ? 'Configurado con clave pública' : 'No configurado en demo local'}</dd></div>
              </dl>
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
