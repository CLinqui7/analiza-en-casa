import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { filesystemPrivateStorage } from './filesystem-storage';
import { configuredPrivateStorage } from './postgres-files';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function storageRoot() {
  const root = await mkdtemp(join(tmpdir(), 'analiza-private-'));
  roots.push(root);
  return root;
}

describe('filesystem private storage', () => {
  it('uploads exact bytes, preserves SHA256 and survives a new storage instance', async () => {
    const root = await storageRoot();
    const key = 'private/org-a/550e8400-e29b-41d4-a716-446655440000';
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    await filesystemPrivateStorage({ ANALIZA_FILES_PATH: root }).putObject({
      storageKey: key,
      bytes,
    });
    const restarted = filesystemPrivateStorage({ ANALIZA_FILES_PATH: root });
    const downloaded = await restarted.getObject(key);
    expect(downloaded).toEqual(bytes);
    expect(createHash('sha256').update(downloaded!).digest('hex')).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
    expect(new Uint8Array(await readFile(join(root, ...key.split('/'))))).toEqual(bytes);
  });

  it('returns null for an object that does not exist', async () => {
    const root = await storageRoot();
    await expect(
      filesystemPrivateStorage({ ANALIZA_FILES_PATH: root }).getObject(
        'private/org-a/550e8400-e29b-41d4-a716-446655440000',
      ),
    ).resolves.toBeNull();
  });

  it('rejects traversal, absolute keys and non-server key shapes', async () => {
    const root = await storageRoot();
    const storage = filesystemPrivateStorage({ ANALIZA_FILES_PATH: root });
    for (const storageKey of [
      '../outside',
      'private/../outside',
      'private/org-a/../../outside',
      '/private/org-a/file',
      'public/org-a/file',
    ])
      await expect(storage.putObject({ storageKey, bytes: new Uint8Array([1]) })).rejects.toThrow(
        'Storage key',
      );
  });

  it('refuses to place the private directory below the Next public tree', async () => {
    const storage = filesystemPrivateStorage({
      ANALIZA_FILES_PATH: join(process.cwd(), 'apps', 'web', 'public', 'private-files'),
    });
    await expect(
      storage.putObject({
        storageKey: 'private/org-a/550e8400-e29b-41d4-a716-446655440000',
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow('Next public');
  });

  it('requires explicit storage selection and retains GCS as an option', async () => {
    expect(() => configuredPrivateStorage({ ANALIZA_FILES_PATH: '/tmp/files' })).toThrow(
      'ANALIZA_FILE_STORAGE',
    );
    expect(
      configuredPrivateStorage({
        ANALIZA_FILE_STORAGE: 'filesystem',
        ANALIZA_FILES_PATH: '/tmp/files',
      }),
    ).toBeDefined();
    expect(
      configuredPrivateStorage({ ANALIZA_FILE_STORAGE: 'gcs', GCS_PRIVATE_BUCKET: 'private' }),
    ).toBeDefined();
  });
});
