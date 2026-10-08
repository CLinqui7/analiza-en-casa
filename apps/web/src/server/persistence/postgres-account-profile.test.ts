import { describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { hashPassword, passwordMatches } from '../auth-service';
import { InvalidCurrentPasswordError } from '../profile-errors';
import { PostgresAccountProfileRepository } from './postgres-account-profile';
import type { ServerActor } from '../validation/patients';

const actor: ServerActor = {
  userId: 'synthetic-user',
  organizationId: 'synthetic-org',
  role: 'NURSE',
};
const row = { email: 'synthetic@example.test', display_name: 'Synthetic Nurse', avatar_version: 1 };

function fakePool(passwordHash = '') {
  const queries: Array<{ sql: string; args: unknown[] }> = [];
  const client = {
    async query(sql: string, args: unknown[] = []) {
      queries.push({ sql, args });
      if (sql.includes('RETURNING attempts')) return { rows: [{ attempts: 1 }] };
      if (sql.includes('SELECT u.password_hash'))
        return { rows: [{ password_hash: passwordHash }] };
      if (sql.includes('RETURNING u.email_normalized')) return { rows: [row] };
      if (sql.includes('SELECT u.email_normalized')) return { rows: [row] };
      if (sql.includes('SELECT u.avatar_bytes'))
        return { rows: [{ avatar_bytes: null, avatar_mime: null }] };
      return { rows: [] };
    },
    release() {},
  };
  return { pool: { ...client, connect: async () => client } as unknown as Pool, queries };
}

describe('PostgreSQL own-profile boundary', () => {
  it('reads and renames only the authenticated active member, with audit evidence', async () => {
    const { pool, queries } = fakePool();
    const repository = new PostgresAccountProfileRepository(pool);
    expect(await repository.get(actor)).toEqual({
      email: row.email,
      displayName: row.display_name,
      avatarVersion: 1,
    });
    await repository.rename(actor, 'Synthetic Nurse');
    const update = queries.find(({ sql }) =>
      sql.includes('UPDATE analiza.users u SET display_name'),
    );
    expect(update?.sql).toContain('m.organization_id=$2 AND m.active');
    expect(update?.sql).toContain('m.user_id=u.id');
    expect(update?.args).toEqual([actor.userId, actor.organizationId, 'Synthetic Nurse']);
    expect(
      queries.some(
        ({ sql, args }) =>
          sql.includes('INSERT INTO analiza.audit_events') &&
          args.includes('ACCOUNT_PROFILE_NAME_UPDATED'),
      ),
    ).toBe(true);
  });

  it('rejects a wrong current password without replacing the hash or sessions', async () => {
    const { pool, queries } = fakePool(await hashPassword('synthetic-old-password'));
    await expect(
      new PostgresAccountProfileRepository(pool).changePassword(
        actor,
        'wrong',
        'synthetic-new-password',
      ),
    ).rejects.toBeInstanceOf(InvalidCurrentPasswordError);
    expect(queries.some(({ sql }) => sql.includes('UPDATE analiza.users SET password_hash'))).toBe(
      false,
    );
    expect(queries.some(({ sql }) => sql.includes('UPDATE analiza.sessions SET revoked_at'))).toBe(
      false,
    );
    expect(queries.some(({ sql }) => sql === 'ROLLBACK')).toBe(true);
  });

  it('replaces the hash, revokes all sessions and audits the successful change atomically', async () => {
    const { pool, queries } = fakePool(await hashPassword('synthetic-old-password'));
    await new PostgresAccountProfileRepository(pool).changePassword(
      actor,
      'synthetic-old-password',
      'synthetic-new-password',
    );
    const update = queries.find(({ sql }) =>
      sql.includes('UPDATE analiza.users SET password_hash'),
    );
    expect(update?.args[0]).toBe(actor.userId);
    expect(await passwordMatches('synthetic-new-password', String(update?.args[1]))).toBe(true);
    expect(queries.some(({ sql }) => sql.includes('UPDATE analiza.sessions SET revoked_at'))).toBe(
      true,
    );
    expect(
      queries.some(
        ({ sql, args }) =>
          sql.includes('INSERT INTO analiza.audit_events') &&
          args.includes('ACCOUNT_PASSWORD_CHANGED'),
      ),
    ).toBe(true);
    expect(queries.at(-1)?.sql).toBe('COMMIT');
  });
});
