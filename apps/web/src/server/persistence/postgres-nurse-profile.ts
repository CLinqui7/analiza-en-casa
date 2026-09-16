import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import {
  emptyNurseProfile,
  nurseProfileSchema,
  type NurseProfile,
  type NurseProfileSubmission,
} from '@/lib/nurse-profile';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
  type ServerActor,
} from '../validation/patients';
import { transaction } from './postgres-pool';

export class PostgresNurseProfileRepository {
  constructor(private readonly pool: Pool) {}

  async get(actor: ServerActor): Promise<NurseProfile> {
    return transaction(this.pool, actor, async (client) => {
      const row = (
        await client.query(
          'SELECT body,version FROM analiza.nurse_profiles WHERE organization_id=$1 AND user_id=$2',
          [actor.organizationId, actor.userId],
        )
      ).rows[0];
      return row
        ? nurseProfileSchema.parse({ ...row.body, expectedVersion: row.version })
        : emptyNurseProfile();
    });
  }

  async listForAdmin(actor: ServerActor): Promise<NurseProfileSubmission[]> {
    if (actor.role !== 'ADMIN') throw new MongoAccessError();
    return transaction(this.pool, actor, async (client) =>
      (
        await client.query(
          `SELECT profile.user_id,profile.body,profile.version,profile.updated_at,
          account.email_normalized,account.display_name
          FROM analiza.nurse_profiles profile
          JOIN analiza.users account ON account.id=profile.user_id
          WHERE profile.organization_id=$1
          ORDER BY profile.updated_at DESC`,
          [actor.organizationId],
        )
      ).rows.map((row) => ({
        ...nurseProfileSchema.parse({ ...row.body, expectedVersion: row.version }),
        userId: row.user_id,
        accountEmail: row.email_normalized,
        accountName: row.display_name || row.email_normalized,
        updatedAt: new Date(row.updated_at).toISOString(),
      })),
    );
  }

  async save(actor: ServerActor, input: unknown): Promise<NurseProfile> {
    const parsed = nurseProfileSchema.safeParse(input);
    if (!parsed.success) throw new MongoInputError('Revisa los datos del perfil de enfermería.');
    const data = parsed.data;
    const body = { ...data, expectedVersion: 0 };
    const nextVersion = await transaction(this.pool, actor, async (client) => {
      const current = (
        await client.query(
          'SELECT version FROM analiza.nurse_profiles WHERE organization_id=$1 AND user_id=$2 FOR UPDATE',
          [actor.organizationId, actor.userId],
        )
      ).rows[0];
      if (!current) {
        if (data.expectedVersion !== 0) throw new MongoConflictError();
        await client.query(
          'INSERT INTO analiza.nurse_profiles(organization_id,user_id,body,version) VALUES($1,$2,$3::jsonb,1)',
          [actor.organizationId, actor.userId, JSON.stringify(body)],
        );
      } else {
        if (current.version !== data.expectedVersion) throw new MongoConflictError();
        await client.query(
          'UPDATE analiza.nurse_profiles SET body=$3::jsonb,version=version+1,updated_at=now() WHERE organization_id=$1 AND user_id=$2',
          [actor.organizationId, actor.userId, JSON.stringify(body)],
        );
      }
      await client.query(
        'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
        [
          actor.organizationId,
          randomUUID(),
          actor.userId,
          'nurse.profile.saved',
          'nurse_profiles',
          actor.userId,
        ],
      );
      return (current?.version ?? 0) + 1;
    });
    return { ...data, expectedVersion: nextVersion };
  }
}
