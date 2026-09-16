import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import {
  AuthService,
  RegistrationError,
  RegistrationUnavailableError,
  type AuthStore,
  type RegisteredAccount,
} from './auth-service';
import { boundedJson, validPreAuthCsrf } from './auth-http';
import { scopedMongoDatabase, mongoRuntimeConfig } from './mongodb';
import { workspaceSetupSchema, emptyWorkspaceSetup } from '@/lib/workspace-setup';
import type { Db } from 'mongodb';

function store() {
  const accounts: RegisteredAccount[] = [];
  const adapter: AuthStore = {
    hasAnyUser: async () => accounts.length > 0,
    findUserByEmail: async (email) =>
      accounts.find((account) => account.user.emailNormalized === email)?.user ?? null,
    createUser: vi.fn(),
    createMembership: vi.fn(),
    createSession: vi.fn(),
    findActiveMemberships: async (id) =>
      accounts.filter((account) => account.user.id === id).map((account) => account.membership),
    findSession: async (hash) =>
      accounts.find((account) => account.session.sessionHash === hash)?.session ?? null,
    updateSessionCsrf: vi.fn(),
    revokeSession: vi.fn(),
    consumeLoginAttempt: async () => true,
    createAccount: async (account) => {
      accounts.push(account);
    },
  };
  return { adapter, accounts, auth: new AuthService(adapter) };
}
const input = () => ({
  displayName: 'Persona de prueba',
  email: `qa-${randomUUID()}@example.test`,
  password: randomUUID(),
});

describe('isolated account registration', () => {
  it('creates independent organizations and hashes passwords and session tokens', async () => {
    const { auth, accounts } = store();
    const body = input();
    const first = await auth.register(body);
    const second = await auth.register(input());
    expect(first.session.organizationId).not.toBe(second.session.organizationId);
    expect(first.session.role).toBe('NURSE');
    expect(accounts[0].user.passwordHash).not.toContain(body.password);
    expect(accounts[0].session.sessionHash).not.toBe(first.sessionToken);
    expect(accounts[0].session.csrfHash).not.toBe(first.csrfToken);
    await expect(auth.requireSession(first.sessionToken)).resolves.toMatchObject({
      organizationId: first.session.organizationId,
    });
  });
  it.each(['role', 'organizationId', 'userId', 'active', 'permissions'])(
    'rejects browser authority field %s',
    async (field) => {
      const { auth, accounts } = store();
      await expect(auth.register({ ...input(), [field]: 'forged' })).rejects.toBeInstanceOf(
        RegistrationError,
      );
      expect(accounts).toHaveLength(0);
    },
  );
  it('rejects invalid credentials before writing', async () => {
    const { auth, accounts } = store();
    await expect(
      auth.register({ ...input(), password: randomUUID().slice(0, 5) }),
    ).rejects.toBeInstanceOf(RegistrationError);
    await expect(auth.register({ ...input(), email: { $ne: null } })).rejects.toBeInstanceOf(
      RegistrationError,
    );
    expect(accounts).toHaveLength(0);
  });
  it('does not report success when the store fails or registration is unsupported', async () => {
    const { adapter, auth } = store();
    adapter.createAccount = async () => {
      throw new Error('storage unavailable');
    };
    await expect(auth.register(input())).rejects.toThrow('storage unavailable');
    delete adapter.createAccount;
    await expect(auth.register(input())).rejects.toBeInstanceOf(RegistrationUnavailableError);
  });
  it('fails closed at the persistent registration rate limit', async () => {
    const { adapter, auth, accounts } = store();
    adapter.consumeLoginAttempt = async () => false;
    await expect(auth.register(input())).rejects.toBeInstanceOf(RegistrationError);
    expect(accounts).toHaveLength(0);
  });
});

describe('public auth request boundary', () => {
  it('rejects cross-origin requests even with a matching double-submit token', () => {
    const request = (origin: string, csrf = 'qa-token') =>
      new NextRequest('https://analiza.example.test/api/auth/register', {
        method: 'POST',
        headers: { origin, cookie: 'analiza_login_csrf=qa-token', 'x-analiza-csrf': csrf },
      });
    expect(validPreAuthCsrf(request('https://analiza.example.test'))).toBe(true);
    expect(validPreAuthCsrf(request('https://other.example.test'))).toBe(false);
    expect(validPreAuthCsrf(request('https://analiza.example.test', 'wrong'))).toBe(false);
  });
  it('bounds actual body bytes and refuses non-JSON credential submissions', async () => {
    const request = new Request('https://example.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x'.repeat(9000) }),
    });
    await expect(boundedJson(request)).rejects.toThrow();
    await expect(
      boundedJson(new Request('https://example.test', { method: 'POST', body: 'password=x' })),
    ).rejects.toThrow();
  });
  it('accepts a valid loopback Host after NextURL normalization without accepting another origin', () => {
    const headers = {
      host: '127.0.0.1:4311',
      origin: 'http://127.0.0.1:4311',
      cookie: 'analiza_login_csrf=qa-token',
      'x-analiza-csrf': 'qa-token',
    };
    expect(
      validPreAuthCsrf(
        new NextRequest('http://127.0.0.1:4311/api/auth/register', { method: 'POST', headers }),
      ),
    ).toBe(true);
    expect(
      validPreAuthCsrf(
        new NextRequest('http://127.0.0.1:4311/api/auth/register', {
          method: 'POST',
          headers: { ...headers, origin: 'http://localhost:4312' },
        }),
      ),
    ).toBe(false);
  });
});

describe('workspace questionnaire boundaries', () => {
  it('rejects organization injection and duplicate staff identifiers', () => {
    const setup = emptyWorkspaceSetup();
    setup.organization.name = 'Organización sintética';
    expect(workspaceSetupSchema.safeParse({ ...setup, organizationId: 'other' }).success).toBe(
      false,
    );
    const person = {
      id: randomUUID(),
      name: 'Personal sintético',
      position: 'Administración',
      specialty: '',
      registrationNumber: '',
      email: '',
      phone: '',
      active: true,
    };
    expect(workspaceSetupSchema.safeParse({ ...setup, staff: [person, person] }).success).toBe(
      false,
    );
  });
  it('does not invent prices and requires currency for a supplied price', () => {
    const setup = emptyWorkspaceSetup();
    setup.organization.name = 'Organización sintética';
    const service = {
      id: randomUUID(),
      name: 'Servicio de prueba',
      description: '',
      modality: 'OTHER',
      currency: '',
      active: true,
    };
    const parsed = workspaceSetupSchema.parse({ ...setup, services: [service] });
    expect(parsed.services[0].price).toBeUndefined();
    expect(
      workspaceSetupSchema.safeParse({ ...setup, services: [{ ...service, price: 10 }] }).success,
    ).toBe(false);
  });
  it('namespaces Mongo collections and preserves the owning client for transactions', () => {
    const collection = vi.fn((name: string) => name);
    const client = {};
    const db = { collection, client } as unknown as Db;
    const scoped = scopedMongoDatabase(db, 'qa_trial_');
    scoped.collection('users');
    expect(collection).toHaveBeenCalledWith('qa_trial_users', undefined);
    expect(scoped.client).toBe(client);
    expect(() => scopedMongoDatabase(db, 'system.$')).toThrow();
    expect(() =>
      mongoRuntimeConfig({
        ANALIZA_DATA_MODE: 'mongodb',
        MONGODB_URI: 'mongodb://synthetic.invalid',
        MONGODB_DB: 'qa',
        MONGODB_COLLECTION_PREFIX: '../',
      }),
    ).toThrow();
  });
});
