import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { isRole, type Role } from '@/lib/permissions';
import { registrationSchema } from '@/lib/registration';

const scrypt = promisify(nodeScrypt);
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_ATTEMPTS = 5;

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

export type UserRecord = Readonly<{
  id: string;
  emailNormalized: string;
  passwordHash: string;
  disabledAt?: Date;
}>;
export type MembershipRecord = Readonly<{
  userId: string;
  organizationId: string;
  role: Role;
  active: boolean;
}>;
export type StoredSession = Readonly<{
  sessionHash: string;
  csrfHash: string;
  userId: string;
  organizationId: string;
  expiresAt: Date;
  revokedAt?: Date;
}>;

export type RegisteredAccount = Readonly<{
  user: UserRecord & { displayName: string };
  membership: MembershipRecord;
  session: StoredSession;
  createdAt: Date;
}>;

export class RegistrationError extends Error {
  constructor() {
    super('No fue posible crear la cuenta con esos datos.');
    this.name = 'RegistrationError';
  }
}

export class RegistrationUnavailableError extends Error {
  constructor() {
    super('El registro no está disponible.');
    this.name = 'RegistrationUnavailableError';
  }
}

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
 * organization from HTTP input. Registration creates a new isolated organization atomically.
 */
export interface AuthStore {
  hasAnyUser(): Promise<boolean>;
  findUserByEmail(emailNormalized: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<void>;
  findActiveMemberships(userId: string): Promise<MembershipRecord[]>;
  createMembership(membership: MembershipRecord): Promise<void>;
  createSession(session: StoredSession): Promise<void>;
  findSession(sessionHash: string): Promise<StoredSession | null>;
  updateSessionCsrf(sessionHash: string, csrfHash: string): Promise<void>;
  revokeSession(sessionHash: string, now: Date): Promise<void>;
  consumeLoginAttempt(
    key: string,
    now: Date,
    maximum?: number,
    windowMs?: number,
  ): Promise<boolean>;
  createAccount?(account: RegisteredAccount): Promise<void>;
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

// Unknown and disabled accounts perform the same password derivation as valid accounts.
let dummyPasswordHash: Promise<string> | undefined;
function unknownAccountHash() {
  return (dummyPasswordHash ??= hashPassword(randomSecret()));
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

export class AuthService {
  constructor(
    private readonly store: AuthStore,
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
    if (!email || email.length > 254 || !body.password || body.password.length > 1024)
      throw new AuthenticationError();
    if (!(await this.store.consumeLoginAttempt(hashSecret(email), this.now())))
      throw new AuthenticationError();

    const user = await this.store.findUserByEmail(email);
    const matches = await passwordMatches(
      body.password,
      user?.passwordHash ?? (await unknownAccountHash()),
    );
    if (!user || user.disabledAt || !matches) {
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

  async register(input: unknown) {
    if (!this.store.createAccount) throw new RegistrationUnavailableError();
    const parsed = registrationSchema.safeParse(input);
    if (!parsed.success) throw new RegistrationError();
    const { displayName, email, password } = parsed.data;
    const now = this.now();
    const hour = 60 * 60 * 1000;
    if (
      !(await this.store.consumeLoginAttempt(hashSecret(`register:${email}`), now, 5, hour)) ||
      !(await this.store.consumeLoginAttempt(hashSecret('register:global'), now, 100, hour))
    ) {
      throw new RegistrationError();
    }
    const user = {
      id: randomUUID(),
      emailNormalized: email,
      displayName,
      passwordHash: await hashPassword(password),
    };
    const designatedAdminEmail = normalizeEmail(process.env.ANALIZA_ADMIN_EMAIL ?? '');
    const sharedOrganizationId = process.env.ANALIZA_SHARED_ORGANIZATION_ID?.trim();
    const membership: MembershipRecord = {
      userId: user.id,
      organizationId: sharedOrganizationId || randomUUID(),
      role: email === designatedAdminEmail ? 'ADMIN' : 'NURSE',
      active: true,
    };
    const sessionToken = randomSecret();
    const csrfToken = randomSecret();
    const stored: StoredSession = {
      sessionHash: hashSecret(sessionToken),
      csrfHash: hashSecret(csrfToken),
      userId: user.id,
      organizationId: membership.organizationId,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    };
    // User, organization, membership, session and audit event either all persist or none do.
    await this.store.createAccount({ user, membership, session: stored, createdAt: now });
    return { sessionToken, csrfToken, session: sessionFrom(stored, membership) };
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
