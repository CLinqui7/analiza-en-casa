'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { mockCredentialHint, safeNextPath } from '@/lib/auth';
import { InstallApp } from '@/components/install-app';

export function LoginForm() {
  const { login, loading, session } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('admin@demo.local');
  const [password, setPassword] = useState('demo-admin');
  const [error, setError] = useState<string | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const destination = safeNextPath(params.get('next'));
  useEffect(() => {
    if (session) router.replace(destination);
  }, [destination, router, session]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await login(email, password);
      router.replace(destination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible iniciar sesión.');
    }
  }
  return <main className="login-shell"><section className="login-card"><p className="eyebrow">Acceso seguro</p><h1>Analiza en Casa</h1><p>Inicie sesión para acceder a datos sintéticos y acciones según su rol.</p><form className="form-grid" onSubmit={submit}><label>Usuario o correo<input autoComplete="username" data-action-id="AUTH-LOGIN-EMAIL" disabled={loading} onChange={(event) => setEmail(event.target.value)} type="email" value={email} /></label><label>Clave<input autoComplete="current-password" data-action-id="AUTH-LOGIN-PASSWORD" disabled={loading} onChange={(event) => setPassword(event.target.value)} type="password" value={password} /></label>{error ? <p className="field-error" role="alert">{error}</p> : null}<button className="button" data-action-id="AUTH-LOGIN" disabled={loading} type="submit">Iniciar sesión</button></form><button className="text-link" data-action-id="AUTH-RECOVER-OPEN" onClick={() => { setRecoveryOpen(true); setRecoveryNotice(null); }} type="button">Recuperar acceso</button>{recoveryOpen ? <section aria-label="Recuperar acceso" className="notice"><p>La recuperación requiere un proveedor de identidad configurado; no se envió ningún mensaje.</p>{recoveryNotice ? <p role="status">{recoveryNotice}</p> : null}<div className="header-actions"><button className="button" data-action-id="AUTH-RECOVER-SUBMIT" onClick={() => setRecoveryNotice('Solicitud registrada localmente; la integración de recuperación no está configurada.')} type="button">Solicitar recuperación</button><button className="button button-secondary" data-action-id="AUTH-RECOVER-CANCEL" onClick={() => setRecoveryOpen(false)} type="button">Cancelar</button></div></section> : null}<InstallApp /><p className="field-help">Modo mock: {mockCredentialHint}. Las demás credenciales sintéticas usan el mismo patrón por rol.</p><footer>Desarrollado por Interactive Core</footer></section></main>;
}
