import { createHash, randomUUID } from 'node:crypto';
import { Binary, type Db } from 'mongodb';
import type { AccountAvatar, AccountProfile } from '@/lib/account-profile';
import { hashPassword, passwordMatches } from './auth-service';
import { mongoAuthStore } from './mongo-auth';
import { InvalidCurrentPasswordError, ProfileUnavailableError } from './profile-errors';
import type { ServerActor } from './validation/patients';

type User = {
  id: string;
  emailNormalized: string;
  displayName?: string;
  passwordHash: string;
  disabledAt?: Date;
  avatarBytes?: Uint8Array | Binary;
  avatarMime?: AccountAvatar['mimeType'];
  avatarVersion?: number;
};

export class MongoAccountProfileRepository {
  constructor(private readonly database: Db) {}

  private async user(actor: ServerActor): Promise<User> {
    const membership = await this.database.collection('memberships').findOne({
      userId: actor.userId,
      organizationId: actor.organizationId,
      active: true,
    });
    if (!membership) throw new ProfileUnavailableError();
    const user = await this.database.collection<User>('users').findOne({ id: actor.userId });
    if (!user || user.disabledAt) throw new ProfileUnavailableError();
    return user;
  }

  private profile(user: User): AccountProfile {
    return {
      email: user.emailNormalized,
      displayName: user.displayName ?? '',
      avatarVersion: user.avatarVersion ?? 0,
    };
  }

  async get(actor: ServerActor) {
    return this.profile(await this.user(actor));
  }

  async rename(actor: ServerActor, displayName: string) {
    await this.user(actor);
    const transaction = this.database.client.startSession();
    try {
      await transaction.withTransaction(async () => {
        const result = await this.database
          .collection('users')
          .updateOne(
            { id: actor.userId, disabledAt: { $exists: false } },
            { $set: { displayName } },
            { session: transaction },
          );
        if (!result.matchedCount) throw new ProfileUnavailableError();
        await this.audit(actor, 'ACCOUNT_PROFILE_NAME_UPDATED', transaction);
      });
    } finally {
      await transaction.endSession();
    }
    return this.get(actor);
  }

  async avatar(actor: ServerActor): Promise<AccountAvatar | null> {
    const user = await this.user(actor);
    return user.avatarBytes && user.avatarMime
      ? {
          bytes: user.avatarBytes instanceof Binary ? user.avatarBytes.value() : user.avatarBytes,
          mimeType: user.avatarMime,
        }
      : null;
  }

  async saveAvatar(actor: ServerActor, avatar: AccountAvatar) {
    await this.user(actor);
    const transaction = this.database.client.startSession();
    try {
      await transaction.withTransaction(async () => {
        const result = await this.database.collection('users').updateOne(
          { id: actor.userId, disabledAt: { $exists: false } },
          {
            $set: { avatarBytes: Buffer.from(avatar.bytes), avatarMime: avatar.mimeType },
            $inc: { avatarVersion: 1 },
          },
          { session: transaction },
        );
        if (!result.matchedCount) throw new ProfileUnavailableError();
        await this.audit(actor, 'ACCOUNT_PROFILE_AVATAR_UPDATED', transaction);
      });
    } finally {
      await transaction.endSession();
    }
    return this.get(actor);
  }

  async changePassword(actor: ServerActor, currentPassword: string, newPassword: string) {
    const rateKey = createHash('sha256').update(`profile-password:${actor.userId}`).digest('hex');
    if (
      !(await mongoAuthStore(this.database).consumeLoginAttempt(
        rateKey,
        new Date(),
        5,
        15 * 60 * 1000,
      ))
    )
      throw new InvalidCurrentPasswordError();
    const transaction = this.database.client.startSession();
    try {
      await transaction.withTransaction(async () => {
        const user = await this.user(actor);
        if (!(await passwordMatches(currentPassword, user.passwordHash)))
          throw new InvalidCurrentPasswordError();
        const result = await this.database
          .collection('users')
          .updateOne(
            { id: actor.userId, passwordHash: user.passwordHash, disabledAt: { $exists: false } },
            { $set: { passwordHash: await hashPassword(newPassword) } },
            { session: transaction },
          );
        if (!result.matchedCount) throw new InvalidCurrentPasswordError();
        await this.database
          .collection('sessions')
          .updateMany(
            { userId: actor.userId, revokedAt: { $exists: false } },
            { $set: { revokedAt: new Date() } },
            { session: transaction },
          );
        await this.audit(actor, 'ACCOUNT_PASSWORD_CHANGED', transaction);
      });
    } finally {
      await transaction.endSession();
    }
  }

  private async audit(
    actor: ServerActor,
    action: string,
    session: ReturnType<Db['client']['startSession']>,
  ) {
    await this.database.collection('auditEvents').insertOne(
      {
        id: randomUUID(),
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action,
        resourceType: 'users',
        resourceId: actor.userId,
        occurredAt: new Date(),
      },
      { session },
    );
  }
}
