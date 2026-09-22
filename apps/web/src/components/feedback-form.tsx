'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Panel, StatusTag } from '@analiza/ui';
import Image from 'next/image';
import { useAuth } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';
import {
  feedbackCategories,
  feedbackCategoryHelp,
  feedbackImageTypes,
  feedbackInputSchema,
  feedbackLabel,
  feedbackModules,
  feedbackReportSchema,
  feedbackResolutionSchema,
  MAX_FEEDBACK_IMAGE_BYTES,
  type FeedbackInput,
  type FeedbackReport,
  type FeedbackStatus,
} from '@/lib/feedback';
import { listLocalFeedback, saveLocalFeedback } from '@/lib/local-feedback';
import './feedback-form.css';

const initialInput: FeedbackInput = {
  module: 'DASHBOARD',
  category: 'ERROR',
  description: '',
};

const descriptionPlaceholder: Record<FeedbackInput['category'], string> = {
  ERROR: 'Cuéntanos qué estabas haciendo, qué esperabas que ocurriera y qué pasó realmente.',
  QUESTION: 'Escribe tu pregunta y qué parte de la función necesitas entender mejor.',
  NEW_FEATURE: 'Describe la nueva función, quién la usaría y qué problema ayudaría a resolver.',
  CHANGE: 'Explica qué parte quieres modificar y cómo debería funcionar después del cambio.',
  IMPROVEMENT: 'Cuéntanos qué proceso podría ser más claro, rápido o sencillo.',
};

const feedbackStatuses: ReadonlyArray<readonly [FeedbackStatus, string]> = [
  ['NEW', 'Nuevo'],
  ['REVIEWING', 'En revisión'],
  ['RESOLVED', 'Resuelto'],
];

export function FeedbackForm() {
  const { session } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const serverBacked = session?.mode === 'postgresql';
  const [input, setInput] = useState<FeedbackInput>(initialInput);
  const [image, setImage] = useState<File>();
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingReportId, setWorkingReportId] = useState<string>();
  const [previewReport, setPreviewReport] = useState<FeedbackReport>();
  const [resolutionDrafts, setResolutionDrafts] = useState<
    Record<string, { status: FeedbackStatus; resolutionComment: string; resolutionPath: string }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.userId) return;
    let active = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const next = serverBacked
          ? await fetch('/api/feedback', {
              cache: 'no-store',
              headers: { 'x-analiza-feedback-schema': '2' },
              signal: controller.signal,
            }).then(async (response) => {
              const payload: unknown = await response.json();
              if (!response.ok) {
                const message =
                  payload && typeof payload === 'object' && 'error' in payload
                    ? String(payload.error)
                    : 'No pudimos cargar tus reportes.';
                throw new Error(message);
              }
              return feedbackReportSchema.array().parse(payload);
            })
          : await listLocalFeedback(session.userId);
        if (active) {
          setReports(next);
          setResolutionDrafts(
            Object.fromEntries(
              next.map((report) => [
                report.id,
                {
                  status: report.status,
                  resolutionComment: report.resolutionComment ?? '',
                  resolutionPath: report.resolutionPath ?? '',
                },
              ]),
            ),
          );
        }
      } catch (cause) {
        if (active && !(cause instanceof DOMException && cause.name === 'AbortError')) {
          setError('No pudimos cargar tus reportes. Recarga la página para volver a intentarlo.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [serverBacked, session?.userId]);

  function chooseImage(file: File | undefined) {
    setError(null);
    if (!file) {
      setImage(undefined);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (
      file.size > MAX_FEEDBACK_IMAGE_BYTES ||
      !feedbackImageTypes.includes(file.type as (typeof feedbackImageTypes)[number])
    ) {
      setImage(undefined);
      if (fileRef.current) fileRef.current.value = '';
      setError('La imagen debe ser JPG, PNG o WebP y pesar máximo 5 MB.');
      return;
    }
    setImage(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const parsed = feedbackInputSchema.safeParse(input);
    if (!parsed.success) {
      setError('Describe la pregunta, el error o la mejora con al menos 10 caracteres.');
      return;
    }
    if (!session?.userId) {
      setError('Inicia sesión para enviar tu reporte.');
      return;
    }
    setSaving(true);
    try {
      let saved: FeedbackReport;
      if (serverBacked) {
        const body = new FormData();
        body.set('module', parsed.data.module);
        body.set('category', parsed.data.category);
        body.set('description', parsed.data.description);
        if (image) body.set('image', image);
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: { ...mongoMutationHeaders(), 'x-analiza-feedback-schema': '2' },
          body,
        });
        const payload: unknown = await response.json();
        if (!response.ok) {
          const message =
            payload && typeof payload === 'object' && 'error' in payload
              ? String(payload.error)
              : 'No pudimos enviar tu reporte.';
          throw new Error(message);
        }
        saved = feedbackReportSchema.parse(payload);
      } else {
        saved = await saveLocalFeedback(session.userId, parsed.data, image);
      }
      setReports((current) => [saved, ...current]);
      setInput(initialInput);
      setImage(undefined);
      if (fileRef.current) fileRef.current.value = '';
      setNotice('Tu reporte fue enviado correctamente.');
    } catch {
      setError('No pudimos enviar tu reporte. Revisa los datos e intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  }

  async function saveResolution(report: FeedbackReport) {
    if (!serverBacked || session?.role !== 'ADMIN') return;
    const draft = resolutionDrafts[report.id] ?? {
      status: report.status,
      resolutionComment: report.resolutionComment ?? '',
      resolutionPath: report.resolutionPath ?? '',
    };
    const parsedResolution = feedbackResolutionSchema.safeParse({
      status: draft.status,
      resolutionComment: draft.resolutionComment || undefined,
      resolutionPath: draft.resolutionPath || undefined,
    });
    if (!parsedResolution.success) {
      setError('Para resolver, escribe cómo se solucionó y una ruta válida que inicie con /.');
      return;
    }
    setError(null);
    setNotice(null);
    setWorkingReportId(report.id);
    try {
      const response = await fetch(`/api/feedback/${encodeURIComponent(report.id)}`, {
        method: 'PATCH',
        headers: {
          ...mongoMutationHeaders(),
          'content-type': 'application/json',
          'x-analiza-feedback-schema': '2',
        },
        body: JSON.stringify(parsedResolution.data),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          payload && typeof payload === 'object' && 'error' in payload
            ? String(payload.error)
            : 'No pudimos cambiar el estado.';
        throw new Error(message);
      }
      const updated = feedbackReportSchema.parse(payload);
      setReports((current) =>
        current.map((report) => (report.id === updated.id ? updated : report)),
      );
      setResolutionDrafts((current) => ({
        ...current,
        [updated.id]: {
          status: updated.status,
          resolutionComment: updated.resolutionComment ?? '',
          resolutionPath: updated.resolutionPath ?? '',
        },
      }));
      setNotice('El estado, la respuesta y el enlace del reporte fueron actualizados.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos cambiar el estado.');
    } finally {
      setWorkingReportId(undefined);
    }
  }

  async function removeReport(report: FeedbackReport) {
    if (!serverBacked || session?.role !== 'ADMIN') return;
    if (!window.confirm('¿Eliminar este comentario? Esta acción no se puede deshacer.')) return;
    setError(null);
    setNotice(null);
    setWorkingReportId(report.id);
    try {
      const response = await fetch(`/api/feedback/${encodeURIComponent(report.id)}`, {
        method: 'DELETE',
        headers: mongoMutationHeaders(),
      });
      if (!response.ok) {
        const payload: unknown = await response.json();
        const message =
          payload && typeof payload === 'object' && 'error' in payload
            ? String(payload.error)
            : 'No pudimos eliminar el comentario.';
        throw new Error(message);
      }
      setReports((current) => current.filter((candidate) => candidate.id !== report.id));
      setNotice('El comentario fue eliminado.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos eliminar el comentario.');
    } finally {
      setWorkingReportId(undefined);
    }
  }

  return (
    <div className="page-stack feedback-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tu experiencia nos ayuda</p>
          <h1>Preguntas o errores encontrados</h1>
          <p>
            Elige la función, cuéntanos qué necesitas y adjunta una foto si ayuda a explicar mejor
            tu solicitud.
          </p>
        </div>
      </header>

      <ol className="feedback-guide" aria-label="Cómo enviar una solicitud">
        <li>
          <span>1</span>
          <div>
            <strong>Elige el tipo</strong>
            <small>Error, pregunta, función nueva, modificación o mejora.</small>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>Selecciona la función</strong>
            <small>Indica exactamente en qué parte de Analiza ocurre.</small>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>Explica y adjunta</strong>
            <small>Describe lo que necesitas y agrega una foto si la tienes.</small>
          </div>
        </li>
      </ol>

      <Panel className="feedback-composer">
        <form className="feedback-form" onSubmit={submit}>
          <fieldset className="feedback-type-picker">
            <legend>¿Qué quieres enviar? *</legend>
            <div className="feedback-type-grid">
              {feedbackCategories.map(([value, label]) => (
                <label
                  className={input.category === value ? 'feedback-type selected' : 'feedback-type'}
                  key={value}
                >
                  <input
                    checked={input.category === value}
                    disabled={saving}
                    name="feedback-category"
                    onChange={() => setInput((current) => ({ ...current, category: value }))}
                    type="radio"
                    value={value}
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{feedbackCategoryHelp[value]}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="feedback-module-select">
            Función o sección de Analiza *
            <select
              disabled={saving}
              onChange={(event) =>
                setInput((current) => ({
                  ...current,
                  module: event.target.value as FeedbackInput['module'],
                }))
              }
              value={input.module}
            >
              {feedbackModules.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <small>Selecciona el lugar más relacionado con tu solicitud.</small>
          </label>
          <label>
            Describe lo que pasó o lo que quieres *
            <textarea
              disabled={saving}
              maxLength={4000}
              onChange={(event) =>
                setInput((current) => ({ ...current, description: event.target.value }))
              }
              placeholder={descriptionPlaceholder[input.category]}
              required
              rows={7}
              value={input.description}
            />
            <small>{input.description.length}/4000 caracteres</small>
          </label>
          <label className="feedback-file" data-has-file={image ? 'true' : 'false'}>
            <span className="feedback-file-icon" aria-hidden="true">
              {image ? '✓' : '＋'}
            </span>
            <span>
              <strong>{image ? 'Foto seleccionada' : 'Subir una foto o captura'}</strong>
              <small>
                {image ? image.name : 'Selecciona un archivo JPG, PNG o WebP de máximo 5 MB.'}
              </small>
            </span>
            <input
              accept={feedbackImageTypes.join(',')}
              disabled={saving}
              onChange={(event) => chooseImage(event.target.files?.[0])}
              ref={fileRef}
              type="file"
            />
          </label>
          {image ? (
            <div className="feedback-file-selected">
              <span>
                {image.name} · {Math.max(1, Math.round(image.size / 1024))} KB
              </span>
              <button
                className="text-link"
                disabled={saving}
                onClick={() => chooseImage(undefined)}
                type="button"
              >
                Quitar imagen
              </button>
            </div>
          ) : null}
          {error ? (
            <p className="notice danger" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="notice success" role="status">
              {notice}
            </p>
          ) : null}
          <button className="button feedback-submit" disabled={saving} type="submit">
            {saving ? 'Enviando…' : 'Enviar reporte'}
          </button>
        </form>
      </Panel>

      <section aria-labelledby="feedback-history-title">
        <div className="feedback-section-heading">
          <div>
            <p className="eyebrow">Seguimiento</p>
            <h2 id="feedback-history-title">
              {session?.role === 'ADMIN'
                ? 'Reportes enviados por el equipo'
                : 'Tus reportes enviados'}
            </h2>
          </div>
          <span>{reports.length}</span>
        </div>
        {loading ? <p role="status">Cargando reportes…</p> : null}
        {!loading && !reports.length ? (
          <Panel>
            <p>Aún no has enviado preguntas, errores o mejoras.</p>
          </Panel>
        ) : null}
        <div className="feedback-history">
          {reports.map((report) => (
            <Panel key={report.id}>
              <div className="feedback-report-heading">
                <div>
                  <strong>
                    {feedbackLabel(feedbackCategories, report.category)} ·{' '}
                    {feedbackLabel(feedbackModules, report.module)}
                  </strong>
                  <small>{new Date(report.createdAt).toLocaleString('es-MX')}</small>
                  {report.submittedBy ? <small>Enviado por: {report.submittedBy}</small> : null}
                </div>
                <div className="feedback-report-state">
                  <StatusTag tone={report.status === 'RESOLVED' ? 'success' : 'warning'}>
                    {feedbackLabel(feedbackStatuses, report.status)}
                  </StatusTag>
                  {serverBacked && session?.role === 'ADMIN' ? (
                    <div className="feedback-admin-actions">
                      <label>
                        <span className="sr-only">Estado del comentario</span>
                        <select
                          aria-label="Estado del comentario"
                          disabled={workingReportId === report.id}
                          onChange={(event) =>
                            setResolutionDrafts((current) => ({
                              ...current,
                              [report.id]: {
                                status: event.target.value as FeedbackStatus,
                                resolutionComment:
                                  current[report.id]?.resolutionComment ??
                                  report.resolutionComment ??
                                  '',
                                resolutionPath:
                                  current[report.id]?.resolutionPath ?? report.resolutionPath ?? '',
                              },
                            }))
                          }
                          value={resolutionDrafts[report.id]?.status ?? report.status}
                        >
                          {feedbackStatuses.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="button secondary"
                        disabled={workingReportId === report.id}
                        onClick={() => void saveResolution(report)}
                        type="button"
                      >
                        {workingReportId === report.id ? 'Guardando…' : 'Guardar respuesta'}
                      </button>
                      <button
                        className="button secondary danger feedback-delete"
                        disabled={workingReportId === report.id}
                        onClick={() => void removeReport(report)}
                        type="button"
                      >
                        {workingReportId === report.id ? 'Guardando…' : 'Eliminar'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              <p>{report.description}</p>
              {serverBacked && session?.role === 'ADMIN' ? (
                <div className="feedback-resolution-editor">
                  <label>
                    Respuesta para la persona que reportó
                    <textarea
                      disabled={workingReportId === report.id}
                      maxLength={4000}
                      onChange={(event) =>
                        setResolutionDrafts((current) => ({
                          ...current,
                          [report.id]: {
                            status: current[report.id]?.status ?? report.status,
                            resolutionComment: event.target.value,
                            resolutionPath:
                              current[report.id]?.resolutionPath ?? report.resolutionPath ?? '',
                          },
                        }))
                      }
                      placeholder="Se resolvió… Explica qué cambió."
                      rows={3}
                      value={
                        resolutionDrafts[report.id]?.resolutionComment ??
                        report.resolutionComment ??
                        ''
                      }
                    />
                  </label>
                  <label>
                    Pantalla corregida
                    <input
                      disabled={workingReportId === report.id}
                      onChange={(event) =>
                        setResolutionDrafts((current) => ({
                          ...current,
                          [report.id]: {
                            status: current[report.id]?.status ?? report.status,
                            resolutionComment:
                              current[report.id]?.resolutionComment ??
                              report.resolutionComment ??
                              '',
                            resolutionPath: event.target.value,
                          },
                        }))
                      }
                      placeholder="/quotes?create=1"
                      value={
                        resolutionDrafts[report.id]?.resolutionPath ??
                        report.resolutionPath ??
                        ''
                      }
                    />
                  </label>
                </div>
              ) : report.resolutionComment ? (
                <div className="feedback-resolution">
                  <strong>Respuesta del equipo</strong>
                  <p>{report.resolutionComment}</p>
                </div>
              ) : null}
              {report.resolutionPath ? (
                <a className="button secondary feedback-change-link" href={report.resolutionPath}>
                  Ver cambio realizado
                </a>
              ) : null}
              {report.imageName ? (
                <div className="feedback-image-actions">
                  <span>
                    <strong>Imagen adjunta</strong>
                    <small>{report.imageName}</small>
                  </span>
                  {serverBacked ? (
                    <button
                      className="button secondary"
                      onClick={() => setPreviewReport(report)}
                      type="button"
                    >
                      Ver imagen
                    </button>
                  ) : null}
                </div>
              ) : null}
            </Panel>
          ))}
        </div>
      </section>
      {previewReport ? (
        <div
          aria-label={`Imagen adjunta ${previewReport.imageName ?? ''}`}
          aria-modal="true"
          className="feedback-image-backdrop"
          onClick={() => setPreviewReport(undefined)}
          role="dialog"
        >
          <div className="feedback-image-dialog" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <strong>Imagen del reporte</strong>
                <small>{previewReport.imageName}</small>
              </div>
              <button
                aria-label="Cerrar imagen"
                onClick={() => setPreviewReport(undefined)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className="feedback-image-stage">
              <Image
                alt={`Captura adjunta al reporte: ${previewReport.imageName ?? 'imagen'}`}
                height={900}
                src={`/api/feedback/${encodeURIComponent(previewReport.id)}`}
                unoptimized
                width={1400}
              />
            </div>
            <footer>
              <a
                className="button secondary"
                href={`/api/feedback/${encodeURIComponent(previewReport.id)}`}
                rel="noreferrer"
                target="_blank"
              >
                Abrir en otra pestaña
              </a>
              <button className="button" onClick={() => setPreviewReport(undefined)} type="button">
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
