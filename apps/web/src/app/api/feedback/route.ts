import { NextRequest, NextResponse } from 'next/server';
import { persistence } from '@/server/persistence';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { privateHeaders } from '@/server/auth-http';
import { authorizationStatus } from '@/server/http-auth';
import { privateMultipart, UploadBusyError, withPrivateUpload } from '@/server/private-multipart';
import { MongoInputError } from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const feedbackSchemaHeader = 'x-analiza-feedback-schema';

function responseReport<T extends { submittedBy?: string }>(
  report: T,
  includeAttribution: boolean,
) {
  if (includeAttribution) return report;
  const compatible = { ...report };
  delete compatible.submittedBy;
  return compatible;
}

function errorResponse(error: unknown) {
  const status =
    error instanceof MongoInputError
      ? 400
      : error instanceof UploadBusyError
        ? 429
        : authorizationStatus(error);
  return NextResponse.json(
    {
      error:
        status === 400
          ? error instanceof Error
            ? error.message
            : 'Revisa los datos del reporte.'
          : status === 429
            ? 'Hay otras imágenes cargándose. Intenta nuevamente.'
            : status === 401
              ? 'Inicia sesión para continuar.'
              : 'No pudimos guardar ni cargar tus reportes.',
    },
    { status, headers: privateHeaders },
  );
}

function textValue(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

export async function GET(request: NextRequest) {
  try {
    const backend = await persistence();
    const actor = await backend.auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    if (!backend.feedback) {
      return NextResponse.json(
        { error: 'No disponible en este ambiente.' },
        { status: 404, headers: privateHeaders },
      );
    }
    const includeAttribution = request.headers.get(feedbackSchemaHeader) === '2';
    const reports = await backend.feedback.list(actor);
    return NextResponse.json(
      reports.map((report) => responseReport(report, includeAttribution)),
      { headers: privateHeaders },
    );
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
    if (!backend.feedback) {
      return NextResponse.json(
        { error: 'No disponible en este ambiente.' },
        { status: 404, headers: privateHeaders },
      );
    }
    const feedback = backend.feedback;
    return await withPrivateUpload(async () => {
      const form = await privateMultipart(request);
      if (
        [...form.keys()].some(
          (key) => !['module', 'category', 'description', 'image'].includes(key),
        )
      ) {
        throw new MongoInputError('El reporte contiene campos no reconocidos.');
      }
      const rawImage = form.get('image');
      const image =
        rawImage instanceof File && rawImage.size > 0
          ? {
              name: rawImage.name,
              mimeType: rawImage.type,
              bytes: new Uint8Array(await rawImage.arrayBuffer()),
            }
          : undefined;
      const report = await feedback.create(
        actor,
        {
          module: textValue(form, 'module'),
          category: textValue(form, 'category'),
          description: textValue(form, 'description'),
        },
        image,
      );
      const includeAttribution = request.headers.get(feedbackSchemaHeader) === '2';
      return NextResponse.json(responseReport(report, includeAttribution), {
        status: 201,
        headers: privateHeaders,
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
