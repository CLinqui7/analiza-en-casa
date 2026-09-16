'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { isDemoAuthMode, mockCredentialHint, safeNextPath } from '@/lib/auth';
import { isServerDataMode } from '@/lib/data-mode';
import { loadLocalNurseProfile, nurseProfileDraftSchema } from '@/lib/nurse-profile';
import { InstallApp } from '@/components/install-app';
import { isCoreRelease } from '@/lib/release-profile';
import { isRegistrationEnabled } from '@/lib/registration';
import './account-access.css';

export function LoginForm() {
  const { login, loading, session } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const demoMode = isDemoAuthMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const destination = safeNextPath(params.get('next'));
  const emailRef = useRef<HTMLInputElement>(null);
  const loginFlowRef = useRef(false);

  useEffect(() => {
    if (session && !loginFlowRef.current) router.replace(destination);
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
    loginFlowRef.current = true;
    try {
      const nextSession = await login(email, password);
      let needsQuestionnaire = false;
      if (isServerDataMode(nextSession.mode)) {
        const response = await fetch('/api/nurse-profile', { cache: 'no-store' });
        if (response.ok) {
          const profile = nurseProfileDraftSchema.safeParse(await response.json());
          if (!profile.success)
            throw new Error('No pudimos interpretar tu perfil. Intenta iniciar sesión nuevamente.');
          needsQuestionnaire = !profile.data.completedAt;
        }
      } else if (nextSession.mode === 'mock') {
        needsQuestionnaire = !loadLocalNurseProfile(window.localStorage, nextSession.userId)
          .completedAt;
      }
      router.replace(needsQuestionnaire ? '/onboarding' : destination);
    } catch (cause) {
      loginFlowRef.current = false;
      setError(
        cause instanceof Error
          ? cause.message
          : 'No fue posible iniciar sesión. Revise sus datos e intente de nuevo.',
      );
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
              name="email"
              maxLength={254}
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
              name="password"
              maxLength={1024}
              data-action-id="AUTH-LOGIN-PASSWORD"
              disabled={loading || submitting}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: undefined }));
              }}
              type={showPassword ? 'text' : 'password'}
              value={password}
            />
            {fieldErrors.password ? (
              <span className="field-error" id="login-password-error">
                {fieldErrors.password}
              </span>
            ) : null}
          </label>
          <button
            className="text-link"
            type="button"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          </button>
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

        {isRegistrationEnabled() ? (
          <p className="login-registration-link">
            ¿Primera vez aquí? <Link href="/register">Crea tu cuenta de enfermería</Link>
          </p>
        ) : null}

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
