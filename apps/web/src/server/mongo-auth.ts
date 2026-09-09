import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import type { Db } from 'mongodb';
import { isRole, type Role } from '@/lib/permissions';

const scrypt = promisify(nodeScrypt);
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

export const sessionCookieName = 'analiza_session';
export const loginCsrfCookieName = 'analiza_login_csrf';
export const csrfHeaderName = 'x-analiza-csrf';

export type ServerSession = Readonly<{
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
  expiresAt: Date;
}>;

type UserRecord = Readonly<{
  id: string;
  emailNormalized: string;
  passwordHash: string;
  disabledAt?: Date;
}>;
type MembershipRecord = Readonly<{
  userId: string;
  organizationId: string;
  role: Role;
  active: boolean;
}>;
type StoredSession = Readonly<{
  sessionHash: string;
  csrfHash: string;
  userId: string;
  organizationId: string;
  expiresAt: Date;
  revokedAt?: Date;
}>;

export class AuthenticationError extends Error {
  constructor() {
    super('No fue posible iniciar sesión.');
    this.name = 'AuthenticationError';
  }
}

export class SessionError extends Error {
  constructor() {
    super('La sesión no es válida.');
    this.name = 'SessionError';
  }
}

export class CsrfError extends Error {
  constructor() {
    super('La solicitud no pudo verificarse.');
    this.name = 'CsrfError';
  }
}

export class BootstrapError extends Error {
  constructor() {
    super('El bootstrap inicial no está autorizado.');
    this.name = 'BootstrapError';
  }
}

/**
 * This boundary deliberately exposes only fixed identity operations. It never accepts a role or
 * organization from HTTP input, and it does not offer public account creation.
 */
export interface MongoAuthStore {
  hasAnyUser(): Promise<boolean>;
  findUserByEmail(emailNormalized: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  findActiveMemberships(userId: string): Promise<MembershipRecord[]>;
  createMembership(membership: MembershipRecord): Promise<void>;
  createSession(session: StoredSession): Promise<void>;
  findSession(sessionHash: string): Promise<StoredSession | null>;
  updateSessionCsrf(sessionHash: string, csrfHash: string): Promise<void>;
  revokeSession(sessionHash: string, now: Date): Promise<void>;
  consumeLoginAttempt(key: string, now: Date): Promise<boolean>;
}

function hashSecret(secret: string) {
  return createHash('sha256').update(secret).digest('hex');
}

function randomSecret() {
  return randomBytes(32).toString('base64url');
}

function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase('en-US');
}

/** Password hashes are server-only `scrypt` records; plaintext is never stored or logged. */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 1024) throw new AuthenticationError();
  const salt = randomBytes(16).toString('base64url');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString('base64url')}`;
}

async function passwordMatches(password: string, storedHash: string) {
  const [algorithm, salt, expected] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expectedBytes = Buffer.from(expected, 'base64url');
  return expectedBytes.length === actual.length && timingSafeEqual(expectedBytes, actual);
}

function sessionFrom(stored: StoredSession, membership: MembershipRecord): ServerSession {
  return {
    id: stored.sessionHash,
    userId: stored.userId,
    organizationId: membership.organizationId,
    role: membership.role,
    expiresAt: stored.expiresAt,
  };
}

export class MongoAuthService {
  constructor(
    private readonly store: MongoAuthStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async login(
    input: unknown,
  ): Promise<{ sessionToken: string; csrfToken: string; session: ServerSession }> {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new AuthenticationError();
    const body = input as Record<string, unknown>;
    if (Object.keys(body).some((key) => key !== 'email' && key !== 'password')) {
      throw new AuthenticationError();
    }
    if (typeof body.email !== 'string' || typeof body.password !== 'string')
      throw new AuthenticationError();
    const email = normalizeEmail(body.email);
    if (!email || body.password.length > 1024) throw new AuthenticationError();
    if (!(await this.store.consumeLoginAttempt(hashSecret(email), this.now())))
      throw new AuthenticationError();

    const user = await this.store.findUserByEmail(email);
    if (!user || user.disabledAt || !(await passwordMatches(body.password, user.passwordHash))) {
      throw new AuthenticationError();
    }
    const memberships = (await this.store.findActiveMemberships(user.id)).filter(
      (membership) => membership.active && isRole(membership.role),
    );
    // A future account-selection flow must be an authenticated server command. Until then,
    // selecting one of several tenants from browser input is intentionally refused.
    if (memberships.length !== 1) throw new AuthenticationError();

    const issuedAt = this.now();
    const sessionToken = randomSecret();
    const csrfToken = randomSecret();
    const stored: StoredSession = {
      sessionHash: hashSecret(sessionToken),
      csrfHash: hashSecret(csrfToken),
      userId: user.id,
      organizationId: memberships[0].organizationId,
      expiresAt: new Date(issuedAt.getTime() + SESSION_TTL_MS),
    };
    await this.store.createSession(stored);
    return { sessionToken, csrfToken, session: sessionFrom(stored, memberships[0]) };
  }

  /**
   * This operation is deliberately not exposed by an HTTP route. A reviewed deployment bootstrap
   * supplies its server-only token and may create exactly one initial ADMIN membership.
   */
  async bootstrapInitialAdmin(input: unknown, expectedBootstrapToken: string): Promise<void> {
    if (!input || typeof input !== 'object' || Array.isArray(input) || !expectedBootstrapToken) {
      throw new BootstrapError();
    }
    const body = input as Record<string, unknown>;
    if (
      Object.keys(body).some(
        (key) =>
          key !== 'email' &&
          key !== 'password' &&
          key !== 'organizationId' &&
          key !== 'bootstrapToken',
      )
    ) {
      throw new BootstrapError();
    }
    if (
      typeof body.email !== 'string' ||
      typeof body.password !== 'string' ||
      typeof body.organizationId !== 'string' ||
      typeof body.bootstrapToken !== 'string'
    ) {
      throw new BootstrapError();
    }
    const supplied = Buffer.from(body.bootstrapToken);
    const expected = Buffer.from(expectedBootstrapToken);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected) ||
      (await this.store.hasAnyUser())
    ) {
      throw new BootstrapError();
    }
    const emailNormalized = normalizeEmail(body.email);
    if (!emailNormalized || !body.organizationId.trim()) throw new BootstrapError();
    const user: UserRecord = {
      id: randomUUID(),
      emailNormalized,
      passwordHash: await hashPassword(body.password),
    };
    await this.store.createUser(user);
    await this.store.createMembership({
      userId: user.id,
      organizationId: body.organizationId,
      role: 'ADMIN',
      active: true,
    });
  }

  /** Resolves membership and role on every request, rather than trusting session/UI metadata. */
  async requireSession(sessionToken: string | undefined): Promise<ServerSession> {
    if (!sessionToken) throw new SessionError();
    const stored = await this.store.findSession(hashSecret(sessionToken));
    const now = this.now();
    if (!stored || stored.revokedAt || stored.expiresAt <= now) throw new SessionError();
    const memberships = await this.store.findActiveMemberships(stored.userId);
    const membership = memberships.find(
      (candidate) =>
        candidate.active &&
        candidate.organizationId === stored.organizationId &&
        isRole(candidate.role),
    );
    if (!membership) throw new SessionError();
    return sessionFrom(stored, membership);
  }

  async requireCsrf(
    sessionToken: string | undefined,
    csrfToken: string | undefined,
  ): Promise<void> {
    if (!sessionToken || !csrfToken) throw new CsrfError();
    const stored = await this.store.findSession(hashSecret(sessionToken));
    const now = this.now();
    if (!stored || stored.revokedAt || stored.expiresAt <= now) throw new CsrfError();
    const expected = Buffer.from(stored.csrfHash, 'hex');
    const received = Buffer.from(hashSecret(csrfToken), 'hex');
    if (expected.length !== received.length || !timingSafeEqual(expected, received))
      throw new CsrfError();
  }

  async rotateCsrf(sessionToken: string | undefined): Promise<string> {
    const session = await this.requireSession(sessionToken);
    const csrfToken = randomSecret();
    await this.store.updateSessionCsrf(session.id, hashSecret(csrfToken));
    return csrfToken;
  }

  async logout(sessionToken: string | undefined): Promise<void> {
    if (sessionToken) await this.store.revokeSession(hashSecret(sessionToken), this.now());
  }
}

type MongoCollection = {
  findOne(query: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  find(query: Record<string, unknown>): { toArray(): Promise<Record<string, unknown>[]> };
  insertOne(document: Record<string, unknown>): Promise<unknown>;
  updateOne(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<unknown>;
  findOneAndUpdate(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null>;
};

function asDate(value: unknown): Date | undefined {
  return value instanceof Date ? value : undefined;
}

function asUser(row: Record<string, unknown> | null): UserRecord | null {
  if (
    !row ||
    typeof row.id !== 'string' ||
    typeof row.emailNormalized !== 'string' ||
    typeof row.passwordHash !== 'string'
  )
    return null;
  return {
    id: row.id,
    emailNormalized: row.emailNormalized,
    passwordHash: row.passwordHash,
    disabledAt: asDate(row.disabledAt),
  };
}

function asMembership(row: Record<string, unknown>): MembershipRecord | null {
  if (
    typeof row.userId !== 'string' ||
    typeof row.organizationId !== 'string' ||
    !isRole(row.role) ||
    typeof row.active !== 'boolean'
  )
    return null;
  return {
    userId: row.userId,
    organizationId: row.organizationId,
    role: row.role,
    active: row.active,
  };
}

function asStoredSession(row: Record<string, unknown> | null): StoredSession | null {
  if (
    !row ||
    typeof row.sessionHash !== 'string' ||
    typeof row.csrfHash !== 'string' ||
    typeof row.userId !== 'string' ||
    typeof row.organizationId !== 'string' ||
    !(row.expiresAt instanceof Date)
  )
    return null;
  return {
    sessionHash: row.sessionHash,
    csrfHash: row.csrfHash,
    userId: row.userId,
    organizationId: row.organizationId,
    expiresAt: row.expiresAt,
    revokedAt: asDate(row.revokedAt),
  };
}

/** MongoDB driver adapter. Indexes are provisioned outside requests by the deployment runbook. */
export function mongoAuthStore(database: Db): MongoAuthStore {
  const users = database.collection('users') as unknown as MongoCollection;
  const memberships = database.collection('memberships') as unknown as MongoCollection;
  const sessions = database.collection('sessions') as unknown as MongoCollection;
  const rateLimits = database.collection('authRateLimits') as unknown as MongoCollection;
  return {
    async hasAnyUser() {
      return Boolean(await users.findOne({}));
    },
    async findUserByEmail(emailNormalized) {
      return asUser(await users.findOne({ emailNormalized }));
    },
    async createUser(user) {
      await users.insertOne({ ...user, createdAt: new Date() });
    },
    async findActiveMemberships(userId) {
      return (await memberships.find({ userId, active: true }).toArray())
        .map(asMembership)
        .filter((membership): membership is MembershipRecord => membership !== null);
    },
    async createMembership(membership) {
      await memberships.insertOne({ ...membership, createdAt: new Date() });
    },
    async createSession(session) {
      await sessions.insertOne({ ...session, createdAt: new Date() });
    },
    async findSession(sessionHash) {
      return asStoredSession(await sessions.findOne({ sessionHash }));
    },
    async updateSessionCsrf(sessionHash, csrfHash) {
      await sessions.updateOne(
        { sessionHash, revokedAt: { $exists: false } },
        { $set: { csrfHash } },
      );
    },
    async revokeSession(sessionHash, now) {
      await sessions.updateOne(
        { sessionHash, revokedAt: { $exists: false } },
        { $set: { revokedAt: now } },
      );
    },
    async consumeLoginAttempt(key, now) {
      const cutoff = new Date(now.getTime() - LOGIN_WINDOW_MS);
      const updated = await rateLimits.findOneAndUpdate(
        { key },
        [
          {
            $set: {
              windowStartedAt: {
                $cond: [{ $lte: ['$windowStartedAt', cutoff] }, now, '$windowStartedAt'],
              },
              attempts: {
                $cond: [{ $lte: ['$windowStartedAt', cutoff] }, 1, { $add: ['$attempts', 1] }],
              },
              expiresAt: new Date(now.getTime() + LOGIN_WINDOW_MS),
            },
          },
        ] as unknown as Record<string, unknown>,
        { upsert: true, returnDocument: 'after' },
      );
      return Boolean(
        updated && typeof updated.attempts === 'number' && updated.attempts <= LOGIN_MAX_ATTEMPTS,
      );
    },
  };
}

export const mongoAuthIndexes = [
  {
    collection: 'users',
    key: { emailNormalized: 1 },
    name: 'users_email_normalized_unique',
    unique: true,
  },
  {
    collection: 'memberships',
    key: { userId: 1, organizationId: 1 },
    name: 'memberships_user_org_unique',
    unique: true,
  },
  { collection: 'sessions', key: { sessionHash: 1 }, name: 'sessions_hash_unique', unique: true },
  {
    collection: 'sessions',
    key: { expiresAt: 1 },
    name: 'sessions_expiry_ttl',
    expireAfterSeconds: 0,
  },
  {
    collection: 'authRateLimits',
    key: { key: 1 },
    name: 'auth_rate_limits_key_unique',
    unique: true,
  },
  {
    collection: 'authRateLimits',
    key: { expiresAt: 1 },
    name: 'auth_rate_limits_expiry_ttl',
    expireAfterSeconds: 0,
  },
] as const;
