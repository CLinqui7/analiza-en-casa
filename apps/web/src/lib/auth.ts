'use client';
import { isServerDataMode, configuredServerDataMode } from '@/lib/data-mode';

import { getSupabaseBrowserClient } from '@/lib/supabase';
import { isRole, type Role } from '@/lib/permissions';
import { isCoreRelease } from '@/lib/release-profile';
import type { RegistrationInput } from '@/lib/registration';

const mockSessionKey = 'analiza.en.casa.mock-session.v1';
let mongoCsrfToken: string | null = null;
export type AuthSession = {
  userId: string;
  role: Role;
  mode: 'mock' | 'supabase' | 'mongodb' | 'postgresql';
};

const mockUsers = [
  ['admin@demo.local', 'demo-admin', 'ADMIN'],
  ['doctor@demo.local', 'demo-doctor', 'DOCTOR'],
  ['nurse@demo.local', 'demo-nurse', 'NURSE'],
  ['inventory@demo.local', 'demo-inventory', 'INVENTORY'],
  ['finance@demo.local', 'demo-finance', 'FINANCE'],
  ['auditor@demo.local', 'demo-auditor', 'AUDITOR'],
] as const satisfies ReadonlyArray<readonly [string, string, Role]>;

export function isSupabaseMode() {
  return getSupabaseBrowserClient() !== null;
}

function isMongoMode() {
  return isCoreRelease || isServerDataMode(process.env.NEXT_PUBLIC_DATA_MODE);
}

/** Demo credentials are only a local fixture and must never be advertised by a configured backend. */
export function isDemoAuthMode() {
  return !isMongoMode() && !isSupabaseMode();
}

/** Used only by same-origin Mongo resource commands after a server session has issued CSRF. */
export function mongoMutationHeaders(): Record<string, string> {
  if (!mongoCsrfToken) throw new Error('La sesión segura no está preparada para guardar.');
  return { 'X-Analiza-Csrf': mongoCsrfToken };
}

export function readMockSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const candidate: unknown = JSON.parse(window.localStorage.getItem(mockSessionKey) ?? 'null');
    if (
      candidate &&
      typeof candidate === 'object' &&
      'userId' in candidate &&
      'role' in candidate &&
      typeof candidate.userId === 'string' &&
      isRole(candidate.role)
    ) {
      return { userId: candidate.userId, role: candidate.role, mode: 'mock' };
    }
  } catch {
    // Invalid synthetic session is treated as absent rather than trusted.
  }
  return null;
}

export async function loadSession(): Promise<AuthSession | null> {
  if (isMongoMode()) {
    const response = await fetch('/api/auth/session', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('No fue posible validar la sesión segura.');
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object') throw new Error('La sesión segura no es válida.');
    const { userId, role } = payload as Record<string, unknown>;
    if (typeof userId !== 'string' || !isRole(role))
      throw new Error('La sesión segura no es válida.');
    const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
    const csrfPayload: unknown = csrfResponse.ok ? await csrfResponse.json() : null;
    const csrfToken =
      csrfPayload &&
      typeof csrfPayload === 'object' &&
      typeof (csrfPayload as Record<string, unknown>).csrfToken === 'string'
        ? (csrfPayload as Record<string, string>).csrfToken
        : null;
    if (!csrfToken) throw new Error('No fue posible preparar la sesión segura.');
    mongoCsrfToken = csrfToken;
    return { userId, role, mode: configuredServerDataMode() };
  }
  const client = getSupabaseBrowserClient();
  if (!client) return readMockSession();
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error('No fue posible validar la sesión de Supabase.');
  if (!data.session) return null;
  const role = data.session.user.app_metadata?.role;
  if (!isRole(role)) throw new Error('La sesión de Supabase no contiene un rol operativo válido.');
  return { userId: data.session.user.id, role, mode: 'supabase' };
}

async function serverAuthenticate(
  path: string,
  input: { email: string; password: string } | RegistrationInput,
): Promise<AuthSession> {
  const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
  if (!csrfResponse.ok) throw new Error('No fue posible preparar el acceso seguro.');
  const csrfPayload: unknown = await csrfResponse.json();
  const csrfToken =
    csrfPayload &&
    typeof csrfPayload === 'object' &&
    typeof (csrfPayload as Record<string, unknown>).csrfToken === 'string'
      ? (csrfPayload as Record<string, string>).csrfToken
      : null;
  if (!csrfToken) throw new Error('No fue posible preparar el acceso seguro.');
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Analiza-Csrf': csrfToken },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    if (response.status >= 500)
      throw new Error(
        'El servicio de acceso no está disponible. Intenta nuevamente en unos minutos.',
      );
    throw new Error(
      path.endsWith('/register')
        ? 'No fue posible crear la cuenta con esos datos. Revísalos o intenta iniciar sesión.'
        : 'No fue posible iniciar sesión. Revisa tu correo y contraseña.',
    );
  }
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw new Error('No fue posible iniciar sesión.');
  const { userId, role, csrfToken: returnedCsrf } = payload as Record<string, unknown>;
  if (typeof userId !== 'string' || !isRole(role) || typeof returnedCsrf !== 'string') {
    throw new Error('No fue posible iniciar sesión.');
  }
  mongoCsrfToken = returnedCsrf;
  return { userId, role, mode: configuredServerDataMode() };
}

export async function register(input: RegistrationInput): Promise<AuthSession> {
  return serverAuthenticate('/api/auth/register', input);
}

export async function login(email: string, password: string): Promise<AuthSession> {
  if (isMongoMode()) return serverAuthenticate('/api/auth/login', { email, password });
  const client = getSupabaseBrowserClient();
  if (client) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error('No fue posible iniciar sesión con Supabase.');
    const role = data.session.user.app_metadata?.role;
    if (!isRole(role)) {
      await client.auth.signOut();
      throw new Error('La cuenta no tiene un rol operativo válido.');
    }
    return { userId: data.session.user.id, role, mode: 'supabase' };
  }
  const user = mockUsers.find(
    ([candidateEmail, candidatePassword]) =>
      candidateEmail === email.trim().toLowerCase() && candidatePassword === password,
  );
  if (!user) throw new Error('Credenciales no válidas.');
  const session: AuthSession = {
    userId: `mock-${user[2].toLowerCase()}`,
    role: user[2],
    mode: 'mock',
  };
  window.localStorage.setItem(mockSessionKey, JSON.stringify(session));
  return session;
}

export async function logout(session: AuthSession | null): Promise<void> {
  if (isServerDataMode(session?.mode)) {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: mongoCsrfToken ? { 'X-Analiza-Csrf': mongoCsrfToken } : {},
    });
    mongoCsrfToken = null;
    if (!response.ok) throw new Error('No fue posible cerrar sesión de forma segura.');
    return;
  }
  if (session?.mode === 'supabase') {
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error('La configuración de Supabase dejó de estar disponible.');
    const { error } = await client.auth.signOut();
    if (error) throw new Error('No fue posible cerrar sesión en Supabase.');
  }
  if (typeof window !== 'undefined') window.localStorage.removeItem(mockSessionKey);
}

export const mockCredentialHint = 'admin@demo.local / demo-admin';

export function safeNextPath(next: string | null, fallback = '/dashboard') {
  return next && next.startsWith('/') && !next.startsWith('//') && !/[\\\u0000-\u001f]/.test(next)
    ? next
    : fallback;
}
