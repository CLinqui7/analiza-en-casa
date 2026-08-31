'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase';
import { isRole, type Role } from '@/lib/permissions';

const mockSessionKey = 'analiza.en.casa.mock-session.v1';
export type AuthSession = { userId: string; role: Role; mode: 'mock' | 'supabase' };

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
  const client = getSupabaseBrowserClient();
  if (!client) return readMockSession();
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error('No fue posible validar la sesión de Supabase.');
  if (!data.session) return null;
  const role = data.session.user.app_metadata?.role ?? data.session.user.user_metadata?.role;
  if (!isRole(role)) throw new Error('La sesión de Supabase no contiene un rol operativo válido.');
  return { userId: data.session.user.id, role, mode: 'supabase' };
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const client = getSupabaseBrowserClient();
  if (client) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error('No fue posible iniciar sesión con Supabase.');
    const role = data.session.user.app_metadata?.role ?? data.session.user.user_metadata?.role;
    if (!isRole(role)) {
      await client.auth.signOut();
      throw new Error('La cuenta no tiene un rol operativo válido.');
    }
    return { userId: data.session.user.id, role, mode: 'supabase' };
  }
  const user = mockUsers.find(([candidateEmail, candidatePassword]) =>
    candidateEmail === email.trim().toLowerCase() && candidatePassword === password,
  );
  if (!user) throw new Error('Credenciales no válidas.');
  const session: AuthSession = { userId: `mock-${user[2].toLowerCase()}`, role: user[2], mode: 'mock' };
  window.localStorage.setItem(mockSessionKey, JSON.stringify(session));
  return session;
}

export async function logout(session: AuthSession | null): Promise<void> {
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
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}
