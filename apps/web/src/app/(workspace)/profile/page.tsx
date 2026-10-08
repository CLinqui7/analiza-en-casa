'use client';

import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';
import { isServerDataMode } from '@/lib/data-mode';
import { maximumAvatarBytes, type AccountProfile } from '@/lib/account-profile';

async function apiError(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  return body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
    ? body.error
    : 'No pudimos guardar los cambios. Intenta nuevamente.';
}

function broadcast(profile: AccountProfile) {
  window.dispatchEvent(new CustomEvent('analiza:profile-updated', { detail: profile }));
}

export default function ProfilePage() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'name' | 'photo' | 'password' | null>(null);
  const [notice, setNotice] = useState('');
  const connected = isServerDataMode(session?.mode);

  useEffect(() => {
    if (!connected) {
      return;
    }
    const controller = new AbortController();
    void fetch('/api/profile', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await apiError(response));
        return response.json() as Promise<AccountProfile>;
      })
      .then((value) => {
        if (!controller.signal.aborted) {
          setProfile(value);
          setName(value.displayName);
          broadcast(value);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setNotice(error instanceof Error ? error.message : 'No pudimos cargar el perfil.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [connected]);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('name');
    setNotice('');
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
        body: JSON.stringify({ displayName: name.trim() }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      const updated = (await response.json()) as AccountProfile;
      setProfile(updated);
      broadcast(updated);
      setNotice('Nombre actualizado.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No pudimos guardar el nombre.');
    } finally {
      setBusy(null);
    }
  }

  async function savePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo) return;
    if (
      photo.size > maximumAvatarBytes ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)
    ) {
      setNotice('Selecciona una imagen JPG, PNG o WebP de hasta 1 MB.');
      return;
    }
    setBusy('photo');
    setNotice('');
    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': photo.type, ...mongoMutationHeaders() },
        body: photo,
      });
      if (!response.ok) throw new Error(await apiError(response));
      const updated = (await response.json()) as AccountProfile;
      setProfile(updated);
      broadcast(updated);
      setPhoto(null);
      setNotice('Foto de perfil actualizada.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No pudimos guardar la foto.');
    } finally {
      setBusy(null);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setNotice('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    if (newPassword.length < 12) {
      setNotice('La nueva contraseña debe tener al menos 12 caracteres.');
      return;
    }
    setBusy('password');
    setNotice('');
    try {
      const response = await fetch('/api/profile/password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // A full navigation discards the in-memory auth context after the server revokes every session.
      window.location.replace(
        new URL('/login?password=updated', window.location.origin).toString(),
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No pudimos cambiar la contraseña.');
      setBusy(null);
    }
  }

  const initial = (profile?.displayName || profile?.email || 'U').trim().charAt(0).toUpperCase();
  return (
    <div className="profile-page">
      <header className="page-header profile-heading">
        <div>
          <p className="eyebrow">Mi cuenta</p>
          <h1>Un espacio que se siente tuyo</h1>
          <p>Actualiza cómo te ven en Analiza en Casa y mantén segura tu cuenta.</p>
        </div>
      </header>
      {notice ? (
        <p className="profile-notice" role="status">
          {notice}
        </p>
      ) : null}
      {!connected ? (
        <section className="panel">
          <h2>Perfil disponible con el servidor conectado</h2>
          <p>El modo de demostración no guarda fotos, nombres ni contraseñas reales.</p>
        </section>
      ) : null}
      {connected && loading ? <p role="status">Cargando perfil…</p> : null}
      {connected && !loading && profile ? (
        <div className="profile-grid">
          <section className="panel profile-identity-card" aria-label="Identidad de tu cuenta">
            <div className="profile-avatar-large">
              {profile.avatarVersion > 0 ? (
                <Image
                  alt="Mi foto de perfil"
                  height={104}
                  width={104}
                  unoptimized
                  src={`/api/profile/avatar?v=${profile.avatarVersion}`}
                />
              ) : (
                <span aria-hidden="true">{initial}</span>
              )}
            </div>
            <h2>{profile.displayName || 'Tu perfil'}</h2>
            <p>{profile.email}</p>
            <span className="profile-role-chip">{session?.role}</span>
            <form onSubmit={(event) => void savePhoto(event)}>
              <label htmlFor="profile-photo">Foto de perfil</label>
              <input
                accept="image/jpeg,image/png,image/webp"
                id="profile-photo"
                onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
                type="file"
              />
              <small>
                JPG, PNG o WebP · máximo 1 MB. Solo visible al iniciar sesión en tu cuenta.
              </small>
              <button
                className="button button-primary"
                disabled={!photo || busy !== null}
                type="submit"
              >
                {busy === 'photo' ? 'Guardando…' : 'Guardar foto'}
              </button>
            </form>
          </section>
          <div className="profile-edit-stack">
            <section className="panel profile-edit-card">
              <div className="profile-section-icon" aria-hidden="true">
                ✦
              </div>
              <h2>Nombre visible</h2>
              <p>Este nombre identifica tu cuenta dentro de la plataforma.</p>
              <form onSubmit={(event) => void saveName(event)}>
                <label htmlFor="profile-name">Nombre</label>
                <input
                  autoComplete="name"
                  id="profile-name"
                  maxLength={80}
                  minLength={2}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
                <button
                  className="button button-primary"
                  disabled={busy !== null || name.trim() === profile.displayName}
                  type="submit"
                >
                  {busy === 'name' ? 'Guardando…' : 'Guardar nombre'}
                </button>
              </form>
            </section>
            <section className="panel profile-edit-card">
              <div
                className="profile-section-icon profile-section-icon-security"
                aria-hidden="true"
              >
                ✧
              </div>
              <h2>Contraseña</h2>
              <p>
                Al cambiarla cerraremos todas tus sesiones y te pediremos iniciar sesión otra vez.
              </p>
              <form onSubmit={(event) => void savePassword(event)}>
                <label htmlFor="profile-current-password">Contraseña actual</label>
                <input
                  autoComplete="current-password"
                  id="profile-current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  type="password"
                  value={currentPassword}
                />
                <label htmlFor="profile-new-password">Nueva contraseña</label>
                <input
                  autoComplete="new-password"
                  id="profile-new-password"
                  minLength={12}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  type="password"
                  value={newPassword}
                />
                <label htmlFor="profile-confirm-password">Confirmar nueva contraseña</label>
                <input
                  autoComplete="new-password"
                  id="profile-confirm-password"
                  minLength={12}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  type="password"
                  value={confirmPassword}
                />
                <small>Usa al menos 12 caracteres y una contraseña distinta a la actual.</small>
                <button className="button button-secondary" disabled={busy !== null} type="submit">
                  {busy === 'password' ? 'Actualizando…' : 'Cambiar contraseña'}
                </button>
              </form>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
