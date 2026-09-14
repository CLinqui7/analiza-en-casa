import type { Db } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { isRole } from '@/lib/permissions';
import {
  LOGIN_WINDOW_MS,
  LOGIN_MAX_ATTEMPTS,
  RegistrationError,
  type UserRecord,
  type MembershipRecord,
  type StoredSession,
  type AuthStore as MongoAuthStore,
} from './auth-service';
export * from './auth-service';
export { AuthService as MongoAuthService } from './auth-service';
export type { AuthStore as MongoAuthStore } from './auth-service';

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
      const user = await users.findOne({ id: userId });
      if (!user || user.disabledAt) return [];
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
    async consumeLoginAttempt(key, now, maximum = LOGIN_MAX_ATTEMPTS, windowMs = LOGIN_WINDOW_MS) {
      const cutoff = new Date(now.getTime() - windowMs);
      const updated = await rateLimits.findOneAndUpdate(
        { key },
        [
          {
            $set: {
              windowStartedAt: {
                $cond: [
                  { $lte: [{ $ifNull: ['$windowStartedAt', new Date(0)] }, cutoff] },
                  now,
                  '$windowStartedAt',
                ],
              },
              attempts: {
                $cond: [
                  { $lte: [{ $ifNull: ['$windowStartedAt', new Date(0)] }, cutoff] },
                  1,
                  { $add: [{ $ifNull: ['$attempts', 0] }, 1] },
                ],
              },
              expiresAt: new Date(now.getTime() + windowMs),
            },
          },
        ] as unknown as Record<string, unknown>,
        { upsert: true, returnDocument: 'after' },
      );
      return Boolean(
        updated && typeof updated.attempts === 'number' && updated.attempts <= maximum,
      );
    },
    async createAccount(account) {
      const transaction = database.client.startSession();
      try {
        await transaction.withTransaction(
          async () => {
            const options = { session: transaction };
            await database
              .collection('users')
              .insertOne({ ...account.user, createdAt: account.createdAt }, options);
            await database.collection('organizations').insertOne(
              {
                id: account.membership.organizationId,
                createdBy: account.user.id,
                createdAt: account.createdAt,
                onboardingVersion: 0,
              },
              options,
            );
            await database
              .collection('memberships')
              .insertOne({ ...account.membership, createdAt: account.createdAt }, options);
            await database
              .collection('sessions')
              .insertOne({ ...account.session, createdAt: account.createdAt }, options);
            await database.collection('auditEvents').insertOne(
              {
                id: randomUUID(),
                organizationId: account.membership.organizationId,
                actorUserId: account.user.id,
                resourceId: account.user.id,
                action: 'account.registered',
                occurredAt: account.createdAt,
              },
              options,
            );
          },
          { writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000, timeoutMS: 10000 },
        );
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 11000)
          throw new RegistrationError();
        throw error;
      } finally {
        await transaction.endSession();
      }
    },
  };
}

export const mongoAuthIndexes = [
  { collection: 'organizations', key: { id: 1 }, name: 'organizations_id_unique', unique: true },
  { collection: 'users', key: { id: 1 }, name: 'users_id_unique', unique: true },
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
