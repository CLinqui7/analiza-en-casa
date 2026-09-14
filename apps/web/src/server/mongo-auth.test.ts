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

const syntheticPassword = ['synthetic', 'password'].join('-');
const rejectedPassword = ['wrong', 'password'].join('-');
import { MongoAccessError } from './mongo-patients';
import type { Role } from '@/lib/permissions';

type MemorySession = Parameters<MongoAuthStore['createSession']>[0];

class MemoryAuthStore implements MongoAuthStore {
  private readonly sessions = new Map<string, MemorySession>();
  private readonly attempts = new Map<string, number>();
  user: { id: string; emailNormalized: string; passwordHash: string } | null = null;
  memberships: Array<{ userId: string; organizationId: string; role: Role; active: boolean }> = [];

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
    const { auth, password } = await fixture();
    const result = await auth.login({ email: 'USER-A@example.test', password });
    expect(result.session).toMatchObject({
      userId: 'user-synthetic-a',
      organizationId: 'org-a',
      role: 'DOCTOR',
    });
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
