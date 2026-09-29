'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';
import type { ClinicalScaleCapture } from '@/lib/clinical-scale-capture';
import { clinicalScaleReferences } from '@/lib/clinical-scale-references';

function localDateTimeNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function readableDate(value: string) {
  return new Intl.DateTimeFormat('es-SV', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

async function responseError(response: Response, fallback: string) {
  const body: unknown = await response.json().catch(() => null);
  return body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
    ? body.error
    : fallback;
}

export function PatientScaleWorkspace({
  patientId,
  initialScaleId,
}: {
  patientId: string;
  initialScaleId: string | null;
}) {
  const { can, session } = useAuth();
  const { loading: workspaceLoading, patients, hospitalizations } = useWorkspace();
  const patient = patients.find((candidate) => candidate.id === patientId);
  const patientCases = hospitalizations.filter((item) => item.patientId === patientId);
  const [selectedId, setSelectedId] = useState(() =>
    clinicalScaleReferences.some((item) => item.id === initialScaleId) ? initialScaleId : null,
  );
  const [values, setValues] = useState<Record<string, number>>({});
  const [caseId, setCaseId] = useState('');
  const [observedAt, setObservedAt] = useState(localDateTimeNow);
  const [notes, setNotes] = useState('');
  const [captures, setCaptures] = useState<ClinicalScaleCapture[] | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const selected = clinicalScaleReferences.find((item) => item.id === selectedId);
  const serverMode = session?.mode === 'postgresql' || session?.mode === 'mongodb';

  const loadHistory = useCallback(
    async (signal?: AbortSignal) => {
      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/scales`, {
        credentials: 'same-origin',
        cache: 'no-store',
        signal,
      });
      if (!response.ok)
        throw new Error(await responseError(response, 'No se pudo cargar el historial.'));
      const rows = (await response.json()) as ClinicalScaleCapture[];
      if (!Array.isArray(rows))
        throw new Error('El historial recibido no tiene un formato válido.');
      setCaptures(rows);
      setHistoryError('');
    },
    [patientId],
  );

  useEffect(() => {
    if (!serverMode || !patient || !can('clinical:read')) return;
    const controller = new AbortController();
    void fetch(`/api/patients/${encodeURIComponent(patientId)}/scales`, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(await responseError(response, 'No se pudo cargar el historial.'));
        return (await response.json()) as ClinicalScaleCapture[];
      })
      .then((rows) => {
        if (!Array.isArray(rows))
          throw new Error('El historial recibido no tiene un formato válido.');
        if (!controller.signal.aborted) {
          setCaptures(rows);
          setHistoryError('');
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setHistoryError(cause instanceof Error ? cause.message : 'Error de carga.');
          setCaptures([]);
        }
      });
    return () => controller.abort();
  }, [can, patient, patientId, serverMode]);

  function chooseScale(id: string) {
    setSelectedId(id);
    setValues({});
    setNotes('');
    setObservedAt(localDateTimeNow());
    setError('');
    setSuccess('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !patient || !serverMode || !can('clinical:write')) return;
    if (!observedAt || selected.fields.some((field) => values[field.key] === undefined)) {
      setError('Indica fecha y hora y completa todos los campos de la captura.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/scales`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
        body: JSON.stringify({
          scaleId: selected.id,
          caseId: caseId || undefined,
          observedAt: new Date(observedAt).toISOString(),
          values,
          notes,
        }),
      });
      if (!response.ok)
        throw new Error(await responseError(response, 'No se pudo guardar la captura.'));
      setSuccess(`Captura de ${selected.title} guardada en el historial de ${patient.fullName}.`);
      setValues({});
      setNotes('');
      setObservedAt(localDateTimeNow());
      try {
        await loadHistory();
      } catch {
        setHistoryError(
          'La captura se guardó, pero no se pudo actualizar el historial. Recarga la página para verla.',
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la captura.');
    } finally {
      setSaving(false);
    }
  }

  if (workspaceLoading)
    return (
      <main className="access-denied" role="status">
        Cargando paciente…
      </main>
    );
  if (!patient)
    return (
      <main className="access-denied" role="alert">
        Paciente no disponible.
      </main>
    );

  return (
    <main className="page-stack patient-scales-page">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Expediente · {patient.fullName}</p>
          <h1>Escalas del paciente</h1>
          <p>
            Captura los valores de las imágenes originales y consulta el historial de este paciente.
          </p>
        </div>
        <Link
          className="button button-secondary"
          href={`/patients/${encodeURIComponent(patientId)}`}
        >
          Volver al expediente
        </Link>
      </header>

      <p className="notice" role="note">
        Estos formularios reproducen los campos visibles del HTML proporcionado. Las fuentes aún no
        están aprobadas como instrumentos clínicos; no se calcula un total, riesgo o diagnóstico.
        Revisa la imagen original al capturar.
      </p>
      {!serverMode ? (
        <p className="notice" role="status">
          La captura compartida requiere el servidor y la base de datos. En la demostración local no
          se guardan evaluaciones clínicas.
        </p>
      ) : null}

      <section className="patient-scale-picker" aria-label="Elegir escala">
        {clinicalScaleReferences.map((reference) => (
          <button
            aria-pressed={selectedId === reference.id}
            className={
              selectedId === reference.id ? 'patient-scale-choice active' : 'patient-scale-choice'
            }
            key={reference.id}
            onClick={() => chooseScale(reference.id)}
            type="button"
          >
            <strong>{reference.title}</strong>
            <span>
              Fila {reference.row} · {reference.fields.length} campos
            </span>
          </button>
        ))}
      </section>

      {selected ? (
        <section className="patient-scale-capture-panel" aria-label={`Capturar ${selected.title}`}>
          <div className="patient-scale-source">
            <div className="clinical-scale-card-top">
              <span className="clinical-scale-row">Hoja1 · fila {selected.row}</span>
              <span className={selected.conflict ? 'scale-state conflict' : 'scale-state'}>
                {selected.conflict ? 'Fuente por aclarar' : 'Versión por validar'}
              </span>
            </div>
            <h2>{selected.title}</h2>
            <p>{selected.note}</p>
            <Image
              alt={`Imagen original de ${selected.sourceLabel}`}
              height={820}
              sizes="(max-width: 900px) 90vw, 38vw"
              src={selected.image}
              width={1100}
            />
          </div>
          <form className="patient-scale-form" onSubmit={(event) => void submit(event)}>
            <h2>Registrar captura</h2>
            <p>
              Todos los valores corresponden a las opciones visibles en la imagen, sin
              interpretación.
            </p>
            <label>
              Fecha y hora observada *
              <input
                onChange={(event) => setObservedAt(event.target.value)}
                required
                type="datetime-local"
                value={observedAt}
              />
            </label>
            <button
              className="text-link patient-scale-now"
              onClick={() => setObservedAt(localDateTimeNow())}
              type="button"
            >
              Usar fecha y hora actual
            </button>
            <label>
              Hospitalización relacionada (opcional)
              <select onChange={(event) => setCaseId(event.target.value)} value={caseId}>
                <option value="">Solo en el expediente del paciente</option>
                {patientCases.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id}
                  </option>
                ))}
              </select>
            </label>
            {selected.fields.map((field) => (
              <fieldset className="patient-scale-field" key={field.key}>
                <legend>{field.label} *</legend>
                <div className="patient-scale-options">
                  {field.options.map((option) => (
                    <label key={option}>
                      <input
                        checked={values[field.key] === option}
                        name={field.key}
                        onChange={() =>
                          setValues((current) => ({ ...current, [field.key]: option }))
                        }
                        required
                        type="radio"
                        value={option}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <label>
              Observaciones de captura
              <textarea
                maxLength={2000}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                value={notes}
              />
            </label>
            <p className="field-help">
              {Object.keys(values).length}/{selected.fields.length} campos completos · sin
              clasificación clínica
            </p>
            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="notice" role="status">
                {success}
              </p>
            ) : null}
            <button
              className="button button-primary"
              disabled={!serverMode || !can('clinical:write') || saving}
              type="submit"
            >
              {saving ? 'Guardando…' : 'Guardar en el expediente'}
            </button>
          </form>
        </section>
      ) : (
        <p className="notice">Elige una escala para abrir su formulario.</p>
      )}

      <section className="patient-scale-history" aria-label="Historial de escalas">
        <div className="table-heading">
          <div>
            <h2>Historial de capturas</h2>
            <p>Registros de este paciente, más recientes primero. No se sobrescriben.</p>
          </div>
          <span className="clinical-scale-row">{captures?.length ?? 0} registros</span>
        </div>
        {serverMode && captures === null ? <p role="status">Cargando historial…</p> : null}
        {historyError ? (
          <p className="field-error" role="alert">
            {historyError}
          </p>
        ) : null}
        {!historyError && captures?.length === 0 ? (
          <p>Aún no hay capturas guardadas para este paciente.</p>
        ) : null}
        {(captures ?? []).map((capture) => {
          const reference = clinicalScaleReferences.find((item) => item.id === capture.scaleId);
          return (
            <article className="patient-scale-history-entry" key={capture.id}>
              <div>
                <strong>{reference?.title ?? capture.scaleId}</strong>
                <small>
                  {readableDate(capture.observedAt)} · {capture.authorName}
                </small>
                {capture.caseId ? <small>Hospitalización: {capture.caseId}</small> : null}
              </div>
              <div className="patient-scale-history-values">
                {Object.entries(capture.values).map(([key, value]) => (
                  <span key={key}>
                    {reference?.fields.find((field) => field.key === key)?.label ?? key}: {value}
                  </span>
                ))}
                {capture.notes ? <p>Observaciones: {capture.notes}</p> : null}
                <small>Captura de fuente · sin clasificación automática</small>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
