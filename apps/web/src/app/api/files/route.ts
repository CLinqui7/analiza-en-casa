import { persistence } from '@/server/persistence';
import { NextRequest, NextResponse } from 'next/server';
import { authorizationStatus } from '@/server/http-auth';

import { MAX_PRIVATE_FILE_BYTES, type FileOwnerType } from '@/server/validation/files';
import { MongoAccessError, MongoInputError } from '@/server/validation/patients';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { privateMultipart, withPrivateUpload, UploadBusyError } from '@/server/private-multipart';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function secureError(status: 401 | 403 | 503) {
  const error =
    status === 401
      ? 'No autorizado.'
      : status === 403
        ? 'No tiene autorización.'
        : 'El almacenamiento privado no está disponible.';
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function formValue(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

/** Metadata listing remains tenant-scoped and rechecks the owner permission on every request. */
export async function GET(request: NextRequest) {
  try {
    const backend = await persistence();
    const auth = backend.auth;
    const actor = await auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    const ownerType = request.nextUrl.searchParams.get('ownerType') as FileOwnerType;
    const ownerId = request.nextUrl.searchParams.get('ownerId') ?? '';
    const files = await backend.files.listForOwner(actor, ownerType, ownerId);
    return NextResponse.json(files, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MongoInputError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (error instanceof MongoAccessError) return secureError(403);
    return secureError(authorizationStatus(error));
  }
}

/** Bounded multipart upload: owner scope comes from the session and bytes never enter JSON. */
export async function POST(request: NextRequest) {
  try {
    const backend = await persistence();
    const auth = backend.auth;
    const sessionToken = request.cookies.get(sessionCookieName)?.value;
    const actor = await auth.requireSession(sessionToken);
    await auth.requireCsrf(sessionToken, request.headers.get(csrfHeaderName) ?? undefined);
    return await withPrivateUpload(async () => {
      const form = await privateMultipart(request);
      if (
        [...form.keys()].some((key) => key !== 'ownerType' && key !== 'ownerId' && key !== 'file')
      ) {
        throw new MongoInputError();
      }
      const rawFile = form.get('file');
      if (!(rawFile instanceof File) || rawFile.size > MAX_PRIVATE_FILE_BYTES) {
        throw new MongoInputError('El archivo privado no es válido.');
      }
      const files = backend.files;
      const file = await files.upload(actor, {
        ownerType: formValue(form, 'ownerType') as FileOwnerType,
        ownerId: formValue(form, 'ownerId'),
        name: rawFile.name,
        mimeType: rawFile.type || 'application/octet-stream',
        bytes: new Uint8Array(await rawFile.arrayBuffer()),
      });
      return NextResponse.json(file, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    });
  } catch (error) {
    if (error instanceof UploadBusyError) {
      return NextResponse.json(
        { error: 'Hay otras cargas en curso. Inténtelo de nuevo.' },
        { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '2' } },
      );
    }
    if (error instanceof MongoInputError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (error instanceof MongoAccessError) return secureError(403);
    return secureError(authorizationStatus(error));
  }
}
