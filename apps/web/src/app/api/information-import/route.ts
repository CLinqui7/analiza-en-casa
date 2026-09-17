import { NextRequest, NextResponse } from 'next/server';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { privateHeaders } from '@/server/auth-http';
import { authorizationStatus } from '@/server/http-auth';
import { persistence } from '@/server/persistence';
import { privateMultipart, UploadBusyError, withPrivateUpload } from '@/server/private-multipart';
import { MongoInputError } from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024;
const workbookMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function errorResponse(error: unknown) {
  const status =
    error instanceof MongoInputError
      ? 400
      : error instanceof UploadBusyError
        ? 429
        : authorizationStatus(error);
  const message =
    status === 400
      ? error instanceof Error
        ? error.message
        : 'Revisa el archivo antes de intentarlo nuevamente.'
      : status === 429
        ? 'Hay otro documento procesándose. Intenta nuevamente.'
        : status === 401
          ? 'Inicia sesión para continuar.'
          : status === 403
            ? 'Solo la cuenta administradora puede importar información.'
            : 'No pudimos procesar la plantilla en este momento.';
  return NextResponse.json({ error: message }, { status, headers: privateHeaders });
}

function readWorkbookFile(form: FormData) {
  if ([...form.keys()].some((key) => !['action', 'file'].includes(key))) {
    throw new MongoInputError('El envío contiene campos no reconocidos.');
  }
  const action = form.get('action');
  const file = form.get('file');
  if (action !== 'preview' && action !== 'import') {
    throw new MongoInputError('Selecciona una acción válida.');
  }
  if (!(file instanceof File) || !file.size) {
    throw new MongoInputError('Selecciona la plantilla Excel que deseas importar.');
  }
  const name = file.name.trim();
  if (
    !name ||
    name.length > 255 ||
    /[\\/\u0000-\u001f]/.test(name) ||
    !name.toLowerCase().endsWith('.xlsx')
  ) {
    throw new MongoInputError('El documento debe ser un archivo .xlsx válido.');
  }
  if (file.size > MAX_WORKBOOK_BYTES) {
    throw new MongoInputError('La plantilla no puede pesar más de 5 MB.');
  }
  if (file.type && file.type !== workbookMimeType && file.type !== 'application/octet-stream') {
    throw new MongoInputError('El documento debe ser una plantilla Excel .xlsx.');
  }
  return { action, file, name };
}

export async function GET(request: NextRequest) {
  try {
    const backend = await persistence();
    const actor = await backend.auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    if (!backend.informationImports) {
      return NextResponse.json(
        { error: 'La importación no está disponible en este ambiente.' },
        { status: 404, headers: privateHeaders },
      );
    }
    return NextResponse.json(await backend.informationImports.overview(actor), {
      headers: privateHeaders,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const backend = await persistence();
    const token = request.cookies.get(sessionCookieName)?.value;
    const actor = await backend.auth.requireSession(token);
    await backend.auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
    if (!backend.informationImports) {
      return NextResponse.json(
        { error: 'La importación no está disponible en este ambiente.' },
        { status: 404, headers: privateHeaders },
      );
    }
    const informationImports = backend.informationImports;
    return await withPrivateUpload(async () => {
      const { action, file, name } = readWorkbookFile(await privateMultipart(request));
      const bytes = new Uint8Array(await file.arrayBuffer());
      const payload =
        action === 'preview'
          ? await informationImports.preview(actor, name, bytes)
          : await informationImports.commit(actor, name, bytes);
      return NextResponse.json(payload, {
        status: action === 'import' ? 201 : 200,
        headers: privateHeaders,
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
