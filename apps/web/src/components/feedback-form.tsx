'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import {
  getLocalFeedbackImage,
  listLocalFeedback,
  removeLocalFeedback,
  saveLocalFeedback,
  updateLocalFeedback,
} from '@/lib/local-feedback';
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

const feedbackCategoryIcons: Record<FeedbackInput['category'], string> = {
  ERROR: '!',
  QUESTION: '?',
  NEW_FEATURE: '+',
  CHANGE: '↻',
  IMPROVEMENT: '✦',
};

type FeedbackFilter = 'ALL' | FeedbackStatus;

function formatReportDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-SV', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/El_Salvador',
  }).format(date);
}

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
  const [editingReportId, setEditingReportId] = useState<string>();
  const [previewReport, setPreviewReport] = useState<FeedbackReport>();
  const [previewImageUrl, setPreviewImageUrl] = useState<string>();
  const [reportFilter, setReportFilter] = useState<FeedbackFilter>('ALL');
  const [reportQuery, setReportQuery] = useState('');
  const [resolutionDrafts, setResolutionDrafts] = useState<
    Record<string, { status: FeedbackStatus; resolutionComment: string; resolutionPath: string }>
  >({});
  const [reportMessages, setReportMessages] = useState<
    Record<string, { tone: 'danger' | 'success'; message: string }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canManageReports = session?.role === 'ADMIN';
  const reportCounts = useMemo(
    () => ({
      ALL: reports.length,
      NEW: reports.filter((report) => report.status === 'NEW').length,
      REVIEWING: reports.filter((report) => report.status === 'REVIEWING').length,
      RESOLVED: reports.filter((report) => report.status === 'RESOLVED').length,
    }),
    [reports],
  );
  const visibleReports = useMemo(() => {
    const query = reportQuery.trim().toLocaleLowerCase('es');
    return reports.filter((report) => {
      if (reportFilter !== 'ALL' && report.status !== reportFilter) return false;
      if (!query) return true;
      return [
        report.description,
        report.submittedBy ?? '',
        feedbackLabel(feedbackCategories, report.category),
        feedbackLabel(feedbackModules, report.module),
      ].some((value) => value.toLocaleLowerCase('es').includes(query));
    });
  }, [reportFilter, reportQuery, reports]);

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

  useEffect(
    () => () => {
      if (previewImageUrl?.startsWith('blob:')) URL.revokeObjectURL(previewImageUrl);
    },
    [previewImageUrl],
  );

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
    if (!canManageReports || !session?.userId) return;
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
      setReportMessages((current) => ({
        ...current,
        [report.id]: {
          tone: 'danger',
          message:
            parsedResolution.error.issues[0]?.message ??
            'Revisa el estado, la respuesta y la ruta del cambio.',
        },
      }));
      return;
    }
    setError(null);
    setNotice(null);
    setReportMessages((current) => {
      const next = { ...current };
      delete next[report.id];
      return next;
    });
    setWorkingReportId(report.id);
    try {
      let updated: FeedbackReport;
      if (serverBacked) {
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
        updated = feedbackReportSchema.parse(payload);
      } else {
        const localUpdate = await updateLocalFeedback(
          session.userId,
          report.id,
          parsedResolution.data,
        );
        if (!localUpdate) throw new Error('El comentario ya no existe.');
        updated = localUpdate;
      }
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
      setReportMessages((current) => ({
        ...current,
        [updated.id]: {
          tone: 'success',
          message: 'La respuesta y el estado quedaron guardados.',
        },
      }));
      setEditingReportId(undefined);
    } catch (cause) {
      setReportMessages((current) => ({
        ...current,
        [report.id]: {
          tone: 'danger',
          message: cause instanceof Error ? cause.message : 'No pudimos cambiar el estado.',
        },
      }));
    } finally {
      setWorkingReportId(undefined);
    }
  }

  async function removeReport(report: FeedbackReport) {
    if (!canManageReports || !session?.userId) return;
    if (!window.confirm('¿Eliminar este comentario? Esta acción no se puede deshacer.')) return;
    setError(null);
    setNotice(null);
    setReportMessages((current) => {
      const next = { ...current };
      delete next[report.id];
      return next;
    });
    setWorkingReportId(report.id);
    try {
      if (serverBacked) {
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
      } else if (!(await removeLocalFeedback(session.userId, report.id))) {
        throw new Error('El comentario ya no existe.');
      }
      setReports((current) => current.filter((candidate) => candidate.id !== report.id));
    } catch (cause) {
      setReportMessages((current) => ({
        ...current,
        [report.id]: {
          tone: 'danger',
          message: cause instanceof Error ? cause.message : 'No pudimos eliminar el comentario.',
        },
      }));
    } finally {
      setWorkingReportId(undefined);
    }
  }

  async function openPreview(report: FeedbackReport) {
    if (!session?.userId) return;
    setError(null);
    try {
      const nextUrl = serverBacked
        ? `/api/feedback/${encodeURIComponent(report.id)}`
        : await getLocalFeedbackImage(session.userId, report.id).then((blob) =>
            blob ? URL.createObjectURL(blob) : null,
          );
      if (!nextUrl) throw new Error('La imagen ya no está disponible.');
      if (previewImageUrl?.startsWith('blob:')) URL.revokeObjectURL(previewImageUrl);
      setPreviewImageUrl(nextUrl);
      setPreviewReport(report);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos abrir la imagen.');
    }
  }

  function closePreview() {
    if (previewImageUrl?.startsWith('blob:')) URL.revokeObjectURL(previewImageUrl);
    setPreviewImageUrl(undefined);
    setPreviewReport(undefined);
  }

  return (
    <div className="page-stack feedback-page">
      <header className="page-header feedback-hero">
        <div className="feedback-hero-copy">
          <p className="eyebrow">Tu experiencia nos ayuda</p>
          <h1>Preguntas o errores encontrados</h1>
          <p>
            Cuéntanos qué necesitas. Cada solicitud queda registrada para que puedas consultar su
            avance y la respuesta del equipo.
          </p>
        </div>
        <div className="feedback-hero-assurance" aria-label="Compromiso de seguimiento">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Seguimiento visible</strong>
            <small>Recibe estado, respuesta y enlace al cambio.</small>
          </div>
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
        <div className="feedback-composer-heading">
          <div>
            <p className="eyebrow">Nueva solicitud</p>
            <h2>¿Cómo podemos ayudarte?</h2>
          </div>
          <small>Los campos con * son obligatorios</small>
        </div>
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
                  <span className="feedback-type-icon" aria-hidden="true">
                    {feedbackCategoryIcons[value]}
                  </span>
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
              aria-describedby="feedback-description-help"
              aria-invalid={input.description.length > 0 && input.description.trim().length < 10}
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
            <small className="feedback-character-count" id="feedback-description-help">
              <span>Mínimo 10 caracteres</span>
              <span>{input.description.length}/4000</span>
            </small>
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
          <div className="feedback-submit-row">
            <small>
              {image
                ? 'La captura se enviará de forma privada con este reporte.'
                : 'Puedes enviarlo sin adjuntar una imagen.'}
            </small>
            <button className="button feedback-submit" disabled={saving} type="submit">
              {saving ? 'Enviando…' : 'Enviar reporte'}
            </button>
          </div>
        </form>
      </Panel>

      <section aria-labelledby="feedback-history-title">
        <div className="feedback-section-heading">
          <div>
            <p className="eyebrow">Seguimiento</p>
            <h2 id="feedback-history-title">
              {serverBacked && canManageReports
                ? 'Reportes enviados por el equipo'
                : 'Tus reportes enviados'}
            </h2>
            <p>
              {serverBacked && canManageReports
                ? 'Prioriza solicitudes, documenta la solución y comparte la pantalla corregida.'
                : 'Consulta el estado y la respuesta de cada solicitud que hayas enviado.'}
            </p>
          </div>
          <span aria-label={`${reports.length} reportes`}>{reports.length}</span>
        </div>
        {!loading && reports.length ? (
          <>
            <div className="feedback-overview" aria-label="Filtrar reportes por estado">
              {(
                [
                  ['ALL', 'Todos'],
                  ['NEW', 'Nuevos'],
                  ['REVIEWING', 'En revisión'],
                  ['RESOLVED', 'Resueltos'],
                ] as const
              ).map(([value, label]) => (
                <button
                  aria-pressed={reportFilter === value}
                  className="feedback-summary-card"
                  data-active={reportFilter === value ? 'true' : 'false'}
                  data-status={value}
                  key={value}
                  onClick={() => setReportFilter(value)}
                  type="button"
                >
                  <span>{label}</span>
                  <strong>{reportCounts[value]}</strong>
                </button>
              ))}
            </div>
            <div className="feedback-toolbar">
              <label>
                <span className="sr-only">Buscar reportes</span>
                <span className="feedback-search-icon" aria-hidden="true">
                  ⌕
                </span>
                <input
                  onChange={(event) => setReportQuery(event.target.value)}
                  placeholder="Buscar por texto, sección o persona…"
                  type="search"
                  value={reportQuery}
                />
              </label>
              <span>
                {visibleReports.length} {visibleReports.length === 1 ? 'resultado' : 'resultados'}
              </span>
            </div>
            {!serverBacked ? (
              <p className="feedback-scope-note">
                En este entorno de demostración, los reportes se guardan sólo en este navegador.
              </p>
            ) : null}
          </>
        ) : null}
        {loading ? (
          <div className="feedback-loading" role="status">
            <span aria-hidden="true" />
            Cargando reportes…
          </div>
        ) : null}
        {!loading && !reports.length ? (
          <Panel className="feedback-empty-state">
            <span aria-hidden="true">✦</span>
            <div>
              <strong>Aún no hay solicitudes</strong>
              <p>Cuando envíes una pregunta, error o mejora podrás seguirla desde aquí.</p>
            </div>
          </Panel>
        ) : null}
        {!loading && reports.length > 0 && !visibleReports.length ? (
          <Panel className="feedback-empty-state">
            <span aria-hidden="true">⌕</span>
            <div>
              <strong>No encontramos coincidencias</strong>
              <p>Prueba otro texto o selecciona un estado diferente.</p>
              <button
                className="text-link"
                onClick={() => {
                  setReportFilter('ALL');
                  setReportQuery('');
                }}
                type="button"
              >
                Limpiar filtros
              </button>
            </div>
          </Panel>
        ) : null}
        <div className="feedback-history">
          {visibleReports.map((report) => (
            <Panel
              className={`feedback-report-card feedback-report-${report.status.toLocaleLowerCase()}`}
              key={report.id}
            >
              <div className="feedback-report-heading">
                <div>
                  <div className="feedback-report-title">
                    <span aria-hidden="true">{feedbackCategoryIcons[report.category]}</span>
                    <div>
                      <strong>{feedbackLabel(feedbackCategories, report.category)}</strong>
                      <small>{feedbackLabel(feedbackModules, report.module)}</small>
                    </div>
                  </div>
                  <div className="feedback-report-meta">
                    <time dateTime={report.createdAt}>{formatReportDate(report.createdAt)}</time>
                    {report.submittedBy ? <span>Por {report.submittedBy}</span> : null}
                  </div>
                </div>
                <div className="feedback-report-state">
                  <StatusTag
                    tone={
                      report.status === 'RESOLVED'
                        ? 'success'
                        : report.status === 'NEW'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {feedbackLabel(feedbackStatuses, report.status)}
                  </StatusTag>
                  {canManageReports ? (
                    <button
                      aria-expanded={editingReportId === report.id}
                      className="button secondary feedback-manage"
                      onClick={() =>
                        setEditingReportId((current) =>
                          current === report.id ? undefined : report.id,
                        )
                      }
                      type="button"
                    >
                      {editingReportId === report.id ? 'Cerrar gestión' : 'Gestionar'}
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="feedback-report-description">{report.description}</p>
              {reportMessages[report.id] ? (
                <p
                  className={`notice ${reportMessages[report.id].tone} feedback-report-message`}
                  role={reportMessages[report.id].tone === 'danger' ? 'alert' : 'status'}
                >
                  {reportMessages[report.id].message}
                </p>
              ) : null}
              {canManageReports && editingReportId === report.id ? (
                <div className="feedback-resolution-editor">
                  <label>
                    Estado
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
                        resolutionDrafts[report.id]?.resolutionPath ?? report.resolutionPath ?? ''
                      }
                    />
                  </label>
                  <div className="feedback-admin-actions">
                    <button
                      className="button"
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
                      {workingReportId === report.id ? 'Guardando…' : 'Eliminar reporte'}
                    </button>
                  </div>
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
                  <button
                    className="button secondary"
                    onClick={() => void openPreview(report)}
                    type="button"
                  >
                    Ver imagen
                  </button>
                </div>
              ) : null}
            </Panel>
          ))}
        </div>
      </section>
      {previewReport && previewImageUrl ? (
        <div
          aria-label={`Imagen adjunta ${previewReport.imageName ?? ''}`}
          aria-modal="true"
          className="feedback-image-backdrop"
          onClick={closePreview}
          role="dialog"
        >
          <div className="feedback-image-dialog" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <strong>Imagen del reporte</strong>
                <small>{previewReport.imageName}</small>
              </div>
              <button aria-label="Cerrar imagen" onClick={closePreview} type="button">
                ×
              </button>
            </header>
            <div className="feedback-image-stage">
              <Image
                alt={`Captura adjunta al reporte: ${previewReport.imageName ?? 'imagen'}`}
                height={900}
                src={previewImageUrl}
                unoptimized
                width={1400}
              />
            </div>
            <footer>
              <a
                className="button secondary"
                href={previewImageUrl}
                rel="noreferrer"
                target="_blank"
              >
                Abrir en otra pestaña
              </a>
              <button className="button" onClick={closePreview} type="button">
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
