import { GridFSBucket, type Db } from 'mongodb';
import type { PrivateFileStorage } from './mongo-files';

/**
 * GridFS keeps attachment bytes outside application documents and streams them through the
 * authenticated route. It is selected here because the repository already uses MongoDB and the
 * server never gives the browser a direct bucket URL.
 */
export class MongoGridFsPrivateStorage implements PrivateFileStorage {
  private readonly bucket: GridFSBucket;

  constructor(database: Db) {
    this.bucket = new GridFSBucket(database, { bucketName: 'privateFileBytes' });
  }

  async putObject({ storageKey, bytes }: Readonly<{ storageKey: string; bytes: Uint8Array }>) {
    await new Promise<void>((resolve, reject) => {
      const upload = this.bucket.openUploadStream(storageKey, { metadata: { private: true } });
      upload.once('error', reject);
      upload.once('finish', () => resolve());
      upload.end(Buffer.from(bytes));
    });
  }

  async getObject(storageKey: string): Promise<Uint8Array | null> {
    return new Promise<Uint8Array | null>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const download = this.bucket.openDownloadStreamByName(storageKey);
      download.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      download.once('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') resolve(null);
        else reject(error);
      });
      download.once('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    });
  }
}
