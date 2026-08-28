'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { mockCredentialHint } from '@/lib/auth';

export function LoginForm() {
  const { login, loading, session } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('admin@demo.local');
  const [password, setPassword] = useState('demo-admin');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (session) router.replace(params.get('next') || '/dashboard');
  }, [params, router, session]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await login(email, password);
      router.replace(params.get('next') || '/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible iniciar sesión.');
    }
  }
  return <main className="login-shell"><section className="login-card"><p className="eyebrow">Acceso seguro</p><h1>Analiza en Casa</h1><p>Inicie sesión para acceder a datos sintéticos y acciones según su rol.</p><form className="form-grid" onSubmit={submit}><label>Correo<input autoComplete="username" data-action-id="AUTH-LOGIN-EMAIL" disabled={loading} onChange={(event) => setEmail(event.target.value)} type="email" value={email} /></label><label>Contraseña<input autoComplete="current-password" data-action-id="AUTH-LOGIN-PASSWORD" disabled={loading} onChange={(event) => setPassword(event.target.value)} type="password" value={password} /></label>{error ? <p className="field-error" role="alert">{error}</p> : null}<button className="button" data-action-id="AUTH-LOGIN" disabled={loading} type="submit">Iniciar sesión</button></form><p className="field-help">Modo mock: {mockCredentialHint}. Las demás credenciales sintéticas usan el mismo patrón por rol.</p><footer>Desarrollado por Interactive Core</footer></section></main>;
}
