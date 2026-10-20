'use client';

import { Button, Panel } from '@analiza/ui';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';
import { type SurveyKind } from '@/lib/satisfaction-surveys';

type Summary = {
  invited: number;
  responded: number;
  questions: { question: string; counts: Record<string, number> }[];
  comments: string[];
  respondents: { name: string; respondedAt: string }[];
};
const blank: Summary = { invited: 0, responded: 0, questions: [], comments: [], respondents: [] };

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
  const [shareMode, setShareMode] = useState<'LINK' | 'QR'>('LINK');
  const [inviteUrl, setInviteUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canInvite = ['ADMIN', 'MANAGER', 'WEBMASTER'].includes(session?.role ?? '');
  const targets = kind === 'PATIENT' ? patients : doctors;

  useEffect(() => {
    if (!inviteUrl || shareMode !== 'QR') return;
    let active = true;
    void import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(inviteUrl, { errorCorrectionLevel: 'M', margin: 2, width: 320 }),
      )
      .then((value) => {
        if (active) setQrDataUrl(value);
      })
      .catch(() => {
        if (active)
          setError('No se pudo generar el QR. Seleccione «Enlace para copiar» para compartirlo.');
      });
    return () => {
      active = false;
    };
  }, [inviteUrl, shareMode]);

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
    if (!expiresAt) {
      setError('Seleccione cuándo vencerá este enlace de un solo uso.');
      return;
    }
    setBusy(true);
    setError(null);
    setInviteUrl('');
    setQrDataUrl('');
    setCopyMessage('');
    try {
      const response = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
        body: JSON.stringify({
          kind,
          ...(targetId ? { targetId } : {}),
          expiresAt: new Date(expiresAt).toISOString(),
        }),
      });
      if (!response.ok)
        throw new Error('No se pudo crear la invitación. Verifique el vencimiento.');
      const payload = (await response.json()) as { url: string };
      setInviteUrl(payload.url);
      void refresh().catch(() =>
        setError('La invitación se creó, pero no se pudo actualizar el resumen.'),
      );
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
          <h2>Crear enlace o QR</h2>
          <p className="field-help">
            Cree una invitación por persona. El formulario se abre en una pantalla separada y sólo
            puede contestarse una vez. Comparta el enlace o el QR usted mismo; el sistema no envía
            mensajes.
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
                  setQrDataUrl('');
                }}
                value={kind}
              >
                <option value="PATIENT">Paciente o familiar</option>
                <option value="DOCTOR">Médico tratante</option>
              </select>
            </label>
            <label>
              Destinatario del directorio (opcional)
              <select
                data-action-id="SURVEY-TARGET"
                onChange={(event) => {
                  setTargetId(event.target.value);
                  setInviteUrl('');
                  setQrDataUrl('');
                }}
                value={targetId}
              >
                <option value="">Compartir manualmente sin elegir registro</option>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vencimiento del enlace
              <input
                data-action-id="SURVEY-EXPIRY"
                onChange={(event) => setExpiresAt(event.target.value)}
                type="datetime-local"
                value={expiresAt}
              />
            </label>
            <fieldset>
              <legend>Cómo compartir</legend>
              <label>
                <input
                  checked={shareMode === 'LINK'}
                  data-action-id="SURVEY-SHARE-LINK"
                  name="survey-share-mode"
                  onChange={() => setShareMode('LINK')}
                  type="radio"
                />{' '}
                Enlace para copiar
              </label>
              <label>
                <input
                  checked={shareMode === 'QR'}
                  data-action-id="SURVEY-SHARE-QR"
                  name="survey-share-mode"
                  onChange={() => setShareMode('QR')}
                  type="radio"
                />{' '}
                Código QR para mostrar o descargar
              </label>
            </fieldset>
          </div>
          <Button
            data-action-id="SURVEY-CREATE"
            disabled={busy}
            onClick={() => void createInvitation()}
            type="button"
          >
            {busy ? 'Creando…' : 'Crear invitación'}
          </Button>
          {inviteUrl ? (
            <div className="notice success" role="status">
              <p>Invitación creada. Entréguela sólo a la persona elegida antes de que venza.</p>
              {shareMode === 'LINK' ? (
                <>
                  <label>
                    Enlace de la encuesta
                    <textarea readOnly rows={3} value={inviteUrl} />
                  </label>
                  <Button
                    className="button-secondary"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(inviteUrl)
                        .then(() => setCopyMessage('Enlace copiado.'))
                        .catch(() => setCopyMessage('Seleccione y copie el enlace mostrado.'))
                    }
                    type="button"
                  >
                    Copiar enlace
                  </Button>
                  {copyMessage ? <p role="status">{copyMessage}</p> : null}
                </>
              ) : qrDataUrl ? (
                <div>
                  <Image
                    alt="Código QR de la invitación a la encuesta"
                    height={320}
                    src={qrDataUrl}
                    unoptimized
                    width={320}
                  />
                  <p>
                    <a download="encuesta-analiza-qr.png" href={qrDataUrl}>
                      Descargar QR
                    </a>
                  </p>
                </div>
              ) : (
                <p>Preparando QR…</p>
              )}
              <p className="field-help">
                Guarde ahora el enlace o QR: por seguridad el código no se recupera después de
                cerrar esta pantalla.
              </p>
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
          {surveyKind === 'DOCTOR' && summaries.DOCTOR.respondents.length ? (
            <details>
              <summary>
                Nombres declarados por médicos ({summaries.DOCTOR.respondents.length})
              </summary>
              <ul>
                {summaries.DOCTOR.respondents.map((respondent, index) => (
                  <li key={`${respondent.respondedAt}-${index}`}>{respondent.name}</li>
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
