import { NextRequest, NextResponse } from 'next/server';
import { persistence } from '@/server/persistence';
import {
  AccountError,
  csrfHeaderName,
  PasswordChangeRequiredError,
  sessionCookieName,
} from '@/server/auth-service';
import { boundedJson, privateHeaders } from '@/server/auth-http';
import { authorizationStatus } from '@/server/http-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const account = await (
      await persistence()
    ).auth.account(request.cookies.get(sessionCookieName)?.value);
    return NextResponse.json(account, { headers: privateHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: 'No fue posible consultar la cuenta.' },
      { status: authorizationStatus(error), headers: privateHeaders },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = (await persistence()).auth;
    const token = request.cookies.get(sessionCookieName)?.value;
    await auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
    const account = await auth.updateAccount(token, await boundedJson(request));
    return NextResponse.json(account, { headers: privateHeaders });
  } catch (error) {
    const status =
      error instanceof AccountError
        ? 400
        : error instanceof PasswordChangeRequiredError
          ? 403
          : authorizationStatus(error);
    return NextResponse.json(
      {
        error:
          error instanceof AccountError || error instanceof PasswordChangeRequiredError
            ? error.message
            : 'No fue posible actualizar la cuenta.',
      },
      { status, headers: privateHeaders },
    );
  }
}
