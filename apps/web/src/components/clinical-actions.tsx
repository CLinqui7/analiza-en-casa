'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Dialog, EmptyState, Panel } from '@analiza/ui';
import { normalizeText, normalizeDocument } from '@analiza/domain';
import {
  clinicalKinds,
  clinicalLabels,
  currentClinicalRecords,
  type ClinicalKind,
  type ClinicalRecord,
} from '@analiza/contracts';
import { useAuth, useWorkspace } from './providers';
import { useOperations } from '@/lib/use-operations';
import { ClinicalRecordEditor } from './clinical-record-editor';
import { ClinicalRecordView } from './clinical-record-view';
import { printClinicalSection } from '@/lib/clinical-queries';
import './clinical-workflow.css';
import { ActionMenu } from './common/action-menu';

const medical: ClinicalKind[] = ['INDICATION', 'EVOLUTION', 'HISTORY', 'BACKGROUND', 'VITALS'];
export function ClinicalActions({ initialKind }: { initialKind?: ClinicalKind }) {
  const operations = useOperations();
  const { patients, quotes } = useWorkspace();
  const { can } = useAuth();
  const [group, setGroup] = useState(
    initialKind && !medical.includes(initialKind) ? 'nursing' : 'medical',
  );
  const [kind, setKind] = useState<ClinicalKind>(initialKind ?? 'INDICATION');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<{ patient?: string; original?: ClinicalRecord } | null>(
    null,
  );
  const [message, setMessage] = useState('');
  const [viewed, setViewed] = useState<ClinicalRecord | null>(null);
  const [history, setHistory] = useState(false);
  const kinds =
    group === 'medical'
      ? medical
      : clinicalKinds.filter((kind) => !medical.includes(kind) || kind === 'VITALS');
  const visiblePatients = patients.filter(
    (patient) =>
      (normalizeText(patient.fullName).includes(normalizeText(query)) ||
        normalizeDocument(patient.documentId).includes(normalizeDocument(query))) &&
      (kind !== 'MEDICATION_CARD' || quotes.some((quote) => quote.patientId === patient.id)),
  );
  const matchingIds = new Set(visiblePatients.map((patient) => patient.id));
  const records = (
    history ? operations.clinicalRecords : currentClinicalRecords(operations.clinicalRecords)
  ).filter((record) => record.payload.kind === kind && matchingIds.has(record.patientId));
  return (
    <div className="page-stack clinical-workflow">
      <header className="clinical-hero">
        <div>
          <p className="eyebrow">Clínico</p>
          <h1>{initialKind ? clinicalLabels[kind] : 'Órdenes médicas'}</h1>
          <p>Registre la atención y consulte su historial en el expediente del paciente.</p>
        </div>
        <Link className="button button-secondary" href="/clinical">
          Ver expedientes
        </Link>
        {initialKind && can('clinical:write') ? (
          <Button onClick={() => setEditor({})}>
            {kind === 'FLUID_BALANCE'
              ? 'Registrar nuevo balance'
              : kind === 'CARE_PLAN'
                ? 'Nuevo plan de cuidado'
                : kind === 'ADMINISTRATION'
                  ? 'Registrar nueva administración'
                  : `Registrar ${clinicalLabels[kind].toLocaleLowerCase('es')}`}
          </Button>
        ) : null}
      </header>
      {!initialKind ? (
        <>
          <nav className="clinical-tabs" aria-label="Tipo de acción">
            <button
              aria-current={group === 'medical' ? 'page' : undefined}
              onClick={() => {
                setGroup('medical');
                setKind('INDICATION');
              }}
            >
              Acciones médicas
            </button>
            <button
              aria-current={group === 'nursing' ? 'page' : undefined}
              onClick={() => {
                setGroup('nursing');
                setKind('MEDICATION_CARD');
              }}
            >
              Acciones de enfermería
            </button>
          </nav>
          <div className="clinical-action-grid">
            {kinds.map((candidate) => (
              <button
                key={candidate}
                className={candidate === kind ? 'selected' : ''}
                aria-pressed={candidate === kind}
                onClick={() => setKind(candidate)}
              >
                <span aria-hidden="true">+</span>
                {clinicalLabels[candidate]}
              </button>
            ))}
          </div>
        </>
      ) : null}
      <Panel>
        <div className="table-heading">
          <h2>Pacientes</h2>
          <label className="clinical-search">
            Buscar por nombre o DUI
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
        <div className="clinical-patient-list">
          {visiblePatients.map((patient) => (
            <div key={patient.id}>
              <div>
                <strong>{patient.fullName}</strong>
                <small>{patient.documentId}</small>
              </div>
              <div className="clinical-patient-actions">
                {can('clinical:write') ? (
                  <Button
                    className="button-secondary"
                    onClick={() => {
                      setMessage('');
                      setEditor({ patient: patient.id });
                    }}
                  >
                    {clinicalLabels[kind]}
                  </Button>
                ) : (
                  <Link
                    className="button button-secondary"
                    href={`/clinical?patient=${encodeURIComponent(patient.id)}`}
                  >
                    Ver expediente
                  </Link>
                )}
                <ActionMenu
                  className="clinical-row-menu"
                  label={`Acciones para ${patient.fullName}`}
                  trigger="⋮"
                >
                  {group === 'medical' && can('clinical:write')
                    ? medical.map((action) => (
                        <Button
                          className="button-secondary"
                          key={action}
                          onClick={(event) => {
                            event.currentTarget.closest('details')?.removeAttribute('open');
                            setKind(action);
                            setEditor({ patient: patient.id });
                          }}
                        >
                          {clinicalLabels[action]}
                        </Button>
                      ))
                    : null}
                  {currentClinicalRecords(operations.clinicalRecords)
                    .filter(
                      (record) => record.patientId === patient.id && record.payload.kind === kind,
                    )
                    .map((record) => (
                      <div key={record.id}>
                        <small>
                          {record.caseId} · {record.date} · v{record.version}
                        </small>
                        <Button
                          className="button-secondary"
                          onClick={(event) => {
                            event.currentTarget.closest('details')?.removeAttribute('open');
                            setViewed(record);
                          }}
                        >
                          Ver
                        </Button>
                        {can('clinical:write') ? (
                          <Button
                            className="button-secondary"
                            onClick={(event) => {
                              event.currentTarget.closest('details')?.removeAttribute('open');
                              setEditor({ original: record });
                            }}
                          >
                            Editar
                          </Button>
                        ) : null}
                        <Button
                          className="button-secondary"
                          onClick={() => printClinicalSection(`clinical-record-${record.id}`)}
                        >
                          Imprimir
                        </Button>
                      </div>
                    ))}
                  {!records.some((record) => record.patientId === patient.id) ? (
                    <p>
                      Todavía no hay registros de {clinicalLabels[kind].toLocaleLowerCase('es')}.
                      Guarde el primero para verlo, editarlo o imprimirlo.
                    </p>
                  ) : null}
                </ActionMenu>
              </div>
            </div>
          ))}
        </div>
        {!visiblePatients.length ? (
          <EmptyState
            title="No hay pacientes para mostrar"
            detail={
              kind === 'MEDICATION_CARD'
                ? 'Las tarjetas se crean para pacientes con cotización.'
                : 'Ajuste la búsqueda o registre un paciente.'
            }
          />
        ) : null}
      </Panel>
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      {operations.error && !editor ? (
        <p className="notice error" role="alert">
          {operations.error}
        </p>
      ) : null}
      <section>
        <div className="table-heading">
          <h2>Registros · {clinicalLabels[kind]}</h2>
          <label className="clinical-check">
            <input
              type="checkbox"
              checked={history}
              onChange={(event) => setHistory(event.target.checked)}
            />
            Incluir versiones anteriores
          </label>
        </div>
        {records.map((record) => (
          <div key={record.id} className="clinical-record-block">
            <p className="clinical-record-patient">
              {patients.find((patient) => patient.id === record.patientId)?.fullName} ·{' '}
              {record.caseId}
            </p>
            <ClinicalRecordView
              record={record}
              patientName={patients.find((patient) => patient.id === record.patientId)?.fullName}
            />
            <div className="action-row">
              <Button
                className="button-secondary"
                onClick={() => printClinicalSection(`clinical-record-${record.id}`)}
              >
                Imprimir
              </Button>
              {can('clinical:write') &&
              currentClinicalRecords(operations.clinicalRecords).some(
                (current) => current.id === record.id,
              ) ? (
                <Button
                  className="button-secondary"
                  onClick={() => setEditor({ original: record })}
                >
                  {kind === 'MEDICATION_CARD' ? 'Editar tarjeta' : 'Corregir con nueva versión'}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {!records.length ? (
          <EmptyState
            title="Todavía no hay registros"
            detail="Seleccione un paciente para registrar la atención."
          />
        ) : null}
      </section>
      <p>
        <Link className="button button-secondary" href="/catalogs/clinical">
          Configurar diagnósticos y escalas
        </Link>
      </p>
      {viewed ? (
        <Dialog
          open
          title={clinicalLabels[viewed.payload.kind]}
          onClose={() => setViewed(null)}
          footer={<Button onClick={() => setViewed(null)}>Cerrar</Button>}
        >
          <ClinicalRecordView
            record={viewed}
            idPrefix="clinical-preview"
            patientName={patients.find((p) => p.id === viewed.patientId)?.fullName}
          />
        </Dialog>
      ) : null}
      {editor ? (
        <ClinicalRecordEditor
          key={`${kind}:${editor.original?.id ?? editor.patient ?? ''}`}
          kind={kind}
          patient={editor.patient}
          original={editor.original}
          operations={operations}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setMessage('Registro guardado en el expediente.');
          }}
        />
      ) : null}
    </div>
  );
}
