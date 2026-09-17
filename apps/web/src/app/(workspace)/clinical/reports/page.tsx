'use client';

import type {
  ClinicalDocument,
  Doctor,
  Hospitalization,
  Patient,
  VitalReading,
} from '@analiza/contracts';
import { EmptyState, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useWorkspace } from '@/components/providers';
import './health-report.css';

const reportSections = [
  ['information', 'Resumen', '01'],
  ['clinical', 'Evaluación clínica', '02'],
  ['medical', 'Equipo médico', '03'],
  ['treatments', 'Planes y evoluciones', '04'],
  ['events', 'Línea de tiempo', '05'],
  ['evidence', 'Documentos', '06'],
] as const;

type ReportSectionId = (typeof reportSections)[number][0];

function shortId(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function formatDate(value?: string) {
  if (!value) return 'En curso';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('es-SV', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date);
}

function hospitalizationStatus(record: Hospitalization) {
  if (record.status === 'ACTIVE') return ['Activa', 'success'] as const;
  if (record.status === 'PENDING_CLOSE') return ['Cierre pendiente', 'warning'] as const;
  return ['Cerrada', 'neutral'] as const;
}

function ReadingMetric({ label, value, unit }: { label: string; value?: number; unit: string }) {
  return (
    <article className="health-reading-metric">
      <span>{label}</span>
      <strong>{value ?? '—'}</strong>
      <small>{value === undefined ? 'Sin registro' : unit}</small>
    </article>
  );
}

function ReportEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="health-report-empty">
      <span aria-hidden="true">+</span>
      <EmptyState detail={detail} title={title} />
    </div>
  );
}

export default function HealthReportPage() {
  const { clinicalDocuments, doctors, hospitalizations, patients, vitalReadings } = useWorkspace();
  const [query, setQuery] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [selectedSection, setSelectedSection] = useState<ReportSectionId>('information');

  const reports = useMemo(
    () =>
      hospitalizations.map((hospitalization) => ({
        hospitalization,
        patient: patients.find((patient) => patient.id === hospitalization.patientId),
      })),
    [hospitalizations, patients],
  );
  const visibleReports = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    if (!normalized) return reports;
    return reports.filter(({ hospitalization, patient }) =>
      [
        hospitalization.id,
        hospitalization.diagnosisSummary,
        patient?.fullName,
        patient?.documentId,
        patient?.company,
      ].some((value) => value?.toLocaleLowerCase('es').includes(normalized)),
    );
  }, [query, reports]);
  const selected =
    reports.find(({ hospitalization }) => hospitalization.id === selectedCaseId) ??
    visibleReports[0] ??
    reports[0];
  const selectedHospitalization = selected?.hospitalization;
  const selectedPatient = selected?.patient;
  const caseReadings = useMemo(
    () =>
      selectedHospitalization
        ? vitalReadings
            .filter(
              (reading) =>
                reading.caseId === selectedHospitalization.id ||
                reading.patientId === selectedHospitalization.patientId,
            )
            .slice()
            .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
        : [],
    [selectedHospitalization, vitalReadings],
  );
  const caseDocuments = useMemo(
    () =>
      selectedHospitalization
        ? clinicalDocuments
            .filter((document) => document.caseId === selectedHospitalization.id)
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [clinicalDocuments, selectedHospitalization],
  );
  const latestReading = caseReadings[0];
  const primaryDoctor = doctors.find(
    (doctor) => doctor.id === selectedHospitalization?.primaryDoctorId,
  );
  const secondaryDoctor = doctors.find(
    (doctor) => doctor.id === selectedHospitalization?.secondaryDoctorId,
  );
  const activeCount = hospitalizations.filter((record) => record.status === 'ACTIVE').length;
  const signedCount = clinicalDocuments.filter((document) => document.status === 'SIGNED').length;

  function selectReport(id: string) {
    setSelectedCaseId(id);
    setSelectedSection('information');
  }

  return (
    <div className="page-stack health-report-page">
      <header className="health-report-hero">
        <div className="health-report-hero-copy">
          <span className="health-report-hero-icon" aria-hidden="true">
            ✚
          </span>
          <div>
            <p className="eyebrow">Expediente clínico</p>
            <h1>Reporte de salud</h1>
            <p>Una vista clara del caso, sus registros clínicos y la documentación disponible.</p>
          </div>
        </div>
        <div className="health-report-hero-actions no-print">
          <button
            className="health-action-button secondary"
            onClick={() => window.print()}
            type="button"
          >
            <span aria-hidden="true">⇩</span> Imprimir reporte
          </button>
          <Link className="health-action-button" href="/clinical/hospitalizations">
            Ver hospitalizaciones <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      <section className="health-report-metrics" aria-label="Resumen de reportes">
        <article>
          <span className="metric-symbol teal" aria-hidden="true">
            H
          </span>
          <div>
            <small>Hospitalizaciones</small>
            <strong>{hospitalizations.length}</strong>
            <span>{activeCount} activas</span>
          </div>
        </article>
        <article>
          <span className="metric-symbol coral" aria-hidden="true">
            P
          </span>
          <div>
            <small>Pacientes con reporte</small>
            <strong>{new Set(hospitalizations.map((item) => item.patientId)).size}</strong>
            <span>En este espacio</span>
          </div>
        </article>
        <article>
          <span className="metric-symbol blue" aria-hidden="true">
            V
          </span>
          <div>
            <small>Signos vitales</small>
            <strong>{vitalReadings.length}</strong>
            <span>Lecturas registradas</span>
          </div>
        </article>
        <article>
          <span className="metric-symbol violet" aria-hidden="true">
            D
          </span>
          <div>
            <small>Documentos firmados</small>
            <strong>{signedCount}</strong>
            <span>De {clinicalDocuments.length} documentos</span>
          </div>
        </article>
      </section>

      <section className="health-report-workspace">
        <aside className="health-report-index no-print" aria-label="Reportes disponibles">
          <div className="health-report-index-heading">
            <div>
              <h2>Pacientes</h2>
              <span>{visibleReports.length} reportes</span>
            </div>
            <span className="health-live">
              <i /> En línea
            </span>
          </div>
          <label className="health-report-search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Buscar reporte</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nombre, DUI, diagnóstico…"
              type="search"
              value={query}
            />
            {query ? (
              <button aria-label="Limpiar búsqueda" onClick={() => setQuery('')} type="button">
                ×
              </button>
            ) : null}
          </label>
          <div className="health-report-list">
            {visibleReports.map(({ hospitalization, patient }) => {
              const [status, tone] = hospitalizationStatus(hospitalization);
              const active = hospitalization.id === selectedHospitalization?.id;
              return (
                <button
                  aria-current={active ? 'true' : undefined}
                  className="health-report-list-item"
                  key={hospitalization.id}
                  onClick={() => selectReport(hospitalization.id)}
                  type="button"
                >
                  <span className="health-patient-avatar" aria-hidden="true">
                    {patient?.fullName?.slice(0, 1).toLocaleUpperCase('es') ?? 'P'}
                  </span>
                  <span className="health-report-list-copy">
                    <strong>{patient?.fullName ?? 'Paciente no disponible'}</strong>
                    <small>
                      DUI {patient?.documentId ?? '—'} · {shortId(hospitalization.id)}
                    </small>
                    <span>{hospitalization.diagnosisSummary || 'Sin diagnóstico registrado'}</span>
                  </span>
                  <StatusTag tone={tone}>{status}</StatusTag>
                </button>
              );
            })}
            {!visibleReports.length ? (
              <ReportEmpty
                title="Sin resultados"
                detail="Pruebe con otro nombre, DUI o diagnóstico."
              />
            ) : null}
          </div>
        </aside>

        <main className="health-report-detail">
          {selectedHospitalization && selectedPatient ? (
            <>
              <section className="health-patient-summary">
                <div className="health-patient-summary-main">
                  <span className="health-patient-avatar large" aria-hidden="true">
                    {selectedPatient.fullName.slice(0, 1).toLocaleUpperCase('es')}
                  </span>
                  <div>
                    <div className="health-patient-name-line">
                      <h2>{selectedPatient.fullName}</h2>
                      <StatusTag tone={hospitalizationStatus(selectedHospitalization)[1]}>
                        {hospitalizationStatus(selectedHospitalization)[0]}
                      </StatusTag>
                    </div>
                    <p>
                      DUI {selectedPatient.documentId} · Caso {shortId(selectedHospitalization.id)}
                    </p>
                    <div className="health-patient-chips">
                      <span>
                        {selectedPatient.bloodType
                          ? `Sangre ${selectedPatient.bloodType}`
                          : 'Tipo de sangre pendiente'}
                      </span>
                      <span>{selectedHospitalization.accountType}</span>
                      <span>{selectedHospitalization.insurer || 'Particular'}</span>
                    </div>
                  </div>
                </div>
                <div className="health-case-actions no-print">
                  <Link href={`/clinical/hospitalizations/${selectedHospitalization.id}`}>
                    Abrir caso
                  </Link>
                  <details>
                    <summary aria-label="Más acciones">•••</summary>
                    <div>
                      <Link href={`/clinical/hospitalizations/${selectedHospitalization.id}`}>
                        Historia clínica
                      </Link>
                      <Link href="/clinical/visits">Visitas</Link>
                      <Link href="/clinical/evolutions">Evoluciones</Link>
                    </div>
                  </details>
                </div>
              </section>

              <nav
                className="health-report-tabs no-print"
                aria-label="Secciones del reporte"
                role="tablist"
              >
                {reportSections.map(([id, label, number]) => (
                  <button
                    aria-selected={selectedSection === id}
                    className={selectedSection === id ? 'active' : undefined}
                    key={id}
                    onClick={() => setSelectedSection(id)}
                    role="tab"
                    type="button"
                  >
                    <span>{number}</span>
                    {label}
                  </button>
                ))}
              </nav>

              <div className="health-report-section" role="tabpanel">
                {selectedSection === 'information' ? (
                  <OverviewSection
                    hospitalization={selectedHospitalization}
                    patient={selectedPatient}
                    primaryDoctor={primaryDoctor?.fullName}
                    secondaryDoctor={secondaryDoctor?.fullName}
                  />
                ) : null}
                {selectedSection === 'clinical' ? (
                  <ClinicalSection latest={latestReading} readings={caseReadings} />
                ) : null}
                {selectedSection === 'medical' ? (
                  <MedicalSection primaryDoctor={primaryDoctor} secondaryDoctor={secondaryDoctor} />
                ) : null}
                {selectedSection === 'treatments' ? (
                  <DocumentSection documents={caseDocuments} />
                ) : null}
                {selectedSection === 'events' ? (
                  <TimelineSection
                    hospitalization={selectedHospitalization}
                    documents={caseDocuments}
                    readings={caseReadings}
                  />
                ) : null}
                {selectedSection === 'evidence' ? (
                  <EvidenceSection documents={caseDocuments} />
                ) : null}
              </div>
            </>
          ) : (
            <ReportEmpty
              detail="Cuando exista una hospitalización, aquí aparecerá el resumen completo del paciente."
              title="Aún no hay reportes de salud"
            />
          )}
        </main>
      </section>
    </div>
  );
}

function OverviewSection({
  hospitalization,
  patient,
  primaryDoctor,
  secondaryDoctor,
}: {
  hospitalization: Hospitalization;
  patient: Patient;
  primaryDoctor?: string;
  secondaryDoctor?: string;
}) {
  return (
    <div className="health-overview-grid">
      <article className="health-content-card wide">
        <header>
          <div>
            <span className="health-card-icon">D</span>
            <div>
              <h3>Diagnóstico y plan</h3>
              <p>Información principal del caso</p>
            </div>
          </div>
          <StatusTag>Actual</StatusTag>
        </header>
        <div className="health-diagnosis">
          <span>Diagnóstico registrado</span>
          <strong>{hospitalization.diagnosisSummary || 'Pendiente de registrar'}</strong>
          <p>
            {hospitalization.nextAction || 'No hay una siguiente acción registrada para este caso.'}
          </p>
        </div>
      </article>
      <article className="health-content-card">
        <header>
          <div>
            <span className="health-card-icon coral">C</span>
            <div>
              <h3>Datos del caso</h3>
              <p>Período y cobertura</p>
            </div>
          </div>
        </header>
        <dl>
          <div>
            <dt>Ingreso</dt>
            <dd>{formatDate(hospitalization.startDate)}</dd>
          </div>
          <div>
            <dt>Alta</dt>
            <dd>{formatDate(hospitalization.endDate)}</dd>
          </div>
          <div>
            <dt>Cuenta</dt>
            <dd>{hospitalization.accountType}</dd>
          </div>
          <div>
            <dt>Aseguradora</dt>
            <dd>{hospitalization.insurer || 'Particular'}</dd>
          </div>
        </dl>
      </article>
      <article className="health-content-card">
        <header>
          <div>
            <span className="health-card-icon blue">P</span>
            <div>
              <h3>Contacto</h3>
              <p>Información del paciente</p>
            </div>
          </div>
        </header>
        <dl>
          <div>
            <dt>Nacimiento</dt>
            <dd>{formatDate(patient.birthDate)}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>{patient.phone || '—'}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{patient.email || '—'}</dd>
          </div>
          <div>
            <dt>Empresa</dt>
            <dd>{patient.company || '—'}</dd>
          </div>
        </dl>
      </article>
      <article className="health-content-card wide">
        <header>
          <div>
            <span className="health-card-icon violet">M</span>
            <div>
              <h3>Equipo médico</h3>
              <p>Responsables asignados</p>
            </div>
          </div>
        </header>
        <div className="health-doctor-row">
          <div>
            <span>Tratante principal</span>
            <strong>{primaryDoctor || 'Sin asignar'}</strong>
          </div>
          <div>
            <span>Tratante secundario</span>
            <strong>{secondaryDoctor || 'Sin asignar'}</strong>
          </div>
          <div>
            <span>Visitador médico</span>
            <strong>{hospitalization.manager || 'Sin asignar'}</strong>
          </div>
        </div>
      </article>
    </div>
  );
}

function ClinicalSection({
  latest,
  readings,
}: {
  latest?: VitalReading;
  readings: VitalReading[];
}) {
  return (
    <div className="health-section-stack">
      <div className="health-section-heading">
        <div>
          <h3>Evaluación clínica</h3>
          <p>
            {latest
              ? `Última lectura: ${formatDate(latest.measuredAt)}`
              : 'No hay lecturas registradas'}
          </p>
        </div>
        <StatusTag tone={latest ? 'success' : 'neutral'}>{readings.length} lecturas</StatusTag>
      </div>
      <div className="health-reading-grid">
        <ReadingMetric
          label="Frecuencia cardiaca"
          value={latest?.heartRate ?? latest?.pulse}
          unit="lpm"
        />
        <ReadingMetric label="Presión sistólica" value={latest?.systolic} unit="mmHg" />
        <ReadingMetric label="Presión diastólica" value={latest?.diastolic} unit="mmHg" />
        <ReadingMetric label="Saturación O₂" value={latest?.oxygenSaturation} unit="%" />
        <ReadingMetric label="Temperatura" value={latest?.temperature} unit="°C" />
        <ReadingMetric label="Glucosa" value={latest?.glucose} unit="mg/dL" />
      </div>
      {latest?.note ? (
        <div className="health-note">
          <strong>Nota de la lectura</strong>
          <p>{latest.note}</p>
        </div>
      ) : null}
    </div>
  );
}

function MedicalSection({
  primaryDoctor,
  secondaryDoctor,
}: {
  primaryDoctor?: Doctor;
  secondaryDoctor?: Doctor;
}) {
  const team = [
    [primaryDoctor, 'Médico tratante principal'],
    [secondaryDoctor, 'Médico tratante secundario'],
  ] as const;
  return (
    <div className="health-team-grid">
      {team.map(([doctor, role]) =>
        doctor ? (
          <article className="health-team-card" key={role}>
            <span className="health-patient-avatar">{doctor.fullName.slice(0, 1)}</span>
            <div>
              <small>{role}</small>
              <h3>{doctor.fullName}</h3>
              <p>{doctor.specialty}</p>
              <span>{doctor.phone || doctor.email || 'Sin contacto registrado'}</span>
            </div>
          </article>
        ) : (
          <ReportEmpty key={role} title={role} detail="Todavía no hay un profesional asignado." />
        ),
      )}
    </div>
  );
}

function DocumentSection({ documents }: { documents: ClinicalDocument[] }) {
  if (!documents.length)
    return (
      <ReportEmpty
        title="Sin planes o evoluciones"
        detail="Los documentos clínicos del caso aparecerán aquí."
      />
    );
  return (
    <div className="health-document-list">
      {documents.map((document) => (
        <article key={document.id}>
          <span className="health-card-icon">{document.type === 'CARE_PLAN' ? 'P' : 'E'}</span>
          <div>
            <div>
              <h3>{document.title}</h3>
              <StatusTag tone={document.status === 'SIGNED' ? 'success' : 'warning'}>
                {document.status === 'SIGNED' ? 'Firmado' : 'Borrador'}
              </StatusTag>
            </div>
            <p>{document.summary}</p>
            <small>
              {document.author} · v{document.version} · {formatDate(document.createdAt)}
            </small>
          </div>
        </article>
      ))}
    </div>
  );
}

function TimelineSection({
  hospitalization,
  documents,
  readings,
}: {
  hospitalization: Hospitalization;
  documents: ClinicalDocument[];
  readings: VitalReading[];
}) {
  const events = [
    {
      id: 'admission',
      at: hospitalization.startDate,
      title: 'Inicio de hospitalización',
      detail: hospitalization.diagnosisSummary || 'Caso abierto',
    },
    ...documents.map((document) => ({
      id: document.id,
      at: document.createdAt,
      title: document.title,
      detail: `${document.author} · ${document.status === 'SIGNED' ? 'Firmado' : 'Borrador'}`,
    })),
    ...readings.map((reading) => ({
      id: reading.id,
      at: reading.measuredAt,
      title: 'Lectura de signos vitales',
      detail: reading.professional || 'Registro clínico',
    })),
    ...(hospitalization.endDate
      ? [
          {
            id: 'discharge',
            at: hospitalization.endDate,
            title: 'Alta de hospitalización',
            detail: 'Caso cerrado',
          },
        ]
      : []),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <ol className="health-timeline">
      {events.map((event) => (
        <li key={event.id}>
          <i />
          <time>{formatDate(event.at)}</time>
          <div>
            <strong>{event.title}</strong>
            <span>{event.detail}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function EvidenceSection({ documents }: { documents: ClinicalDocument[] }) {
  if (!documents.length)
    return (
      <ReportEmpty
        title="Sin documentos disponibles"
        detail="Los documentos creados para esta hospitalización se mostrarán aquí."
      />
    );
  return (
    <div className="health-evidence-grid">
      {documents.map((document) => (
        <article key={document.id}>
          <span className="health-card-icon coral">DOC</span>
          <div>
            <strong>{document.title}</strong>
            <small>
              {document.type === 'CARE_PLAN' ? 'Plan de cuidado' : 'Evolución clínica'} · v
              {document.version}
            </small>
          </div>
          <StatusTag tone={document.status === 'SIGNED' ? 'success' : 'warning'}>
            {document.status === 'SIGNED' ? 'Firmado' : 'Borrador'}
          </StatusTag>
        </article>
      ))}
    </div>
  );
}
