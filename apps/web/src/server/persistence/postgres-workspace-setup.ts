import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { can } from '@/lib/permissions';
import {
  emptyWorkspaceSetup,
  workspaceSetupSchema,
  organizationProfileSchema,
  staffProfileSchema,
  serviceProfileSchema,
  type WorkspaceSetup,
} from '@/lib/workspace-setup';
import {
  MongoAccessError,
  MongoConflictError,
  MongoInputError,
  type ServerActor,
} from '../validation/patients';
import { transaction } from './postgres-pool';

function authorize(actor: ServerActor) {
  if (!can(actor.role, 'settings:write')) throw new MongoAccessError();
}

export class PostgresWorkspaceSetupRepository {
  constructor(private readonly pool: Pool) {}

  async get(actor: ServerActor): Promise<WorkspaceSetup> {
    authorize(actor);
    return transaction(this.pool, actor, async (client) => {
      // A single statement gives profile and directories the same MVCC snapshot.
      const profile = (
        await client.query(
          `SELECT p.profile,coalesce(p.version,0) AS version,
        coalesce((SELECT jsonb_agg(body ORDER BY created_at,id) FROM analiza.organization_staff WHERE organization_id=$1),'[]'::jsonb) AS staff,
        coalesce((SELECT jsonb_agg(body ORDER BY created_at,id) FROM analiza.organization_services WHERE organization_id=$1),'[]'::jsonb) AS services
        FROM analiza.organizations o LEFT JOIN analiza.workspace_profiles p ON p.organization_id=o.id WHERE o.id=$1`,
          [actor.organizationId],
        )
      ).rows[0];
      return {
        expectedVersion: profile?.version ?? 0,
        organization: profile?.profile
          ? organizationProfileSchema.parse(profile.profile)
          : emptyWorkspaceSetup().organization,
        staff: (profile?.staff ?? []).map((body: unknown) => staffProfileSchema.parse(body)),
        services: (profile?.services ?? []).map((body: unknown) =>
          serviceProfileSchema.parse(body),
        ),
      };
    });
  }

  async save(actor: ServerActor, input: unknown): Promise<WorkspaceSetup> {
    authorize(actor);
    const parsed = workspaceSetupSchema.safeParse(input);
    if (!parsed.success)
      throw new MongoInputError('Revisa los datos de organización, personal y servicios.');
    const data = parsed.data;
    await transaction(this.pool, actor, async (client) => {
      // Existing Core organizations lazily obtain an empty profile, without changing their data.
      await client.query(
        'INSERT INTO analiza.workspace_profiles(organization_id) VALUES($1) ON CONFLICT DO NOTHING',
        [actor.organizationId],
      );
      const updated = await client.query(
        'UPDATE analiza.workspace_profiles SET profile=$2::jsonb,version=version+1,updated_at=now() WHERE organization_id=$1 AND version=$3 RETURNING version',
        [actor.organizationId, JSON.stringify(data.organization), data.expectedVersion],
      );
      if (updated.rowCount !== 1) throw new MongoConflictError();
      for (const [table, entries] of [
        ['analiza.organization_staff', data.staff],
        ['analiza.organization_services', data.services],
      ] as const) {
        const existing = (
          await client.query(`SELECT id FROM ${table} WHERE organization_id=$1`, [
            actor.organizationId,
          ])
        ).rows;
        if (existing.some((row) => !entries.some((entry) => entry.id === row.id)))
          throw new MongoInputError(
            'Conserva las fichas guardadas; puedes desactivarlas cuando no se utilicen.',
          );
        for (const entry of entries)
          await client.query(
            `INSERT INTO ${table}(organization_id,id,body) VALUES($1,$2,$3::jsonb) ON CONFLICT(organization_id,id) DO UPDATE SET body=EXCLUDED.body,updated_at=now()`,
            [actor.organizationId, entry.id, JSON.stringify(entry)],
          );
      }
      await client.query(
        'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
        [
          actor.organizationId,
          randomUUID(),
          actor.userId,
          'workspace.setup.saved',
          'workspace_profiles',
          actor.organizationId,
        ],
      );
    });
    return { ...data, expectedVersion: data.expectedVersion + 1 };
  }
}
