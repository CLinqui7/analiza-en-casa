import { NextRequest, NextResponse } from 'next/server';
import { persistence } from './persistence';
import { postgresPool } from './persistence/postgres-pool';
import {
  prequoteInbox,
  assignSupplyRequest,
  receivedOrders,
  deliverReceivedOrder,
} from './persistence/postgres-quote-fulfillment';
import { csrfHeaderName, sessionCookieName } from './auth-service';
import { boundedJson, privateHeaders } from './auth-http';
import { authorizationStatus } from './http-auth';
import { MongoAccessError, MongoConflictError, MongoInputError } from './validation/patients';

export async function quoteFulfillmentHttp(
  request: NextRequest,
  kind: 'prequotes' | 'orders',
  write = false,
) {
  try {
    if (process.env.ANALIZA_DATA_MODE !== 'postgresql')
      return NextResponse.json(
        { error: 'Este flujo requiere la base de datos del servidor.' },
        { status: 503, headers: privateHeaders },
      );
    const backend = await persistence();
    const token = request.cookies.get(sessionCookieName)?.value;
    const actor = await backend.auth.requireSession(token);
    if (write)
      await backend.auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
    const page = Number(request.nextUrl.searchParams.get('page') ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
      throw new MongoInputError('Página no válida.');
    const pool = postgresPool();
    const result = write
      ? kind === 'prequotes'
        ? await assignSupplyRequest(pool, actor, await boundedJson(request))
        : await deliverReceivedOrder(pool, actor, await boundedJson(request))
      : kind === 'prequotes'
        ? await prequoteInbox(pool, actor, page)
        : await receivedOrders(pool, actor, page);
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    const conflict =
      error instanceof MongoConflictError ||
      (error && typeof error === 'object' && 'code' in error && error.code === '23505');
    const status =
      error instanceof MongoInputError
        ? 400
        : conflict
          ? 409
          : error instanceof MongoAccessError
            ? 403
            : authorizationStatus(error);
    const message =
      status === 400 && error instanceof Error
        ? error.message
        : status === 409
          ? 'El registro cambió o ya se procesó. Actualice la bandeja antes de continuar.'
          : status === 401
            ? 'Inicie sesión para continuar.'
            : status === 403
              ? 'No tiene autorización para esta operación.'
              : 'No se pudo completar la operación. Sus datos se conservan; reintente.';
    return NextResponse.json({ error: message }, { status, headers: privateHeaders });
  }
}
