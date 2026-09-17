'use client';

import { mongoMutationHeaders } from '@/lib/auth';

export type PrivateFileOwner = 'patient' | 'doctor' | 'hospitalization' | 'nursing_resource';
export type PrivateFileMetadata = Readonly<{
  id: string;
  ownerType: PrivateFileOwner;
  ownerId: string;
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
}>;

async function uploadError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === 'string') return new Error(payload.error);
  } catch {
    // The generic error below intentionally avoids exposing a server response body.
  }
  return new Error('No fue posible cargar el archivo privado.');
}

/** Posts file bytes only to the authenticated multipart endpoint; it never creates metadata locally. */
export async function uploadPrivateFiles(
  ownerType: PrivateFileOwner,
  ownerId: string,
  files: readonly File[],
  fetchImpl: typeof fetch = fetch,
  headers: () => Record<string, string> = mongoMutationHeaders,
): Promise<PrivateFileMetadata[]> {
  const uploaded: PrivateFileMetadata[] = [];
  for (const file of files) {
    const form = new FormData();
    form.set('ownerType', ownerType);
    form.set('ownerId', ownerId);
    form.set('file', file);
    const response = await fetchImpl('/api/files', {
      method: 'POST',
      credentials: 'same-origin',
      headers: headers(),
      body: form,
    });
    if (!response.ok) throw await uploadError(response);
    uploaded.push((await response.json()) as PrivateFileMetadata);
  }
  return uploaded;
}

/** Retrieves authorized metadata again after navigation or from another signed-in session. */
export async function listPrivateFiles(
  ownerType: PrivateFileOwner,
  ownerId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PrivateFileMetadata[]> {
  const query = new URLSearchParams({ ownerType, ownerId });
  const response = await fetchImpl(`/api/files?${query}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw await uploadError(response);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error('La lista de archivos privados no es válida.');
  return payload as PrivateFileMetadata[];
}

/** A download remains same-origin and is authorized again by the server for every request. */
export function privateFileDownloadHref(id: string) {
  return `/api/files/${encodeURIComponent(id)}`;
}
