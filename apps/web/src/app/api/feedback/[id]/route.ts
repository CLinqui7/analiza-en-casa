import { NextRequest, NextResponse } from 'next/server';
import { feedbackStatusSchema } from '@/lib/feedback';
import { privateHeaders } from '@/server/auth-http';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';
import { persistence } from '@/server/persistence';
import { MongoInputError } from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  const status = error instanceof MongoInputError ? 400 : authorizationStatus(error);
  return NextResponse.json(
    {
      error:
        status === 400
          ? error instanceof Error
            ? error.message
            : 'Revisa el estado seleccionado.'
          : status === 401
            ? 'Inicia sesión para continuar.'
            : status === 403
              ? 'Solo el administrador puede modificar los comentarios.'
              : 'No pudimos actualizar el comentario.',
    },
    { status, headers: privateHeaders },
  );
}

async function authenticatedFeedback(request: NextRequest) {
  const backend = await persistence();
  const token = request.cookies.get(sessionCookieName)?.value;
  const actor = await backend.auth.requireSession(token);
  await backend.auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
  return { backend, actor };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { backend, actor } = await authenticatedFeedback(request);
    if (!backend.feedback) {
      return NextResponse.json(
        { error: 'No disponible en este ambiente.' },
        { status: 404, headers: privateHeaders },
      );
    }
    const body: unknown = await request.json();
    const parsed = feedbackStatusSchema.safeParse(
      body && typeof body === 'object' && !Array.isArray(body) && 'status' in body
        ? body.status
        : undefined,
    );
    if (!parsed.success) throw new MongoInputError('El estado seleccionado no es válido.');
    const { id } = await params;
    const report = await backend.feedback.updateStatus(actor, id, parsed.data);
    if (!report) {
      return NextResponse.json(
        { error: 'El comentario ya no existe.' },
        { status: 404, headers: privateHeaders },
      );
    }
    return NextResponse.json(report, { headers: privateHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { backend, actor } = await authenticatedFeedback(request);
    if (!backend.feedback) {
      return NextResponse.json(
        { error: 'No disponible en este ambiente.' },
        { status: 404, headers: privateHeaders },
      );
    }
    const { id } = await params;
    const removed = await backend.feedback.remove(actor, id);
    if (!removed) {
      return NextResponse.json(
        { error: 'El comentario ya no existe.' },
        { status: 404, headers: privateHeaders },
      );
    }
    return new NextResponse(null, { status: 204, headers: privateHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
