'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, EmptyState, Panel } from '@analiza/ui';
import { currentClinicalRecords, type ClinicalRecord } from '@analiza/contracts';
import { quoteDisplayCode, quoteCategories } from '@analiza/domain';
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
  const [section, setSection] = useState(0);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState(false);
  const [days, setDays] = useState(7);
  const [history, setHistory] = useState(false);
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
      `${patient.fullName} ${patient.documentId}`
        .toLocaleLowerCase('es')
        .includes(query.toLocaleLowerCase('es')),
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
        <Link className="button button-secondary" href="/clinical/orders">
          Registrar atención
        </Link>
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
            <label>
              Hospitalización
              <select value={selectedCase} onChange={(event) => setCase(event.target.value)}>
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
                    <Link className="no-print" href={`/quotes/${encodeURIComponent(quote.id)}`}>
                      Ver cotización completa
                    </Link>
                  </article>
                ))}
              </section>
            ) : null}
            {section === 1 || section === 4 ? (
              <section>
                <h2>Acciones médicas</h2>
                {renderRecords(records.filter((record) => medicalKinds.has(record.payload.kind)))}
                {documents
                  .filter((record) => record.type === 'CLINICAL_EVOLUTION')
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
                {renderRecords(records.filter((record) => !medicalKinds.has(record.payload.kind)))}
                {documents
                  .filter((record) => record.type === 'CARE_PLAN')
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
                {readings.length ? (
                  <article className="clinical-record-block">
                    <h3>Signos vitales registrados anteriormente</h3>
                    {readings.map((reading) => (
                      <p key={reading.id}>
                        {reading.measuredAt} · Origen:{' '}
                        {reading.source === 'patient' ? 'Paciente' : 'Clínico'} ·{' '}
                        {reading.professional ?? ''} · FC {reading.heartRate ?? '—'} · FR{' '}
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
                {visits.map((visit) => (
                  <article className="clinical-record-block" key={visit.id}>
                    <h3>{visit.professionalName}</h3>
                    <p>
                      {visit.occurredAt} · {visit.note}
                    </p>
                  </article>
                ))}
                {patientShifts.map((shift) => (
                  <article className="clinical-record-block" key={shift.id}>
                    <h3>
                      {nursingResources.find((resource) => resource.id === shift.resourceId)
                        ?.displayName ?? 'Personal asignado'}
                    </h3>
                    <p>
                      {shift.startsAt} — {shift.endsAt} · {shift.status}
                    </p>
                    <p>{shift.note}</p>
                  </article>
                ))}
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
