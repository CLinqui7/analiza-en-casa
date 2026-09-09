import { NextRequest, NextResponse } from 'next/server';
import { authorizationStatus, resourceStatus } from '@/server/http-auth';
import { MongoDoctorRepository } from '@/server/mongo-doctors';
import { MongoConflictError, MongoInputError } from '@/server/mongo-patients';
import {
  csrfHeaderName,
  MongoAuthService,
  mongoAuthStore,
  sessionCookieName,
} from '@/server/mongo-auth';
import { mongoDatabase } from '@/server/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(status: 401 | 403 | 404 | 503) {
  const error =
    status === 401
      ? 'No autorizado.'
      : status === 403
        ? 'No tiene autorización.'
        : status === 404
          ? 'No encontrado.'
          : 'El acceso seguro no está disponible.';
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const database = await mongoDatabase();
    const auth = new MongoAuthService(mongoAuthStore(database));
    const actor = await auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    const { id } = await context.params;
    const doctor = await new MongoDoctorRepository(database.collection('doctors')).get(actor, id);
    if (resourceStatus(doctor) === 404) return errorResponse(404);
    return NextResponse.json(doctor, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(authorizationStatus(error));
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const database = await mongoDatabase();
    const auth = new MongoAuthService(mongoAuthStore(database));
    const sessionToken = request.cookies.get(sessionCookieName)?.value;
    const actor = await auth.requireSession(sessionToken);
    await auth.requireCsrf(sessionToken, request.headers.get(csrfHeaderName) ?? undefined);
    const { id } = await context.params;
    const doctor = await new MongoDoctorRepository(database.collection('doctors')).replace(
      actor,
      id,
      await request.json(),
    );
    return NextResponse.json(doctor, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MongoConflictError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (error instanceof MongoInputError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return errorResponse(authorizationStatus(error));
  }
}
