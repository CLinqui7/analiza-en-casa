import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { Permission } from '@/lib/permissions';
import { can } from '@/lib/permissions';
import {
  parseUpload,
  type FileOwnerType,
  type FileMetadata,
  type PrivateFileStorage,
} from '../validation/files';
import { MongoAccessError, MongoInputError, type ServerActor } from '../validation/patients';
import type { Persistence } from './contracts';
import { transaction } from './postgres-pool';
import { googlePrivateStorage } from './gcs-storage';
import { filesystemPrivateStorage } from './filesystem-storage';

export function configuredPrivateStorage(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PrivateFileStorage {
  if (env.ANALIZA_FILE_STORAGE === 'gcs') return googlePrivateStorage(env as NodeJS.ProcessEnv);
  if (env.ANALIZA_FILE_STORAGE === 'filesystem') return filesystemPrivateStorage(env);
  throw new Error('ANALIZA_FILE_STORAGE debe ser gcs o filesystem.');
}

const owners = {
  patient: { table: 'analiza.patients', read: 'patients:read', write: 'patients:write' },
  doctor: { table: 'analiza.doctors', read: 'settings:write', write: 'settings:write' },
  hospitalization: { table: 'analiza.hospitalizations', read: 'cases:read', write: 'cases:write' },
} as const;
async function ownerAccess(
  c: PoolClient,
  actor: ServerActor,
  kind: FileOwnerType,
  id: string,
  action: 'read' | 'write',
) {
  const owner = Object.hasOwn(owners, kind) ? owners[kind] : null;
  if (!owner || !id.trim()) throw new MongoInputError();
  if (!can(actor.role, owner[action] as Permission)) throw new MongoAccessError();
  return Boolean(
    (
      await c.query(`SELECT id FROM ${owner.table} WHERE organization_id=$1 AND id=$2`, [
        actor.organizationId,
        id,
      ])
    ).rowCount,
  );
}
type FileRow = {
  id: string;
  owner_type: FileOwnerType;
  owner_id: string;
  name: string;
  mime_type: string;
  size: string;
  sha256: string;
  storage_key: string;
};
const metadata = (r: FileRow): FileMetadata => ({
  id: r.id,
  ownerType: r.owner_type,
  ownerId: r.owner_id,
  name: r.name,
  mimeType: r.mime_type,
  size: Number(r.size),
  sha256: r.sha256,
});
const digest = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
async function fileAudit(c: PoolClient, a: ServerActor, action: string, id: string) {
  await c.query(
    "INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,'file_metadata',$5)",
    [a.organizationId, randomUUID(), a.userId, action, id],
  );
}
export function postgresFiles(
  pool: Pool,
  storageFactory: () => PrivateFileStorage = configuredPrivateStorage,
): Persistence['files'] {
  return {
    async listForOwner(actor, kind, id) {
      return transaction(pool, actor, async (c) => {
        if (!(await ownerAccess(c, actor, kind, id, 'read'))) return [];
        return (
          await c.query<FileRow>(
            'SELECT * FROM analiza.file_metadata WHERE organization_id=$1 AND owner_type=$2 AND owner_id=$3 ORDER BY created_at',
            [actor.organizationId, kind, id],
          )
        ).rows.map(metadata);
      });
    },
    async upload(actor, rawInput) {
      const input = parseUpload(rawInput);
      await transaction(pool, actor, async (c) => {
        if (!(await ownerAccess(c, actor, input.ownerType, input.ownerId, 'write')))
          throw new MongoInputError('El registro asociado no está disponible.');
      });
      // Never hold a SQL connection during a remote upload. Re-authorize before committing metadata.
      const id = randomUUID(),
        key = `private/${actor.organizationId}/${id}`,
        sha = digest(input.bytes);
      await storageFactory().putObject({ storageKey: key, bytes: input.bytes });
      return transaction(pool, actor, async (c) => {
        if (!(await ownerAccess(c, actor, input.ownerType, input.ownerId, 'write')))
          throw new MongoInputError('El registro asociado no está disponible.');
        const row = (
          await c.query<FileRow>(
            'INSERT INTO analiza.file_metadata(organization_id,id,owner_type,owner_id,storage_key,name,mime_type,size,sha256,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
            [
              actor.organizationId,
              id,
              input.ownerType,
              input.ownerId,
              key,
              input.name,
              input.mimeType,
              input.bytes.length,
              sha,
              actor.userId,
            ],
          )
        ).rows[0];
        await fileAudit(c, actor, 'FILE_UPLOADED', id);
        return metadata(row);
      });
    },
    async download(actor, id) {
      const row = await transaction(pool, actor, async (c) => {
        const row = (
          await c.query<FileRow>(
            'SELECT * FROM analiza.file_metadata WHERE organization_id=$1 AND id=$2',
            [actor.organizationId, id],
          )
        ).rows[0];
        if (!row || !(await ownerAccess(c, actor, row.owner_type, row.owner_id, 'read')))
          return null;
        return row;
      });
      if (!row) return null;
      const bytes = await storageFactory().getObject(row.storage_key);
      if (!bytes || bytes.length !== Number(row.size) || digest(bytes) !== row.sha256) return null;
      return transaction(pool, actor, async (c) => {
        if (!(await ownerAccess(c, actor, row.owner_type, row.owner_id, 'read'))) return null;
        await fileAudit(c, actor, 'FILE_DOWNLOADED', id);
        return { metadata: metadata(row), bytes };
      });
    },
  };
}
