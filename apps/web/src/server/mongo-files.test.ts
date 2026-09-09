import { describe, expect, it, vi } from 'vitest';
import { MongoAccessError, MongoInputError, type ServerActor } from './mongo-patients';
import { MongoFileRepository } from './mongo-files';

const userA: ServerActor = { userId: 'user-a', organizationId: 'org-a', role: 'ADMIN' };
const userB: ServerActor = { userId: 'user-b', organizationId: 'org-a', role: 'ADMIN' };
const userC: ServerActor = { userId: 'user-c', organizationId: 'org-c', role: 'ADMIN' };
const nurse: ServerActor = { userId: 'nurse-a', organizationId: 'org-a', role: 'NURSE' };
const upload = {
  ownerType: 'hospitalization' as const,
  ownerId: 'hospitalization-synthetic-1',
  name: 'orden-sintetica.pdf',
  mimeType: 'application/pdf',
  bytes: new Uint8Array([1, 2, 3]),
};

function repository() {
  let row: Record<string, unknown> | null = null;
  const objects = new Map<string, Uint8Array>();
  const files = {
    insertOne: vi.fn(async (document) => {
      row = document;
      return { acknowledged: true };
    }),
    findOne: vi.fn(async (filter: Record<string, unknown>) =>
      filter.organizationId === 'org-a' ? row : null,
    ),
    find: vi.fn((filter: Record<string, unknown>) => ({
      sort: vi.fn(() => ({
        toArray: vi.fn(async () =>
          filter.organizationId === 'org-a' && row ? [row] : [],
        ),
      })),
    })),
  };
  const storage = {
    putObject: vi.fn(async ({ storageKey, bytes }) => void objects.set(storageKey, bytes)),
    getObject: vi.fn(async (storageKey) => objects.get(storageKey) ?? null),
  };
  const owners = { exists: vi.fn(async () => true) };
  const auditEvents = { insertOne: vi.fn(async () => ({ acknowledged: true })) };
  return {
    repository: new MongoFileRepository(files as never, storage, owners, auditEvents),
    storage,
    owners,
    auditEvents,
    objects,
  };
}

describe('Mongo private file repository', () => {
  // test-id: vitest:e02-private-file-bytes-metadata-download
  it('stores bytes separately, generates the private key server-side, and returns verified bytes only to its tenant', async () => {
    const { repository: files, storage, auditEvents } = repository();
    const metadata = await files.upload(userA, upload, new Date('2026-09-09T00:00:00.000Z'));
    expect(metadata).toMatchObject({
      ownerType: 'hospitalization',
      ownerId: upload.ownerId,
      name: upload.name,
      size: 3,
      sha256: '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
    });
    expect(metadata).not.toHaveProperty('storageKey');
    expect(storage.putObject).toHaveBeenCalledWith({
      storageKey: `private/org-a/${metadata.id}`,
      bytes: upload.bytes,
    });
    await expect(files.download(userB, metadata.id)).resolves.toEqual({
      metadata,
      bytes: upload.bytes,
    });
    await expect(files.listForOwner(userB, upload.ownerType, upload.ownerId)).resolves.toEqual([
      metadata,
    ]);
    await expect(files.download(userC, metadata.id)).resolves.toBeNull();
    expect(auditEvents.insertOne).toHaveBeenCalledTimes(2);
  });

  // test-id: vitest:e02-private-file-owner-permission-and-integrity
  it('requires the owner permission, a same-tenant owner, and byte integrity before any download', async () => {
    const { repository: files, owners, objects } = repository();
    await expect(files.upload(nurse, upload)).rejects.toBeInstanceOf(MongoAccessError);
    owners.exists.mockResolvedValueOnce(false);
    await expect(files.upload(userA, upload)).rejects.toBeInstanceOf(MongoInputError);
    const metadata = await files.upload(userA, upload);
    objects.set(`private/org-a/${metadata.id}`, new Uint8Array([9, 9, 9]));
    await expect(files.download(userA, metadata.id)).resolves.toBeNull();
  });
});
