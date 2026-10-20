'use client';

import { Button, Panel } from '@analiza/ui';
import { useEffect, useRef, useState } from 'react';
import type { SurveyKind, SurveyQuestion } from '@/lib/satisfaction-surveys';

export default function PublicSurveyPage() {
  const link = useRef({ organizationId: '', token: '' });
  const [kind, setKind] = useState<SurveyKind | null>(null);
  const [questions, setQuestions] = useState<readonly SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [respondentName, setRespondentName] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const org = new URLSearchParams(window.location.search).get('o') ?? '';
    const secret = window.location.hash.slice(1);
    link.current = { organizationId: org, token: secret };
    if (!org || !secret) {
      void Promise.resolve().then(() =>
        setError('El enlace no está disponible o ya fue utilizado.'),
      );
      return;
    }
    void fetch('/api/surveys/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'LOOKUP', organizationId: org, token: secret }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ kind: SurveyKind; questions: SurveyQuestion[] }>;
      })
      .then((payload) => {
        setKind(payload.kind);
        setQuestions(payload.questions);
        setAnswers(payload.questions.map(() => ''));
      })
      .catch(() => setError('El enlace no está disponible o ya fue utilizado.'));
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (kind === 'DOCTOR' && respondentName.trim().length < 2) {
      setError('Escriba el nombre del médico.');
      return;
    }
    if (questions.some((question, index) => question.options && !answers[index])) {
      setError('Responda todas las preguntas de selección.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/surveys/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT',
          ...link.current,
          answers,
          ...(kind === 'DOCTOR' ? { respondentName: respondentName.trim() } : {}),
        }),
      });
      if (!response.ok) throw new Error();
      setDone(true);
      window.history.replaceState(null, '', '/survey');
    } catch {
      setError('No se pudo guardar la encuesta. El enlace puede haber vencido o ya fue utilizado.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page-stack" style={{ maxWidth: 760, margin: '3rem auto', padding: '1rem' }}>
      <Panel>
        <h1>Encuesta de satisfacción</h1>
        {done ? (
          <p className="notice success" role="status">
            Gracias. Su respuesta fue registrada.
          </p>
        ) : error && !kind ? (
          <p className="notice danger" role="alert">
            {error}
          </p>
        ) : kind ? (
          <>
            <p>
              Su opinión ayuda a mejorar la atención de Analiza en Casa. No incluya datos clínicos
              personales en comentarios.
            </p>
            <form onSubmit={(event) => void submit(event)}>
              {kind === 'DOCTOR' ? (
                <label style={{ display: 'block', marginBottom: '1.5rem' }}>
                  Nombre del médico
                  <input
                    autoComplete="name"
                    maxLength={120}
                    minLength={2}
                    onChange={(event) => setRespondentName(event.target.value)}
                    required
                    type="text"
                    value={respondentName}
                  />
                  <small>El equipo autorizado podrá ver el nombre que escriba.</small>
                </label>
              ) : null}
              {questions.map((question, index) => (
                <fieldset key={question.text} style={{ marginBottom: '1.5rem' }}>
                  <legend>
                    <strong>
                      {index + 1}. {question.text}
                    </strong>
                  </legend>
                  {question.options ? (
                    question.options.map((option) => (
                      <label key={option} style={{ display: 'block', marginTop: 8 }}>
                        <input
                          checked={answers[index] === option}
                          name={`question-${index}`}
                          onChange={() =>
                            setAnswers((current) =>
                              current.map((answer, position) =>
                                position === index ? option : answer,
                              ),
                            )
                          }
                          type="radio"
                          value={option}
                        />{' '}
                        {option}
                      </label>
                    ))
                  ) : (
                    <textarea
                      aria-label="Aspectos por mejorar"
                      maxLength={1000}
                      onChange={(event) =>
                        setAnswers((current) =>
                          current.map((answer, position) =>
                            position === index ? event.target.value : answer,
                          ),
                        )
                      }
                      rows={4}
                      value={answers[index]}
                    />
                  )}
                </fieldset>
              ))}
              {error ? (
                <p className="notice danger" role="alert">
                  {error}
                </p>
              ) : null}
              <Button disabled={busy} type="submit">
                {busy ? 'Guardando…' : 'Enviar respuesta'}
              </Button>
            </form>
          </>
        ) : (
          <p>Cargando encuesta…</p>
        )}
      </Panel>
    </main>
  );
}
