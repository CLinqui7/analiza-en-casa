import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { emptyNurseProfile, nurseProfileSchema, type NurseProfile } from '@/lib/nurse-profile';
import { MongoConflictError, MongoInputError, type ServerActor } from '../validation/patients';
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
