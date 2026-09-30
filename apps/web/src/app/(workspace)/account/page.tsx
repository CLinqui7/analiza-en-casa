'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';
import { isServerDataMode } from '@/lib/data-mode';
import './account.css';

type Account = { email: string; displayName: string; role: string; mustChangePassword: boolean };

export default function AccountPage() {
  const { session, refreshSession } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isServerDataMode(session?.mode)) return;
    let active = true;
    void fetch('/api/auth/account', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('No fue posible cargar tu cuenta.');
        return response.json() as Promise<Account>;
      })
      .then((value) => {
        if (active) {
          setAccount(value);
          setName(value.displayName);
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'No fue posible cargar tu cuenta.');
      });
    return () => {
      active = false;
    };
  }, [session?.mode, session?.userId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (newPassword !== confirmPassword) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    if (account?.mustChangePassword && !newPassword) {
      setError('Debes elegir una contraseña personal para continuar.');
      return;
    }
    if (newPassword && newPassword.length < 12) {
      setError('La nueva contraseña necesita al menos 12 caracteres.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/auth/account', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
        body: JSON.stringify({
          displayName: name,
          currentPassword,
          ...(newPassword ? { newPassword } : {}),
        }),
      });
      const payload = (await response.json()) as Account & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible guardar la cuenta.');
      setAccount(payload);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refreshSession();
      setNotice('Cuenta actualizada. Tu nueva información ya está guardada.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible guardar la cuenta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="account-page">
      <header className="page-header account-header">
        <div>
          <p className="eyebrow">Tu espacio personal</p>
          <h1>Cuenta</h1>
          <p>Actualiza tu nombre y protege tu acceso. Tus permisos de trabajo no cambian.</p>
        </div>
      </header>
      {!isServerDataMode(session?.mode) ? (
        <div className="panel">La edición de cuenta requiere una sesión conectada al servidor.</div>
      ) : (
        <div className="account-layout">
          <section className="panel account-identity" aria-label="Identidad de la cuenta">
            <span className="account-identity-icon" aria-hidden="true">
              {(account?.displayName || '?').slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="eyebrow">Sesión activa</p>
              <h2>{account?.displayName || 'Cargando cuenta…'}</h2>
            </div>
            <dl>
              <div>
                <dt>Usuario</dt>
                <dd>{account?.email || '—'}</dd>
              </div>
              <div>
                <dt>Permisos</dt>
                <dd>{account?.role || '—'}</dd>
              </div>
            </dl>
            <p className="account-identity-note">
              Este identificador es de acceso interno; no recibe mensajes de correo.
            </p>
          </section>
          <section className="panel account-edit" aria-label="Editar cuenta">
            <p className="eyebrow">Configuración</p>
            <h2>Nombre y seguridad</h2>
            {account?.mustChangePassword && (
              <p className="account-required" role="status">
                Tu contraseña inicial es temporal. Cámbiala para poder usar el sistema.
              </p>
            )}
            <form onSubmit={(event) => void submit(event)}>
              <label>
                Nombre completo
                <input
                  autoComplete="name"
                  maxLength={100}
                  minLength={2}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </label>
              <div className="account-divider" />
              <label>
                Contraseña actual
                <input
                  autoComplete="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  type="password"
                  value={currentPassword}
                />
              </label>
              <label>
                Nueva contraseña{' '}
                <small>
                  {account?.mustChangePassword
                    ? 'Obligatoria'
                    : 'Déjala vacía si no quieres cambiarla'}
                </small>
                <input
                  autoComplete="new-password"
                  minLength={12}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required={account?.mustChangePassword}
                  type="password"
                  value={newPassword}
                />
              </label>
              <label>
                Confirmar nueva contraseña
                <input
                  autoComplete="new-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required={Boolean(newPassword)}
                  type="password"
                  value={confirmPassword}
                />
              </label>
              {error && (
                <p className="account-error" role="alert">
                  {error}
                </p>
              )}
              {notice && (
                <p className="account-success" role="status">
                  {notice}
                </p>
              )}
              <button className="button button-primary" disabled={!account || saving} type="submit">
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
