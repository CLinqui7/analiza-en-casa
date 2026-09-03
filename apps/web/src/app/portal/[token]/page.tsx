'use client';

import { Button, Panel, StatusTag } from '@analiza/ui';
import { useParams } from 'next/navigation';
import { useState } from 'react';

const genericCodeMessage = 'Si el enlace es válido, enviamos un código al canal registrado.';
const genericAccessMessage = 'No fue posible validar el acceso.';
const unavailableMessage = 'Servicio temporalmente no disponible.';
type PortalSnapshot = { quote_id?: unknown; status?: unknown; updated_at?: unknown };

function readSnapshot(value: unknown): PortalSnapshot | null {
  return value && typeof value === 'object' ? (value as PortalSnapshot) : null;
}

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const [requested, setRequested] = useState(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/portal-request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      setMessage(response.status === 202 ? genericCodeMessage : unavailableMessage);
      setRequested(true);
    } catch {
      setMessage(unavailableMessage);
    } finally {
      setLoading(false);
    }
  }
  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/portal-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, verificationCode: code }),
      });
      const payload = await response.json().catch(() => null);
      const nextSnapshot = response.ok ? readSnapshot(payload) : null;
      if (!nextSnapshot) {
        setMessage(response.status === 503 ? unavailableMessage : genericAccessMessage);
        return;
      }
      setSnapshot(nextSnapshot);
    } catch {
      setMessage(unavailableMessage);
    } finally {
      setLoading(false);
    }
  }

  if (snapshot)
    return (
      <main className="portal-shell">
        <header className="page-header">
          <div>
            <p className="eyebrow">Portal seguro</p>
            <h1>Acceso verificado</h1>
            <p>
              La sesión se habilitó tras token y verificación secundaria. Este resumen no incluye
              contenido clínico en notificaciones.
            </p>
          </div>
          <StatusTag tone="success">Verificado</StatusTag>
        </header>
        <Panel>
          <h2>Resumen autorizado</h2>
          <dl className="definition-list">
            <div>
              <dt>Cotización</dt>
              <dd>
                {typeof snapshot.quote_id === 'string'
                  ? snapshot.quote_id
                  : 'Referencia no disponible'}
              </dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{typeof snapshot.status === 'string' ? snapshot.status : 'No disponible'}</dd>
            </div>
            <div>
              <dt>Actualización</dt>
              <dd>
                {typeof snapshot.updated_at === 'string'
                  ? new Date(snapshot.updated_at).toLocaleString('es-SV')
                  : 'No disponible'}
              </dd>
            </div>
          </dl>
          <p>
            Los detalles financieros y clínicos no se inventan ni se envían por este flujo público.
          </p>
        </Panel>
      </main>
    );
  return (
    <main className="portal-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Portal seguro</p>
          <h1>Verificación de acceso</h1>
          <p>
            Solicite un código de un solo uso. El portal no usa DUI ni datos personales como método
            de acceso.
          </p>
        </div>
      </header>
      <Panel>
        <h2>Segundo factor</h2>
        <p>
          La solicitud usa una respuesta uniforme para no revelar si un enlace existe, expiró o fue
          revocado.
        </p>
        <Button
          data-action-id="PORTAL-REQUEST-OTP"
          disabled={loading}
          onClick={() => void requestCode()}
          type="button"
        >
          Solicitar código
        </Button>
        {message ? (
          <p
            className={message === genericAccessMessage ? 'notice' : 'notice success'}
            role="status"
          >
            {message}
          </p>
        ) : null}
        {requested ? (
          <form className="form-grid" noValidate onSubmit={(event) => void verifyCode(event)}>
            <label>
              Código de verificación
              <input
                data-action-id="PORTAL-VERIFY-OTP"
                autoComplete="one-time-code"
                inputMode="numeric"
                onChange={(event) => setCode(event.target.value)}
                value={code}
              />
            </label>
            <Button disabled={loading || !code.trim()} type="submit">
              Verificar código
            </Button>
          </form>
        ) : null}
      </Panel>
    </main>
  );
}
