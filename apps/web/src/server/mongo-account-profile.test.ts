import { describe, expect, it } from 'vitest';
import type { Db } from 'mongodb';
import { hashPassword, passwordMatches } from './auth-service';
import { MongoAccountProfileRepository } from './mongo-account-profile';
import { ProfileUnavailableError } from './profile-errors';
import type { ServerActor } from './validation/patients';

const actor: ServerActor = {
  userId: 'synthetic-user',
  organizationId: 'synthetic-org',
  role: 'NURSE',
};

async function fixture() {
  const user = {
    id: actor.userId,
    emailNormalized: 'synthetic@example.test',
    displayName: 'Synthetic User',
    passwordHash: await hashPassword('synthetic-old-password'),
    avatarVersion: 0,
  };
  const events: Array<{ action: string }> = [];
  const sessions = [{ userId: actor.userId, revokedAt: undefined as Date | undefined }];
  const database = {
    client: {
      startSession: () => ({
        withTransaction: async (fn: () => Promise<void>) => fn(),
        endSession: async () => undefined,
      }),
    },
    collection(name: string) {
      if (name === 'memberships')
        return {
          findOne: async (filter: { organizationId: string }) =>
            filter.organizationId === actor.organizationId ? { active: true } : null,
        };
      if (name === 'users')
        return {
          findOne: async (filter: { id: string }) => (filter.id === user.id ? user : null),
          updateOne: async (
            filter: { id: string; passwordHash?: string },
            update: { $set?: Record<string, unknown>; $inc?: { avatarVersion: number } },
          ) => {
            if (
              filter.id !== user.id ||
              (filter.passwordHash && filter.passwordHash !== user.passwordHash)
            )
              return { matchedCount: 0 };
            Object.assign(user, update.$set);
            if (update.$inc) user.avatarVersion += update.$inc.avatarVersion;
            return { matchedCount: 1 };
          },
        };
      if (name === 'authRateLimits') return { findOneAndUpdate: async () => ({ attempts: 1 }) };
      if (name === 'sessions')
        return {
          updateMany: async () => {
            sessions[0].revokedAt = new Date();
            return { modifiedCount: 1 };
          },
        };
      if (name === 'auditEvents')
        return {
          insertOne: async (event: { action: string }) => {
            events.push(event);
            return { acknowledged: true };
          },
        };
      throw new Error(`Unexpected synthetic collection: ${name}`);
    },
  };
  return {
    repository: new MongoAccountProfileRepository(database as unknown as Db),
    user,
    events,
    sessions,
  };
}

describe('MongoDB own-profile boundary', () => {
  it('denies a foreign organization and saves a name only for the active owner', async () => {
    const { repository, events } = await fixture();
    await expect(
      repository.get({ ...actor, organizationId: 'foreign-org' }),
    ).rejects.toBeInstanceOf(ProfileUnavailableError);
    expect((await repository.rename(actor, 'Synthetic Updated')).displayName).toBe(
      'Synthetic Updated',
    );
    expect(events.map((entry) => entry.action)).toContain('ACCOUNT_PROFILE_NAME_UPDATED');
  });

  it('stores the avatar, changes the password and revokes sessions with audit evidence', async () => {
    const { repository, user, events, sessions } = await fixture();
    await repository.saveAvatar(actor, {
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'image/webp',
    });
    expect((await repository.avatar(actor))?.bytes).toEqual(Buffer.from([1, 2, 3]));
    await repository.changePassword(actor, 'synthetic-old-password', 'synthetic-new-password');
    expect(await passwordMatches('synthetic-new-password', user.passwordHash)).toBe(true);
    expect(sessions[0].revokedAt).toBeInstanceOf(Date);
    expect(events.map((entry) => entry.action)).toEqual([
      'ACCOUNT_PROFILE_AVATAR_UPDATED',
      'ACCOUNT_PASSWORD_CHANGED',
    ]);
  });
});
