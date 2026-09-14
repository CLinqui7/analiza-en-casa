import { Storage } from '@google-cloud/storage';
import type { PrivateFileStorage } from '../validation/files';

/** Private bucket access uses the Cloud Run service identity (ADC), never a service-account key. */
export function googlePrivateStorage(env: NodeJS.ProcessEnv = process.env): PrivateFileStorage {
  const name = env.GCS_PRIVATE_BUCKET;
  if (!name) throw new Error('Falta el bucket privado autorizado.');
  const emulator = env.ANALIZA_QA_STORAGE_EMULATOR;
  if (emulator && (env.ANALIZA_QA_MODE !== '1' || env.K_SERVICE))
    throw new Error('El emulador sólo está permitido en QA local.');
  const storage = new Storage({
    timeout: 6000,
    retryOptions: { maxRetries: 1, totalTimeout: 8, maxRetryDelay: 1 },
    ...(emulator
      ? { apiEndpoint: emulator, projectId: 'analiza-local-qa', useAuthWithCustomEndpoint: false }
      : {}),
  });
  const bucket = storage.bucket(name);
  return {
    async putObject({ storageKey, bytes }) {
      await bucket.file(storageKey).save(Buffer.from(bytes), {
        resumable: false,
        validation: 'crc32c',
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { cacheControl: 'private, no-store' },
      });
    },
    async getObject(key) {
      try {
        const [bytes] = await bucket.file(key).download({ validation: 'crc32c' });
        return bytes;
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 404)
          return null;
        throw error;
      }
    },
  };
}
