import { z } from 'zod';
import { MongoInputError } from './patients';

export const MAX_PRIVATE_FILE_BYTES = 25 * 1024 * 1024;
export const ownerTypeSchema = z.enum(['patient', 'doctor', 'hospitalization', 'nursing_resource']);
export const fileMetadataSchema = z.object({
  id: z.string().uuid(),
  ownerType: ownerTypeSchema,
  ownerId: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(255),
  mimeType: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i),
  size: z.number().int().nonnegative().max(MAX_PRIVATE_FILE_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export type FileOwnerType = z.infer<typeof ownerTypeSchema>;
export type FileMetadata = z.infer<typeof fileMetadataSchema>;
export type PrivateFileUpload = Readonly<{
  ownerType: FileOwnerType;
  ownerId: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}>;
/** The implementation is private object storage; no browser-visible URL or base64 representation. */
export interface PrivateFileStorage {
  putObject(input: Readonly<{ storageKey: string; bytes: Uint8Array }>): Promise<void>;
  getObject(storageKey: string): Promise<Uint8Array | null>;
}

export function parseUpload(input: PrivateFileUpload): PrivateFileUpload {
  const parsed = z
    .object({
      ownerType: ownerTypeSchema,
      ownerId: z.string().trim().min(1).max(255),
      name: z.string().trim().min(1).max(255),
      mimeType: z
        .string()
        .trim()
        .regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i),
      bytes: z.instanceof(Uint8Array).refine((bytes) => bytes.byteLength <= MAX_PRIVATE_FILE_BYTES),
    })
    .safeParse(input);
  if (!parsed.success) throw new MongoInputError('El archivo privado no es válido.');
  return parsed.data;
}
