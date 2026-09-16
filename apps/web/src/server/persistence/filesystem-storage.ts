import { constants } from 'node:fs';
import { chmod, lstat, link, mkdir, open, realpath, unlink } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PrivateFileStorage } from '../validation/files';

const safeSegment = /^[a-zA-Z0-9_-]{1,128}$/;

function storageSegments(storageKey: string): [string, string, string] {
  const segments = storageKey.split('/');
  if (
    segments.length !== 3 ||
    segments[0] !== 'private' ||
    !safeSegment.test(segments[1]) ||
    !safeSegment.test(segments[2])
  )
    throw new Error('Storage key privado inválido.');
  return segments as [string, string, string];
}

function inside(root: string, candidate: string) {
  return candidate.startsWith(root + sep);
}

async function secureRoot(configuredPath: string): Promise<string> {
  if (!isAbsolute(configuredPath)) throw new Error('ANALIZA_FILES_PATH debe ser absoluto.');
  const publicRoot = resolve(process.cwd(), 'apps/web/public');
  const requested = resolve(configuredPath);
  if (requested === publicRoot || inside(publicRoot, requested))
    throw new Error('Los archivos privados no pueden estar bajo Next public.');
  await mkdir(configuredPath, { recursive: true, mode: 0o700 });
  const info = await lstat(configuredPath);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error('El directorio privado no puede ser un symlink.');
  await chmod(configuredPath, 0o700);
  const canonical = await realpath(configuredPath);
  const canonicalPublic = await realpath(publicRoot).catch(() => publicRoot);
  if (canonical === canonicalPublic || inside(canonicalPublic, canonical))
    throw new Error('Los archivos privados no pueden estar bajo Next public.');
  return canonical;
}

async function secureDirectory(root: string, segments: string[], create: boolean) {
  let current = root;
  for (const segment of segments) {
    current = join(current, segment);
    try {
      if (create) await mkdir(current, { mode: 0o700 });
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST'))
        throw error;
    }
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (
        !create &&
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return null;
      throw error;
    }
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error('La ruta privada contiene un symlink.');
    const canonical = await realpath(current);
    if (!inside(root, canonical))
      throw new Error('La ruta privada escapa del directorio autorizado.');
    current = canonical;
  }
  return current;
}

/** Local private storage. Only server-generated keys are accepted and no path is browser-controlled. */
export function filesystemPrivateStorage(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PrivateFileStorage {
  const configuredPath = env.ANALIZA_FILES_PATH;
  if (!configuredPath) throw new Error('Falta ANALIZA_FILES_PATH para archivos privados.');
  return {
    async putObject({ storageKey, bytes }) {
      const [namespace, organization, id] = storageSegments(storageKey);
      const root = await secureRoot(configuredPath);
      const directory = await secureDirectory(root, [namespace, organization], true);
      if (!directory) throw new Error('No se pudo crear el directorio privado.');
      const target = resolve(directory, id);
      if (!inside(root, target))
        throw new Error('La ruta privada escapa del directorio autorizado.');
      const temporary = join(directory, `.${id}.${randomUUID()}.tmp`);
      const noFollow = constants.O_NOFOLLOW ?? 0;
      const handle = await open(
        /* turbopackIgnore: true */
        temporary,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow,
        0o600,
      );
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        // A hard link publishes atomically and, unlike rename(), never overwrites an existing key.
        await link(temporary, target);
      } finally {
        await unlink(temporary).catch(() => undefined);
      }
    },
    async getObject(storageKey) {
      const [namespace, organization, id] = storageSegments(storageKey);
      const root = await secureRoot(configuredPath);
      const directory = await secureDirectory(root, [namespace, organization], false);
      if (!directory) return null;
      const target = resolve(directory, id);
      if (!inside(root, target))
        throw new Error('La ruta privada escapa del directorio autorizado.');
      try {
        const handle = await open(
          /* turbopackIgnore: true */
          target,
          constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
        );
        try {
          const info = await handle.stat();
          if (!info.isFile()) throw new Error('El objeto privado no es un archivo regular.');
          return new Uint8Array(await handle.readFile());
        } finally {
          await handle.close();
        }
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
          return null;
        throw error;
      }
    },
  };
}
