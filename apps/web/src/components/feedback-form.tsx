'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Panel, StatusTag } from '@analiza/ui';
import { useAuth } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';
import {
  feedbackCategories,
  feedbackImageTypes,
  feedbackInputSchema,
  feedbackLabel,
  feedbackModules,
  feedbackReportSchema,
  MAX_FEEDBACK_IMAGE_BYTES,
  type FeedbackInput,
  type FeedbackReport,
} from '@/lib/feedback';
import { listLocalFeedback, saveLocalFeedback } from '@/lib/local-feedback';
import './feedback-form.css';

const initialInput: FeedbackInput = {
  module: 'DASHBOARD',
  category: 'ERROR',
  description: '',
};

export function FeedbackForm() {
  const { session } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const serverBacked = session?.mode === 'postgresql';
  const [input, setInput] = useState<FeedbackInput>(initialInput);
  const [image, setImage] = useState<File>();
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.userId) return;
    let active = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const next = serverBacked
          ? await fetch('/api/feedback', { cache: 'no-store', signal: controller.signal }).then(
              async (response) => {
                const payload: unknown = await response.json();
                if (!response.ok) {
                  const message =
                    payload && typeof payload === 'object' && 'error' in payload
                      ? String(payload.error)
                      : 'No pudimos cargar tus reportes.';
                  throw new Error(message);
                }
                return feedbackReportSchema.array().parse(payload);
              },
            )
          : await listLocalFeedback(session.userId);
        if (active) setReports(next);
      } catch (cause) {
        if (active && !(cause instanceof DOMException && cause.name === 'AbortError')) {
          setError(cause instanceof Error ? cause.message : 'No pudimos cargar tus reportes.');
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
          headers: mongoMutationHeaders(),
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos enviar tu reporte.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack feedback-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tu experiencia nos ayuda</p>
          <h1>Preguntas o errores encontrados</h1>
          <p>Elige el módulo y cuéntanos qué ocurrió, qué necesitas o qué te gustaría mejorar.</p>
        </div>
      </header>

      <Panel>
        <form className="feedback-form" onSubmit={submit}>
          <div className="feedback-grid">
            <label>
              Módulo o sección *
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
            </label>
            <label>
              ¿Qué quieres reportar? *
              <select
                disabled={saving}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    category: event.target.value as FeedbackInput['category'],
                  }))
                }
                value={input.category}
              >
                {feedbackCategories.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Describe tu pregunta, error o mejora *
            <textarea
              disabled={saving}
              maxLength={4000}
              onChange={(event) =>
                setInput((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Explica qué estabas haciendo, qué pasó y qué te gustaría que cambiara."
              required
              rows={7}
              value={input.description}
            />
            <small>{input.description.length}/4000 caracteres</small>
          </label>
          <label className="feedback-file">
            Adjuntar imagen
            <input
              accept={feedbackImageTypes.join(',')}
              disabled={saving}
              onChange={(event) => chooseImage(event.target.files?.[0])}
              ref={fileRef}
              type="file"
            />
            <small>JPG, PNG o WebP, máximo 5 MB.</small>
          </label>
          {image ? (
            <div className="feedback-file-selected">
              <span>{image.name}</span>
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
          <button className="button" disabled={saving} type="submit">
            {saving ? 'Enviando…' : 'Enviar reporte'}
          </button>
        </form>
      </Panel>

      <section aria-labelledby="feedback-history-title">
        <div className="feedback-section-heading">
          <div>
            <p className="eyebrow">Seguimiento</p>
            <h2 id="feedback-history-title">Tus reportes enviados</h2>
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
                </div>
                <StatusTag tone={report.status === 'RESOLVED' ? 'success' : 'warning'}>
                  {report.status === 'RESOLVED'
                    ? 'Resuelto'
                    : report.status === 'REVIEWING'
                      ? 'En revisión'
                      : 'Nuevo'}
                </StatusTag>
              </div>
              <p>{report.description}</p>
              {report.imageName ? <small>Imagen adjunta: {report.imageName}</small> : null}
            </Panel>
          ))}
        </div>
      </section>
    </div>
  );
}
