import { describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  BootstrapError,
  CsrfError,
  hashPassword,
  MongoAuthService,
  SessionError,
  type MongoAuthStore,
} from './mongo-auth';
import { authorizationStatus, resourceStatus } from './http-auth';
import { can } from '@/lib/permissions';
import { createHash } from 'node:crypto';

const syntheticPassword = ['synthetic', 'password'].join('-');
const rejectedPassword = ['wrong', 'password'].join('-');
import { MongoAccessError } from './mongo-patients';
import type { Role } from '@/lib/permissions';

type MemorySession = Parameters<MongoAuthStore['createSession']>[0];

class MemoryAuthStore implements MongoAuthStore {
  private readonly sessions = new Map<string, MemorySession>();
  private readonly attempts = new Map<string, number>();
  user: { id: string; emailNormalized: string; passwordHash: string } | null = null;
  memberships: Array<{
    userId: string;
    organizationId: string;
    role: Role;
    active: boolean;
    dashboardRestricted?: boolean;
  }> = [];
  successfulLogins: Array<{ userId: string; occurredAt: Date }> = [];

  async findUserByEmail(emailNormalized: string) {
    return this.user?.emailNormalized === emailNormalized ? this.user : null;
  }
  async hasAnyUser() {
    return this.user !== null;
  }
  async createUser(user: { id: string; emailNormalized: string; passwordHash: string }) {
    this.user = user;
  }
  async findActiveMemberships(userId: string) {
    return this.memberships.filter(
      (membership) => membership.userId === userId && membership.active,
    );
  }
  async createMembership(membership: {
    userId: string;
    organizationId: string;
    role: Role;
    active: boolean;
  }) {
    this.memberships.push(membership);
  }
  async createSession(session: MemorySession) {
    this.sessions.set(session.sessionHash, session);
  }
  async createLoginSession(session: MemorySession, occurredAt: Date) {
    this.sessions.set(session.sessionHash, session);
    this.successfulLogins.push({ userId: session.userId, occurredAt });
  }
  async findSession(sessionHash: string) {
    return this.sessions.get(sessionHash) ?? null;
  }
  async updateSessionCsrf(sessionHash: string, csrfHash: string) {
    const session = this.sessions.get(sessionHash);
    if (session) this.sessions.set(sessionHash, { ...session, csrfHash });
  }
  async revokeSession(sessionHash: string, now: Date) {
    const session = this.sessions.get(sessionHash);
    if (session) this.sessions.set(sessionHash, { ...session, revokedAt: now });
  }
  async consumeLoginAttempt(key: string) {
    const attempts = (this.attempts.get(key) ?? 0) + 1;
    this.attempts.set(key, attempts);
    return attempts <= 5;
  }
}

async function fixture() {
  const store = new MemoryAuthStore();
  store.user = {
    id: 'user-synthetic-a',
    emailNormalized: 'user-a@example.test',
    passwordHash: await hashPassword('synthetic-password'),
  };
  store.memberships = [
    { userId: 'user-synthetic-a', organizationId: 'org-a', role: 'DOCTOR', active: true },
  ];
  return { store, auth: new MongoAuthService(store), password: syntheticPassword };
}

describe('Mongo authentication and authorization', () => {
  // test-id: vitest:m01-server-role-tenant
  it('derives organization and role from the membership, rejecting browser authority fields', async () => {
    const { auth, password, store } = await fixture();
    const result = await auth.login({ email: 'USER-A@example.test', password });
    expect(result.session).toMatchObject({
      userId: 'user-synthetic-a',
      organizationId: 'org-a',
      role: 'DOCTOR',
    });
    expect(store.successfulLogins).toEqual([
      expect.objectContaining({ userId: 'user-synthetic-a' }),
    ]);
    await expect(
      auth.login({ email: 'user-a@example.test', password, organizationId: 'org-other' }),
    ).rejects.toBeInstanceOf(AuthenticationError);
    await expect(
      auth.login({ email: 'user-a@example.test', password, role: 'ADMIN' }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  // test-id: vitest:m01-server-membership-refresh
  it('refreshes role and rejects a removed membership on every direct server operation', async () => {
    const { auth, store, password } = await fixture();
    const result = await auth.login({ email: 'user-a@example.test', password });
    store.memberships[0] = { ...store.memberships[0], role: 'AUDITOR' };
    await expect(auth.requireSession(result.sessionToken)).resolves.toMatchObject({
      role: 'AUDITOR',
    });
    store.memberships = [];
    await expect(auth.requireSession(result.sessionToken)).rejects.toBeInstanceOf(SessionError);
  });

  it('honors an account-specific Dashboard exclusion without removing administrator permissions', async () => {
    const { auth, store, password } = await fixture();
    store.memberships[0] = {
      ...store.memberships[0],
      role: 'ADMIN',
      dashboardRestricted: true,
    };
    const result = await auth.login({ email: 'user-a@example.test', password });
    expect(result.session).toMatchObject({ role: 'ADMIN', dashboardAccess: false });
    expect(can(result.session.role, 'quotes:write')).toBe(true);
    expect(can(result.session.role, 'cases:write')).toBe(true);
    await expect(auth.requireSession(result.sessionToken)).resolves.toMatchObject({
      role: 'ADMIN',
      dashboardAccess: false,
    });
  });

  // test-id: vitest:m01-server-csrf-logout-revocation
  it('requires CSRF for mutation and makes logout revoke the session for direct API calls', async () => {
    const { auth, password } = await fixture();
    const result = await auth.login({ email: 'user-a@example.test', password });
    await expect(auth.requireCsrf(result.sessionToken, 'wrong-token')).rejects.toBeInstanceOf(
      CsrfError,
    );
    await expect(auth.requireCsrf(result.sessionToken, result.csrfToken)).resolves.toBeUndefined();
    await auth.logout(result.sessionToken);
    await expect(auth.requireSession(result.sessionToken)).rejects.toBeInstanceOf(SessionError);
  });

  // test-id: vitest:csrf-multitab-stability
  it('keeps concurrent tab CSRF reads stable and rejects tokens belonging to another session', async () => {
    const { auth, password } = await fixture();
    const first = await auth.login({ email: 'user-a@example.test', password });
    const tokens = await Promise.all(
      Array.from({ length: 5 }, () => auth.getCsrf(first.sessionToken)),
    );
    expect(new Set(tokens)).toEqual(new Set([first.csrfToken]));
    expect(first.csrfToken).not.toBe(first.sessionToken);
    const second = await auth.login({ email: 'user-a@example.test', password });
    expect(second.csrfToken).not.toBe(first.csrfToken);
    await expect(auth.requireCsrf(second.sessionToken, first.csrfToken)).rejects.toBeInstanceOf(
      CsrfError,
    );
    for (const invalid of [undefined, '', 'invalid', first.csrfToken.slice(1)]) {
      await expect(auth.requireCsrf(first.sessionToken, invalid)).rejects.toBeInstanceOf(CsrfError);
    }
    await expect(auth.requireCsrf(first.sessionToken, tokens[0])).resolves.toBeUndefined();
    await auth.logout(first.sessionToken);
    await expect(auth.getCsrf(first.sessionToken)).rejects.toBeInstanceOf(SessionError);
    await expect(auth.requireCsrf(first.sessionToken, tokens[0])).rejects.toBeInstanceOf(CsrfError);
  });

  it('preserves a pre-upgrade form token without rotating its stored hash or bypassing expiry', async () => {
    const { auth, password, store } = await fixture();
    const first = await auth.login({ email: 'user-a@example.test', password });
    const legacyToken = 'synthetic-legacy-csrf';
    const hash = createHash('sha256').update(legacyToken).digest('hex');
    await store.updateSessionCsrf(first.session.id, hash);
    const current = await auth.getCsrf(first.sessionToken);
    expect((await store.findSession(first.session.id))?.csrfHash).toBe(hash);
    await expect(auth.requireCsrf(first.sessionToken, legacyToken)).resolves.toBeUndefined();
    await expect(auth.requireCsrf(first.sessionToken, current)).resolves.toBeUndefined();
    const stored = (await store.findSession(first.session.id))!;
    await store.createSession({ ...stored, expiresAt: new Date(0) });
    await expect(auth.getCsrf(first.sessionToken)).rejects.toBeInstanceOf(SessionError);
    await expect(auth.requireCsrf(first.sessionToken, legacyToken)).rejects.toBeInstanceOf(
      CsrfError,
    );
    await expect(auth.requireCsrf(first.sessionToken, current)).rejects.toBeInstanceOf(CsrfError);
  });

  // test-id: vitest:m01-server-rate-and-generic-login
  it('uses a generic error for bad credentials and applies the login rate limit', async () => {
    const { auth } = await fixture();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        auth.login({ email: 'user-a@example.test', password: rejectedPassword }),
      ).rejects.toBeInstanceOf(AuthenticationError);
    }
    await expect(
      auth.login({ email: 'user-a@example.test', password: syntheticPassword }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  // test-id: vitest:m01-bootstrap-admin-only
  it('allows one initial ADMIN only through a bootstrap token and never accepts a supplied role', async () => {
    const store = new MemoryAuthStore();
    const auth = new MongoAuthService(store);
    await auth.bootstrapInitialAdmin(
      {
        email: 'bootstrap@example.test',
        password: syntheticPassword,
        organizationId: 'org-bootstrap',
        bootstrapToken: 'bootstrap-secret',
      },
      'bootstrap-secret',
    );
    expect(store.memberships).toEqual([
      expect.objectContaining({ organizationId: 'org-bootstrap', role: 'ADMIN', active: true }),
    ]);
    await expect(
      auth.bootstrapInitialAdmin(
        {
          email: 'other@example.test',
          password: syntheticPassword,
          organizationId: 'org-other',
          bootstrapToken: 'bootstrap-secret',
        },
        'bootstrap-secret',
      ),
    ).rejects.toBeInstanceOf(BootstrapError);
  });

  // test-id: vitest:m01-server-401-403-404-contract
  it('keeps unauthenticated and forbidden outcomes distinct while tenant-missing records are 404', () => {
    expect(authorizationStatus(new SessionError())).toBe(401);
    expect(authorizationStatus(new CsrfError())).toBe(403);
    expect(authorizationStatus(new MongoAccessError())).toBe(403);
    // A tenant-scoped repository returns null for a missing or foreign ID; the route maps it to 404.
    expect(resourceStatus(null)).toBe(404);
  });
});
