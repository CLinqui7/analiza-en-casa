'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, EmptyState, Panel } from '@analiza/ui';
import {
  currentClinicalRecords,
  clinicalLabels,
  type ClinicalKind,
  type ClinicalRecord,
} from '@analiza/contracts';
import {
  quoteDisplayCode,
  quoteCategories,
  normalizeText,
  normalizeDocument,
} from '@analiza/domain';
import { useWorkspace } from './providers';
import { useOperations } from '@/lib/use-operations';
import { ClinicalRecordView } from './clinical-record-view';
import { printClinicalSection } from '@/lib/clinical-queries';
import './clinical-workflow.css';

const sections = [
  'Resumen',
  'Acciones médicas',
  'Acciones de enfermería',
  'Visitas',
  'Expediente completo',
];
const medicalKinds = new Set(['INDICATION', 'EVOLUTION', 'HISTORY', 'BACKGROUND']);
const money = (amount: number) =>
  new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(amount);
export function ClinicalPatientRecord() {
  return (
    <Suspense fallback={<p>Cargando expediente…</p>}>
      <PatientRecordContent />
    </Suspense>
  );
}
function PatientRecordContent() {
  const params = useSearchParams();
  const {
    patients,
    hospitalizations,
    quotes,
    clinicalDocuments,
    vitalReadings,
    shifts,
    nursingResources,
    doctors,
  } = useWorkspace();
  const operations = useOperations();
  const [selectedPatient, setPatient] = useState(params.get('patient') ?? '');
  const [selectedCase, setCase] = useState(params.get('case') ?? '');
  // Keep historical report links useful after the client-approved regrouping.
  const [section, setSection] = useState(() => {
    const requested = params.get('section');
    return requested === 'clinical' || requested === 'nursing'
      ? 2
      : requested === 'medical'
        ? 1
        : 0;
  });
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState(false);
  const [days, setDays] = useState(7);
  const [history, setHistory] = useState(false);
  const [nursingKind, setNursingKind] = useState('ALL');
  const [medicalKind, setMedicalKind] = useState<ClinicalKind>('INDICATION');
  const requestedPatient =
    selectedPatient ||
    hospitalizations.find((record) => record.id === selectedCase)?.patientId ||
    '';
  const eligible = new Set([
    ...quotes.map((quote) => quote.patientId),
    ...clinicalDocuments.map((record) => record.patientId),
    ...operations.clinicalRecords.map((record) => record.patientId),
    ...hospitalizations.map((record) => record.patientId),
  ]);
  const [viewedAt] = useState(() => Date.now());
  const since = viewedAt - days * 86400000;
  const recentIds = new Set([
    ...operations.clinicalRecords
      .filter((record) => Date.parse(record.createdAt) >= since)
      .map((record) => record.patientId),
    ...clinicalDocuments
      .filter((record) => Date.parse(record.createdAt) >= since)
      .map((record) => record.patientId),
    ...quotes
      .filter((quote) => Date.parse(quote.createdAt) >= since)
      .map((quote) => quote.patientId),
    ...vitalReadings
      .filter((reading) => Date.parse(reading.measuredAt) >= since)
      .map((reading) => reading.patientId),
  ]);
  const visiblePatients = patients.filter(
    (patient) =>
      eligible.has(patient.id) &&
      (!recent || recentIds.has(patient.id)) &&
      (normalizeText(patient.fullName).includes(normalizeText(query)) ||
        normalizeDocument(patient.documentId).includes(normalizeDocument(query))),
  );
  const patient = patients.find((patient) => patient.id === requestedPatient);
  const patientCases = hospitalizations.filter((record) => record.patientId === requestedPatient);
  const inCase = (caseId?: string) => !selectedCase || caseId === selectedCase;
  const records = (
    history ? operations.clinicalRecords : currentClinicalRecords(operations.clinicalRecords)
  ).filter((record) => record.patientId === requestedPatient && inCase(record.caseId));
  const documents = clinicalDocuments.filter(
    (record) => record.patientId === requestedPatient && inCase(record.caseId),
  );
  const readings = vitalReadings.filter(
    (reading) => reading.patientId === requestedPatient && inCase(reading.caseId),
  );
  const patientQuotes = quotes.filter(
    (quote) =>
      quote.patientId === requestedPatient &&
      (inCase(quote.caseId) ||
        patientCases
          .find((record) => record.id === selectedCase)
          ?.linkedQuoteIds?.includes(quote.id)),
  );
  const visits = operations.visits.filter((visit) => visit.patientId === requestedPatient);
  const patientShifts = shifts.filter((shift) => shift.patientId === requestedPatient);
  function renderRecords(entries: ClinicalRecord[]) {
    return entries.map((record) => (
      <div className="clinical-record-block" key={record.id}>
        <ClinicalRecordView record={record} patientName={patient?.fullName} />
        <Button
          className="button-secondary no-print"
          onClick={() => printClinicalSection(`clinical-record-${record.id}`)}
        >
          Imprimir registro
        </Button>
      </div>
    ));
  }
  return (
    <div className="page-stack clinical-workflow">
      <header className="clinical-hero">
        <div>
          <p className="eyebrow">Reporte de salud</p>
          <h1>Expediente clínico</h1>
          <p>Cotizaciones, atención y visitas reunidas por paciente.</p>
        </div>
      </header>
      {operations.error ? (
        <p className="notice error" role="alert">
          {operations.error}
        </p>
      ) : null}
      <Panel>
        <div className="table-heading">
          <label>
            Buscar paciente
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Button
            className={recent ? '' : 'button-secondary'}
            aria-pressed={recent}
            onClick={() => setRecent(!recent)}
          >
            Recientemente actualizados · {recentIds.size}
          </Button>
          <label>
            Período
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={1}>Últimas 24 horas</option>
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
            </select>
          </label>
        </div>
        <label>
          Paciente
          <select
            value={requestedPatient}
            onChange={(event) => {
              setPatient(event.target.value);
              setCase('');
              setSection(0);
            }}
          >
            <option value="">Seleccione paciente</option>
            {visiblePatients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.fullName} · {patient.documentId}
              </option>
            ))}
          </select>
        </label>
        {!patient ? (
          <div className="clinical-patient-list">
            {visiblePatients.map((patient) => (
              <div key={patient.id}>
                <div>
                  <strong>{patient.fullName}</strong>
                  <small>{patient.documentId}</small>
                </div>
                <Button
                  className="button-secondary"
                  onClick={() => {
                    setPatient(patient.id);
                    setCase('');
                  }}
                >
                  Abrir expediente
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>
      {patient ? (
        <>
          <div className="table-heading">
            {selectedCase ? (
              <Link
                className="button button-secondary"
                href={`/hospitalizations/${encodeURIComponent(selectedCase)}`}
              >
                Abrir caso
              </Link>
            ) : null}
            <label>
              Hospitalización
              <select
                value={selectedCase}
                onChange={(event) => {
                  setPatient(requestedPatient);
                  setCase(event.target.value);
                }}
              >
                <option value="">Todas las hospitalizaciones</option>
                {patientCases.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.id} · {record.startDate}
                  </option>
                ))}
              </select>
            </label>
            <label className="clinical-check">
              <input
                type="checkbox"
                checked={history}
                onChange={(event) => setHistory(event.target.checked)}
              />
              Mostrar versiones anteriores
            </label>
            <Button onClick={() => printClinicalSection('patient-record-print')}>
              Imprimir {section === 4 ? 'expediente completo' : 'sección'}
            </Button>
          </div>
          <nav className="clinical-tabs" aria-label="Secciones del expediente">
            {sections.map((label, index) => (
              <button
                key={label}
                aria-current={index === section ? 'page' : undefined}
                onClick={() => setSection(index)}
              >
                {String(index + 1).padStart(2, '0')} · {label}
              </button>
            ))}
          </nav>
          <section id="patient-record-print">
            <header>
              <h2>{patient.fullName}</h2>
              <p>
                {patient.documentId} · {selectedCase || 'Todas las hospitalizaciones'} ·{' '}
                {sections[section]}
              </p>
            </header>
            {section === 0 || section === 4 ? (
              <section>
                <h2>Resumen · cotizaciones</h2>
                {patientCases
                  .filter((record) => inCase(record.id))
                  .map((record) => (
                    <p key={record.id}>
                      {record.id} · Diagnóstico: {record.diagnosisSummary || 'Sin registrar'} ·
                      Médico:{' '}
                      {doctors.find((doctor) => doctor.id === record.primaryDoctorId)?.fullName ??
                        'Sin asignar'}
                    </p>
                  ))}
                {patientQuotes.map((quote) => (
                  <article className="clinical-record-block" key={quote.id}>
                    <h3>
                      {quoteDisplayCode(quote.id)} · Versión {quote.version} ·{' '}
                      {quote.status === 'SENT' ? 'Enviada' : 'Borrador'}
                    </h3>
                    <p>{quote.diagnosisSummary}</p>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Categoría</th>
                            <th>Concepto</th>
                            <th>Cantidad</th>
                            <th>Precio</th>
                            <th>Descuento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quote.items.map((item) => (
                            <tr key={item.id}>
                              <td>
                                {
                                  quoteCategories.find(
                                    (category) => category.value === item.category,
                                  )?.label
                                }
                              </td>
                              <td>{item.name}</td>
                              <td>{item.quantity}</td>
                              <td>{money(item.unitPrice)}</td>
                              <td>{money(item.discountAmount ?? 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p>
                      Subtotal: {money(quote.subtotal)} · Descuento: {money(quote.discountAmount)} ·
                      Total: {money(quote.total)}
                    </p>
                    <p>
                      Aseguradora: {money(quote.insurerAmount)} · Paciente:{' '}
                      {money(quote.patientAmount)}
                    </p>
                    <p>{quote.comments}</p>
                    <Link
                      className="button button-secondary no-print"
                      href={`/quotes/${encodeURIComponent(quote.id)}`}
                    >
                      Ver cotización completa
                    </Link>
                  </article>
                ))}
              </section>
            ) : null}
            {section === 1 || section === 4 ? (
              <section>
                <h2>Acciones médicas</h2>
                {section === 1 ? (
                  <nav className="clinical-action-grid no-print" aria-label="Registros médicos">
                    {(['INDICATION', 'EVOLUTION', 'HISTORY', 'BACKGROUND', 'VITALS'] as const).map(
                      (kind) => (
                        <button
                          key={kind}
                          className={medicalKind === kind ? 'selected' : ''}
                          aria-pressed={medicalKind === kind}
                          onClick={() => setMedicalKind(kind)}
                        >
                          <span aria-hidden="true">+</span>
                          {clinicalLabels[kind]}
                        </button>
                      ),
                    )}
                  </nav>
                ) : null}
                {renderRecords(
                  records.filter((record) =>
                    section === 4
                      ? medicalKinds.has(record.payload.kind)
                      : record.payload.kind === medicalKind,
                  ),
                )}
                {section === 1 && !records.some((record) => record.payload.kind === medicalKind) ? (
                  <p className="notice">
                    No hay registros de {clinicalLabels[medicalKind].toLocaleLowerCase('es')} para
                    esta selección.
                  </p>
                ) : null}
                {section === 1 && medicalKind === 'VITALS' && readings.length ? (
                  <div className="table-wrap">
                    <table>
                      <caption>Signos vitales anteriores</caption>
                      <thead>
                        <tr>
                          <th>Fecha y hora</th>
                          <th>FC</th>
                          <th>FR</th>
                          <th>SpO₂</th>
                          <th>Temperatura</th>
                          <th>PA</th>
                          <th>HGT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {readings.map((r) => (
                          <tr key={r.id}>
                            <td>{new Date(r.measuredAt).toLocaleString('es-SV')}</td>
                            <td>{r.heartRate ?? r.pulse ?? '—'}</td>
                            <td>{r.respiratoryRate ?? '—'}</td>
                            <td>{r.oxygenSaturation ?? '—'}</td>
                            <td>{r.temperature ?? '—'}</td>
                            <td>
                              {r.systolic ?? '—'}/{r.diastolic ?? '—'}
                            </td>
                            <td>{r.glucose ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {documents
                  .filter(
                    (record) =>
                      record.type === 'CLINICAL_EVOLUTION' &&
                      (section === 4 || medicalKind === 'EVOLUTION'),
                  )
                  .map((record) => (
                    <article className="clinical-record-block" key={record.id}>
                      <h3>{record.title}</h3>
                      <p>
                        {record.createdAt} · {record.author} ·{' '}
                        {record.status === 'SIGNED' ? 'Firmado' : 'Borrador'} · v{record.version}
                      </p>
                      <p className="clinical-prose">{record.summary}</p>
                    </article>
                  ))}
              </section>
            ) : null}
            {section === 2 || section === 4 ? (
              <section>
                <h2>Acciones de enfermería</h2>
                {section === 2 ? (
                  <nav className="clinical-tabs no-print" aria-label="Registros de enfermería">
                    {[
                      ['ALL', 'Todos los registros'],
                      ['MEDICATION_CARD', 'Tarjetas de medicamentos'],
                      ['FLUID_BALANCE', 'Balances hídricos'],
                      ['CARE_PLAN', 'Planes de cuidado'],
                      ['ADMINISTRATION', 'Administración de medicamentos'],
                      ['VITALS', 'Signos vitales'],
                      ['NURSING_NOTE', 'Notas de enfermería'],
                      ['SCALE', 'Escalas'],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        aria-current={nursingKind === key ? 'page' : undefined}
                        onClick={() => setNursingKind(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </nav>
                ) : null}
                {renderRecords(
                  records.filter(
                    (record) =>
                      !medicalKinds.has(record.payload.kind) &&
                      (section === 4 ||
                        nursingKind === 'ALL' ||
                        nursingKind === record.payload.kind),
                  ),
                )}
                {documents
                  .filter(
                    (record) =>
                      record.type === 'CARE_PLAN' &&
                      (section === 4 || nursingKind === 'ALL' || nursingKind === 'CARE_PLAN'),
                  )
                  .map((record) => (
                    <article className="clinical-record-block" key={record.id}>
                      <h3>{record.title}</h3>
                      <p>
                        {record.createdAt} · {record.author} ·{' '}
                        {record.status === 'SIGNED' ? 'Firmado' : 'Borrador'} · v{record.version}
                      </p>
                      <p className="clinical-prose">{record.summary}</p>
                    </article>
                  ))}
                {readings.length &&
                (section === 4 || nursingKind === 'ALL' || nursingKind === 'VITALS') ? (
                  <article className="clinical-record-block">
                    <h3>Signos vitales registrados anteriormente</h3>
                    {readings.map((reading) => (
                      <p key={reading.id}>
                        {reading.measuredAt} · Origen:{' '}
                        {reading.source === 'patient' ? 'Paciente' : 'Clínico'} ·{' '}
                        {reading.professional ?? ''} · FC{' '}
                        {reading.heartRate ?? reading.pulse ?? '—'} · FR{' '}
                        {reading.respiratoryRate ?? '—'} · SpO₂ {reading.oxygenSaturation ?? '—'} ·
                        Temperatura {reading.temperature ?? '—'} · PA {reading.systolic ?? '—'}/
                        {reading.diastolic ?? '—'} · HGT {reading.glucose ?? '—'} · {reading.note}
                      </p>
                    ))}
                  </article>
                ) : null}
                <Link className="no-print" href="/clinical/document-versions">
                  Firmas y correcciones de documentos anteriores
                </Link>
              </section>
            ) : null}
            {section === 3 || section === 4 ? (
              <section>
                <h2>Visitas del paciente</h2>
                <p>
                  Agenda y visitas registradas por paciente; los turnos no tienen una
                  hospitalización vinculada.
                </p>
                <div className="table-wrap clinical-visits-table">
                  <table>
                    <caption>Visitas registradas de enfermería</caption>
                    <thead>
                      <tr>
                        <th>Nombre de la enfermera</th>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>JVPE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visits
                        .filter((visit) => visit.profession === 'NURSE')
                        .map((visit) => {
                          const nurse = nursingResources.find(
                            (resource) => resource.userId === visit.professionalUserId,
                          );
                          return (
                            <tr key={visit.id}>
                              <td>
                                {visit.professionalName}
                                {visit.note ? (
                                  <details>
                                    <summary>Observaciones</summary>
                                    <p>{visit.note}</p>
                                  </details>
                                ) : null}
                              </td>
                              <td>{new Date(visit.occurredAt).toLocaleDateString('es-SV')}</td>
                              <td>
                                {new Date(visit.occurredAt).toLocaleTimeString('es-SV', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td>{nurse?.boardRegistrationNumber || 'No registrado'}</td>
                            </tr>
                          );
                        })}
                      {!visits.some((v) => v.profession === 'NURSE') ? (
                        <tr>
                          <td colSpan={4}>No hay visitas de enfermería registradas.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                {visits
                  .filter((visit) => visit.profession === 'DOCTOR')
                  .map((visit) => (
                    <article className="clinical-record-block" key={visit.id}>
                      <h3>Visita médica · {visit.professionalName}</h3>
                      <p>
                        {new Date(visit.occurredAt).toLocaleString('es-SV')} · {visit.note}
                      </p>
                    </article>
                  ))}
                <div className="table-wrap clinical-visits-table">
                  <table>
                    <caption>Turnos de Agenda</caption>
                    <thead>
                      <tr>
                        <th>Nombre de la enfermera</th>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>JVPE</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patientShifts.map((shift) => {
                        const nurse = nursingResources.find(
                          (resource) => resource.id === shift.resourceId,
                        );
                        return (
                          <tr key={shift.id}>
                            <td>
                              {nurse?.displayName ?? 'Personal asignado'}
                              {shift.note ? <p>{shift.note}</p> : null}
                            </td>
                            <td>{new Date(shift.startsAt).toLocaleDateString('es-SV')}</td>
                            <td>
                              {new Date(shift.startsAt).toLocaleTimeString('es-SV', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              –{' '}
                              {new Date(shift.endsAt).toLocaleTimeString('es-SV', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td>{nurse?.boardRegistrationNumber || 'No registrado'}</td>
                            <td>
                              {
                                {
                                  SCHEDULED: 'Programado',
                                  CANCELLED: 'Cancelado',
                                  COMPLETED: 'Completado',
                                }[shift.status]
                              }
                            </td>
                          </tr>
                        );
                      })}
                      {!patientShifts.length ? (
                        <tr>
                          <td colSpan={5}>No hay turnos registrados.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </section>
        </>
      ) : (
        <EmptyState
          title="Seleccione un expediente"
          detail="La lista incluye pacientes con cotizaciones o registros clínicos."
        />
      )}
    </div>
  );
}
