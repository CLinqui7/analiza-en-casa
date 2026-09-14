'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { isRegistrationEnabled, registrationSchema } from '@/lib/registration';
import './account-access.css';

export function RegisterForm() {
  const { register, session, loading } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (session) router.replace('/onboarding');
  }, [session, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = registrationSchema.safeParse({ displayName, email, password });
    if (!parsed.success) {
      setError(
        'Escribe tu nombre, un correo válido y una contraseña de entre 12 y 128 caracteres.',
      );
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSubmitting(true);
    try {
      await register(parsed.data);
      router.replace('/onboarding');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible crear la cuenta.');
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-ambient login-ambient-one" aria-hidden="true" />
      <section className="login-card">
        <div className="login-brand">
          <Image
            alt="Analiza en Casa"
            className="login-logo"
            src="/brand/analiza-en-casa-logo.png"
            width={2047}
            height={702}
            priority
          />
          <span>Tu cuenta, tu espacio de trabajo</span>
        </div>
        <div className="login-heading">
          <p className="eyebrow">Comienza aquí</p>
          <h1>Crea tu cuenta</h1>
          <p>
            Organiza tu equipo y tus servicios en un espacio privado, separado del de otras
            personas.
          </p>
        </div>
        {isRegistrationEnabled() ? (
          <form className="form-grid login-form-grid" onSubmit={submit} aria-busy={submitting}>
            <fieldset disabled={submitting || loading} className="auth-fields">
              <label>
                Tu nombre
                <input
                  name="displayName"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
              <label>
                Correo electrónico
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                Contraseña
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  aria-describedby="registration-password-help"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <p id="registration-password-help" className="field-help">
                Usa al menos 12 caracteres. Puedes escribir una frase larga y única.
              </p>
              <label>
                Confirma tu contraseña
                <input
                  name="confirmation"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>
              <button
                className="text-link"
                type="button"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
              </button>
              {error ? (
                <p role="alert" className="field-error">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="button login-submit">
                {submitting ? 'Creando tu espacio…' : 'Crear mi cuenta'}
              </button>
            </fieldset>
          </form>
        ) : (
          <p className="notice">El registro no está habilitado en este ambiente.</p>
        )}
        <p className="login-registration-link">
          ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
        </p>
        <footer>Analiza en Casa</footer>
      </section>
    </main>
  );
}
