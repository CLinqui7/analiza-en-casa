import { MAX_PRIVATE_FILE_BYTES } from './validation/files';
import { MongoInputError } from './validation/patients';

const MAX_MULTIPART_BYTES = MAX_PRIVATE_FILE_BYTES + 64 * 1024;
const slots = globalThis as typeof globalThis & { analizaPrivateUploads?: number };
export class UploadBusyError extends Error {}

/** Bound memory before parsing an authenticated multipart body, including chunked requests. */
export async function withPrivateUpload<T>(operation: () => Promise<T>): Promise<T> {
  if ((slots.analizaPrivateUploads ?? 0) >= 2) throw new UploadBusyError();
  slots.analizaPrivateUploads = (slots.analizaPrivateUploads ?? 0) + 1;
  try {
    return await operation();
  } finally {
    slots.analizaPrivateUploads--;
  }
}

export async function privateMultipart(request: Request): Promise<FormData> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (!request.body || !Number.isFinite(length) || length < 0 || length > MAX_MULTIPART_BYTES)
    throw new MongoInputError('El archivo privado excede el tamaño permitido.');
  let received = 0;
  const limited = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > MAX_MULTIPART_BYTES) {
          throw new MongoInputError('El archivo privado excede el tamaño permitido.');
        }
        controller.enqueue(chunk);
      },
    }),
  );
  try {
    return await new Response(limited, {
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
    }).formData();
  } catch {
    throw new MongoInputError('El archivo privado no es válido.');
  }
}
