'use client';

import { Button, Panel } from '@analiza/ui';
import { useEffect, useState } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';
import { type SurveyKind } from '@/lib/satisfaction-surveys';

type Summary = {
  invited: number;
  responded: number;
  questions: { question: string; counts: Record<string, number> }[];
  comments: string[];
};
const blank: Summary = { invited: 0, responded: 0, questions: [], comments: [] };

export default function SurveysPage() {
  const { session } = useAuth();
  const { patients, doctors } = useWorkspace();
  const [summaries, setSummaries] = useState<Record<SurveyKind, Summary>>({
    PATIENT: blank,
    DOCTOR: blank,
  });
  const [kind, setKind] = useState<SurveyKind>('PATIENT');
  const [targetId, setTargetId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canInvite = ['ADMIN', 'MANAGER', 'WEBMASTER'].includes(session?.role ?? '');
  const targets = kind === 'PATIENT' ? patients : doctors;
  const selected = targets.find((target) => target.id === targetId);
  const phone = selected?.phone ?? '';
  const digits = phone.replace(/\D/g, '');
  const whatsappNumber =
    digits.length === 8
      ? `503${digits}`
      : digits.startsWith('503') && digits.length === 11
        ? digits
        : '';
  const whatsappText = encodeURIComponent(
    'Analiza en Casa le invita a responder una encuesta de satisfacción. Puede abrir este enlace seguro: ' +
      inviteUrl,
  );

  async function refresh() {
    const response = await fetch('/api/surveys', { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudieron cargar los resultados de las encuestas.');
    const payload = (await response.json()) as { summaries: Record<SurveyKind, Summary> };
    setSummaries(payload.summaries);
  }
  useEffect(() => {
    let active = true;
    void fetch('/api/surveys', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ summaries: Record<SurveyKind, Summary> }>;
      })
      .then((payload) => {
        if (active) setSummaries(payload.summaries);
      })
      .catch(() => {
        if (active) setError('No se pudieron cargar resultados.');
      });
    return () => {
      active = false;
    };
  }, []);

  async function createInvitation() {
    if (!targetId || !expiresAt || !consentConfirmed || !phone.trim()) {
      setError(
        'Seleccione destinatario con teléfono, vencimiento y confirme número y consentimiento.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    setInviteUrl('');
    try {
      const response = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
        body: JSON.stringify({
          kind,
          targetId,
          expiresAt: new Date(expiresAt).toISOString(),
          consentConfirmed,
        }),
      });
      if (!response.ok)
        throw new Error('No se pudo crear el enlace. Verifique el número y la fecha.');
      const payload = (await response.json()) as { url: string };
      setInviteUrl(payload.url);
      setConsentConfirmed(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el enlace.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="eyebrow">Reportes y control</p>
        <h1>Encuestas de satisfacción</h1>
        <p>Encuestas para pacientes y médicos tratantes. Los resultados se agregan por pregunta.</p>
      </header>
      {error ? (
        <p className="notice danger" role="alert">
          {error}
        </p>
      ) : null}
      {canInvite ? (
        <Panel>
          <h2>Crear invitación segura</h2>
          <p className="field-help">
            Verifique el teléfono y el consentimiento antes de abrir WhatsApp. El mensaje contiene
            sólo un enlace; el envío se confirma en WhatsApp.
          </p>
          <div className="form-grid">
            <label>
              Encuesta
              <select
                data-action-id="SURVEY-KIND"
                onChange={(event) => {
                  setKind(event.target.value as SurveyKind);
                  setTargetId('');
                  setInviteUrl('');
                }}
                value={kind}
              >
                <option value="PATIENT">Paciente o familiar</option>
                <option value="DOCTOR">Médico tratante</option>
              </select>
            </label>
            <label>
              Destinatario
              <select
                data-action-id="SURVEY-TARGET"
                onChange={(event) => {
                  setTargetId(event.target.value);
                  setInviteUrl('');
                }}
                value={targetId}
              >
                <option value="">Seleccione</option>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.fullName}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Teléfono registrado: <strong>{phone || 'No disponible'}</strong>
            </p>
            <label>
              Vencimiento del enlace
              <input
                data-action-id="SURVEY-EXPIRY"
                onChange={(event) => setExpiresAt(event.target.value)}
                type="datetime-local"
                value={expiresAt}
              />
            </label>
            <label>
              <input
                checked={consentConfirmed}
                data-action-id="SURVEY-CONSENT"
                onChange={(event) => setConsentConfirmed(event.target.checked)}
                type="checkbox"
              />{' '}
              Confirmo que verifiqué este número y que el destinatario consintió recibir la
              encuesta.
            </label>
          </div>
          <Button
            data-action-id="SURVEY-CREATE"
            disabled={busy}
            onClick={() => void createInvitation()}
            type="button"
          >
            {busy ? 'Creando…' : 'Crear enlace'}
          </Button>
          {inviteUrl ? (
            <div className="notice success" role="status">
              <p>Enlace creado. Compártalo sólo con el destinatario verificado.</p>
              <div className="action-row">
                <Button
                  className="button-secondary"
                  onClick={() => void navigator.clipboard.writeText(inviteUrl)}
                  type="button"
                >
                  Copiar enlace
                </Button>
                {whatsappNumber ? (
                  <a
                    className="action-link-button"
                    href={`https://wa.me/${whatsappNumber}?text=${whatsappText}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Abrir WhatsApp para enviar
                  </a>
                ) : (
                  <p>Revise el formato internacional del teléfono antes de enviarlo.</p>
                )}
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}
      {(['PATIENT', 'DOCTOR'] as const).map((surveyKind) => (
        <Panel key={surveyKind}>
          <h2>{surveyKind === 'PATIENT' ? 'Pacientes y familiares' : 'Médicos tratantes'}</h2>
          <p>
            Invitaciones: {summaries[surveyKind].invited} · Respuestas:{' '}
            {summaries[surveyKind].responded}
          </p>
          {summaries[surveyKind].questions.map((question, index) => (
            <section key={question.question}>
              <h3>
                {index + 1}. {question.question}
              </h3>
              {Object.entries(question.counts).map(([option, count]) => (
                <div key={option}>
                  <label>
                    {option}: {count}
                    <progress max={Math.max(1, summaries[surveyKind].responded)} value={count} />
                  </label>
                </div>
              ))}
            </section>
          ))}
          {surveyKind === 'DOCTOR' && summaries.DOCTOR.comments.length ? (
            <details>
              <summary>Comentarios de mejora ({summaries.DOCTOR.comments.length})</summary>
              <ul>
                {summaries.DOCTOR.comments.map((comment, index) => (
                  <li key={`${index}-${comment.slice(0, 20)}`}>{comment}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {!summaries[surveyKind].questions.length ? (
            <p className="field-help">
              Sin respuestas todavía. Las preguntas aparecerán aquí al recibir la primera encuesta.
            </p>
          ) : null}
        </Panel>
      ))}
    </div>
  );
}
