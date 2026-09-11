'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { isDemoAuthMode, mockCredentialHint, safeNextPath } from '@/lib/auth';
import { InstallApp } from '@/components/install-app';
import { isCoreRelease } from '@/lib/release-profile';

export function LoginForm() {
  const { login, loading, session } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const demoMode = isDemoAuthMode();
  const [email, setEmail] = useState(() => (demoMode ? 'admin@demo.local' : ''));
  const [password, setPassword] = useState(() => (demoMode ? 'demo-admin' : ''));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const destination = safeNextPath(params.get('next'));
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session) router.replace(destination);
  }, [destination, router, session]);

  useEffect(() => {
    if (!loading && !session) emailRef.current?.focus();
  }, [loading, session]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const nextFieldErrors = {
      email: email.trim() ? undefined : 'Ingrese su usuario o correo.',
      password: password ? undefined : 'Ingrese su clave.',
    };
    setFieldErrors(nextFieldErrors);
    if (nextFieldErrors.email || nextFieldErrors.password) return;
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace(destination);
    } catch {
      setError('No fue posible iniciar sesión. Revise sus datos e intente de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-ambient login-ambient-one" aria-hidden="true" />
      <div className="login-ambient login-ambient-two" aria-hidden="true" />
      <section className="login-card">
        <div className="login-brand">
          <Image
            alt="Analiza en Casa"
            className="login-logo"
            height={702}
            priority
            src="/brand/analiza-en-casa-logo.png"
            width={2047}
          />
          <span>Plataforma operativa de atención domiciliaria</span>
        </div>

        <div className="login-heading">
          <p className="eyebrow">Acceso seguro</p>
          <h1>Bienvenido</h1>
          <p>Ingrese para continuar al espacio de trabajo de Analiza en Casa.</p>
        </div>

        <form
          aria-busy={submitting}
          className="form-grid login-form-grid"
          noValidate
          onSubmit={submit}
        >
          <label>
            Usuario o correo
            <input
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
              aria-invalid={Boolean(fieldErrors.email)}
              autoComplete="username"
              data-action-id="AUTH-LOGIN-EMAIL"
              disabled={loading || submitting}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldErrors((current) => ({ ...current, email: undefined }));
              }}
              ref={emailRef}
              type="email"
              value={email}
            />
            {fieldErrors.email ? (
              <span className="field-error" id="login-email-error">
                {fieldErrors.email}
              </span>
            ) : null}
          </label>
          <label>
            Clave
            <input
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
              aria-invalid={Boolean(fieldErrors.password)}
              autoComplete="current-password"
              data-action-id="AUTH-LOGIN-PASSWORD"
              disabled={loading || submitting}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: undefined }));
              }}
              type="password"
              value={password}
            />
            {fieldErrors.password ? (
              <span className="field-error" id="login-password-error">
                {fieldErrors.password}
              </span>
            ) : null}
          </label>
          {error ? (
            <p className="field-error login-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="button login-submit"
            data-action-id="AUTH-LOGIN"
            disabled={loading || submitting}
            type="submit"
          >
            {submitting ? 'Validando…' : 'Iniciar sesión'}
          </button>
        </form>

        {!isCoreRelease && (
          <button
            className="text-link login-recovery-link"
            data-action-id="AUTH-RECOVER-OPEN"
            onClick={() => {
              setRecoveryOpen(true);
              setRecoveryNotice(null);
            }}
            type="button"
          >
            Recuperar acceso
          </button>
        )}

        {!isCoreRelease && recoveryOpen ? (
          <section aria-label="Recuperar acceso" className="notice">
            <p>
              La recuperación requiere un proveedor de identidad configurado; no se envió ningún
              mensaje.
            </p>
            {recoveryNotice ? <p role="status">{recoveryNotice}</p> : null}
            <div className="header-actions">
              <button
                className="button"
                data-action-id="AUTH-RECOVER-SUBMIT"
                onClick={() =>
                  setRecoveryNotice(
                    'Solicitud registrada localmente; la integración de recuperación no está configurada.',
                  )
                }
                type="button"
              >
                Solicitar recuperación
              </button>
              <button
                className="button button-secondary"
                data-action-id="AUTH-RECOVER-CANCEL"
                onClick={() => setRecoveryOpen(false)}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </section>
        ) : null}

        <div className="login-utilities">
          <InstallApp />
          {demoMode ? <p className="field-help">Modo demo local: {mockCredentialHint}.</p> : null}
        </div>
        <footer>Desarrollado por Interactive Core</footer>
      </section>
    </main>
  );
}
