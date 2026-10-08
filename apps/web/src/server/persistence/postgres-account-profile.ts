import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { hashPassword, passwordMatches } from '../auth-service';
import { postgresAuthStore } from './postgres-auth';
import { transaction } from './postgres-pool';
import type { ServerActor } from '../validation/patients';
import type { AccountAvatar, AccountProfile } from '@/lib/account-profile';
import { InvalidCurrentPasswordError, ProfileUnavailableError } from '../profile-errors';

type Row = { email: string; display_name: string; avatar_version: string | number };
const userWhere = `u.id=$1 AND m.organization_id=$2 AND m.active AND u.disabled_at IS NULL`;
const userJoin = `FROM analiza.users u JOIN analiza.memberships m ON m.user_id=u.id`;

function toProfile(row: Row): AccountProfile {
  return {
    email: row.email,
    displayName: row.display_name,
    avatarVersion: Number(row.avatar_version),
  };
}

async function audit(client: PoolClient, actor: ServerActor, action: string) {
  await client.query(
    `INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id)
     VALUES($1,$2,$3,$4,'users',$3)`,
    [actor.organizationId, randomUUID(), actor.userId, action],
  );
}

export class PostgresAccountProfileRepository {
  constructor(private readonly pool: Pool) {}

  async get(actor: ServerActor): Promise<AccountProfile> {
    return transaction(this.pool, actor, async (client) => {
      const result = await client.query<Row>(
        `SELECT u.email_normalized AS email,u.display_name,u.avatar_version ${userJoin} WHERE ${userWhere}`,
        [actor.userId, actor.organizationId],
      );
      if (!result.rows[0]) throw new ProfileUnavailableError();
      return toProfile(result.rows[0]);
    });
  }

  async rename(actor: ServerActor, displayName: string): Promise<AccountProfile> {
    return transaction(this.pool, actor, async (client) => {
      const result = await client.query<Row>(
        `UPDATE analiza.users u SET display_name=$3 FROM analiza.memberships m
         WHERE ${userWhere} AND m.user_id=u.id
         RETURNING u.email_normalized AS email,u.display_name,u.avatar_version`,
        [actor.userId, actor.organizationId, displayName],
      );
      if (!result.rows[0]) throw new ProfileUnavailableError();
      await audit(client, actor, 'ACCOUNT_PROFILE_NAME_UPDATED');
      return toProfile(result.rows[0]);
    });
  }

  async avatar(actor: ServerActor): Promise<AccountAvatar | null> {
    return transaction(this.pool, actor, async (client) => {
      const result = await client.query<{
        avatar_bytes: Buffer | null;
        avatar_mime: AccountAvatar['mimeType'] | null;
      }>(`SELECT u.avatar_bytes,u.avatar_mime ${userJoin} WHERE ${userWhere}`, [
        actor.userId,
        actor.organizationId,
      ]);
      if (!result.rows[0]) throw new ProfileUnavailableError();
      const row = result.rows[0];
      return row.avatar_bytes && row.avatar_mime
        ? { bytes: row.avatar_bytes, mimeType: row.avatar_mime }
        : null;
    });
  }

  async saveAvatar(actor: ServerActor, avatar: AccountAvatar): Promise<AccountProfile> {
    return transaction(this.pool, actor, async (client) => {
      const result = await client.query<Row>(
        `UPDATE analiza.users u SET avatar_bytes=$3,avatar_mime=$4,avatar_version=avatar_version+1
         FROM analiza.memberships m WHERE ${userWhere} AND m.user_id=u.id
         RETURNING u.email_normalized AS email,u.display_name,u.avatar_version`,
        [actor.userId, actor.organizationId, Buffer.from(avatar.bytes), avatar.mimeType],
      );
      if (!result.rows[0]) throw new ProfileUnavailableError();
      await audit(client, actor, 'ACCOUNT_PROFILE_AVATAR_UPDATED');
      return toProfile(result.rows[0]);
    });
  }

  async changePassword(
    actor: ServerActor,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const rateKey = createHash('sha256').update(`profile-password:${actor.userId}`).digest('hex');
    if (
      !(await postgresAuthStore(this.pool).consumeLoginAttempt(
        rateKey,
        new Date(),
        5,
        15 * 60 * 1000,
      ))
    )
      throw new InvalidCurrentPasswordError();
    await transaction(this.pool, actor, async (client) => {
      const result = await client.query<{ password_hash: string }>(
        `SELECT u.password_hash ${userJoin} WHERE ${userWhere} FOR UPDATE OF u`,
        [actor.userId, actor.organizationId],
      );
      if (!result.rows[0]) throw new ProfileUnavailableError();
      if (!(await passwordMatches(currentPassword, result.rows[0].password_hash)))
        throw new InvalidCurrentPasswordError();
      await client.query('UPDATE analiza.users SET password_hash=$2 WHERE id=$1', [
        actor.userId,
        await hashPassword(newPassword),
      ]);
      await client.query(
        'UPDATE analiza.sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',
        [actor.userId],
      );
      await audit(client, actor, 'ACCOUNT_PASSWORD_CHANGED');
    });
  }
}
