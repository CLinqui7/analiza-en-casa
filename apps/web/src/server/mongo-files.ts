import { createHash, randomUUID } from 'node:crypto';
import { can, type Permission } from '@/lib/permissions';
import { MongoAccessError, MongoInputError, type ServerActor } from './mongo-patients';

import {
  ownerTypeSchema,
  fileMetadataSchema,
  parseUpload,
  type FileMetadata,
  type FileOwnerType,
  type PrivateFileUpload,
  type PrivateFileStorage,
} from './validation/files';
export {
  MAX_PRIVATE_FILE_BYTES,
  type FileMetadata,
  type FileOwnerType,
  type PrivateFileUpload,
  type PrivateFileStorage,
} from './validation/files';

type StoredFileMetadata = FileMetadata & {
  organizationId: string;
  storageKey: string;
  createdBy: string;
  createdAt: Date;
};
type FileMetadataCollection = {
  insertOne(document: StoredFileMetadata): Promise<unknown>;
  findOne(filter: Record<string, unknown>): Promise<StoredFileMetadata | null>;
  find(filter: Record<string, unknown>): {
    sort(value: Record<string, number>): { toArray(): Promise<StoredFileMetadata[]> };
  };
};
type OwnerCollection = {
  findOne(filter: Record<string, unknown>): Promise<Record<string, unknown> | null>;
};
type FileAuditCollection = { insertOne(document: Record<string, unknown>): Promise<unknown> };

export type FileOwnerLookup = {
  exists(actor: ServerActor, ownerType: FileOwnerType, ownerId: string): Promise<boolean>;
};

const ownerPermissions: Record<FileOwnerType, { read: Permission; write: Permission }> = {
  patient: { read: 'patients:read', write: 'patients:write' },
  doctor: { read: 'settings:write', write: 'settings:write' },
  hospitalization: { read: 'cases:read', write: 'cases:write' },
  nursing_resource: { read: 'nurses:manage', write: 'nurses:manage' },
};

function ownerPermission(ownerType: FileOwnerType, action: 'read' | 'write') {
  return ownerPermissions[ownerType][action];
}

function publicMetadata(file: StoredFileMetadata): FileMetadata {
  return fileMetadataSchema.parse({
    id: file.id,
    ownerType: file.ownerType,
    ownerId: file.ownerId,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    sha256: file.sha256,
  });
}

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

function auditEvent(
  actor: ServerActor,
  action: 'FILE_UPLOADED' | 'FILE_DOWNLOADED',
  file: FileMetadata,
  occurredAt: Date,
) {
  return {
    id: randomUUID(),
    organizationId: actor.organizationId,
    actorUserId: actor.userId,
    action,
    resourceType: 'fileMetadata',
    resourceId: file.id,
    ownerType: file.ownerType,
    ownerId: file.ownerId,
    occurredAt,
  };
}

/**
 * Server-side attachment boundary. Metadata is tenant-scoped, bytes are stored separately, and
 * both upload and download re-resolve the session actor. This deliberately has no localStorage or
 * browser metadata-registration fallback.
 */
export class MongoFileRepository {
  constructor(
    private readonly files: FileMetadataCollection,
    private readonly storage: PrivateFileStorage,
    private readonly owners: FileOwnerLookup,
    private readonly auditEvents: FileAuditCollection,
  ) {}

  async upload(
    actor: ServerActor,
    input: PrivateFileUpload,
    now = new Date(),
  ): Promise<FileMetadata> {
    const upload = parseUpload(input);
    if (!can(actor.role, ownerPermission(upload.ownerType, 'write'))) throw new MongoAccessError();
    if (!(await this.owners.exists(actor, upload.ownerType, upload.ownerId))) {
      throw new MongoInputError('El registro asociado no está disponible.');
    }
    const id = randomUUID();
    const metadata: StoredFileMetadata = {
      id,
      ownerType: upload.ownerType,
      ownerId: upload.ownerId,
      name: upload.name,
      mimeType: upload.mimeType,
      size: upload.bytes.byteLength,
      sha256: sha256(upload.bytes),
      organizationId: actor.organizationId,
      storageKey: `private/${actor.organizationId}/${id}`,
      createdBy: actor.userId,
      createdAt: now,
    };
    await this.storage.putObject({ storageKey: metadata.storageKey, bytes: upload.bytes });
    await this.files.insertOne(metadata);
    const file = publicMetadata(metadata);
    await this.auditEvents.insertOne(auditEvent(actor, 'FILE_UPLOADED', file, now));
    return file;
  }

  /** Lists only metadata for one authorized owner; private object keys never leave the server. */
  async listForOwner(
    actor: ServerActor,
    ownerType: FileOwnerType,
    ownerId: string,
  ): Promise<FileMetadata[]> {
    const parsedOwner = ownerTypeSchema.safeParse(ownerType);
    if (!parsedOwner.success || !ownerId.trim()) throw new MongoInputError();
    if (!can(actor.role, ownerPermission(parsedOwner.data, 'read'))) throw new MongoAccessError();
    if (!(await this.owners.exists(actor, parsedOwner.data, ownerId))) return [];
    const rows = await this.files
      .find({ organizationId: actor.organizationId, ownerType: parsedOwner.data, ownerId })
      .sort({ createdAt: -1 })
      .toArray();
    return rows.map(publicMetadata);
  }

  /** A foreign tenant has the same null result as an unknown file; bytes are accessed afterwards. */
  async download(
    actor: ServerActor,
    id: string,
    now = new Date(),
  ): Promise<{ metadata: FileMetadata; bytes: Uint8Array } | null> {
    const file = await this.files.findOne({ id, organizationId: actor.organizationId });
    if (!file) return null;
    if (!can(actor.role, ownerPermission(file.ownerType, 'read'))) throw new MongoAccessError();
    const bytes = await this.storage.getObject(file.storageKey);
    if (!bytes || bytes.byteLength !== file.size || sha256(bytes) !== file.sha256) return null;
    const metadata = publicMetadata(file);
    await this.auditEvents.insertOne(auditEvent(actor, 'FILE_DOWNLOADED', metadata, now));
    return { metadata, bytes };
  }
}

/** Mongo adapter for owner existence checks. Tenant scope is always supplied by the actor. */
export function mongoFileOwnerLookup(database: {
  collection(
    name: 'patients' | 'doctors' | 'hospitalizations' | 'nursingResources',
  ): OwnerCollection;
}): FileOwnerLookup {
  return {
    async exists(actor, ownerType, ownerId) {
      const collection = database.collection(
        ownerType === 'patient'
          ? 'patients'
          : ownerType === 'doctor'
            ? 'doctors'
            : ownerType === 'hospitalization'
              ? 'hospitalizations'
              : 'nursingResources',
      );
      return Boolean(
        await collection.findOne({ id: ownerId, organizationId: actor.organizationId }),
      );
    },
  };
}

export const mongoFileMetadataIndexes = [
  {
    collection: 'fileMetadata',
    key: { organizationId: 1, id: 1 },
    name: 'file_metadata_org_id_unique',
    unique: true,
  },
  {
    collection: 'fileMetadata',
    key: { organizationId: 1, ownerType: 1, ownerId: 1 },
    name: 'file_metadata_org_owner',
  },
] as const;
