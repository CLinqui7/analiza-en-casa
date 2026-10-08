import { NextRequest, NextResponse } from 'next/server';
import { profilePasswordSchema } from '@/lib/account-profile';
import { authCookieOptions } from '@/server/auth-cookie';
import { sessionCookieName } from '@/server/auth-service';
import { privateHeaders } from '@/server/auth-http';
import { profileFailure, profileJson, profileRequest } from '@/server/profile-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { backend, actor } = await profileRequest(request, true);
    const { currentPassword, newPassword } = profilePasswordSchema.parse(
      await profileJson(request),
    );
    await backend.accountProfile.changePassword(actor, currentPassword, newPassword);
    const response = NextResponse.json({ reauthenticate: true }, { headers: privateHeaders });
    response.cookies.set(sessionCookieName, '', {
      ...authCookieOptions(request.nextUrl.protocol),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return profileFailure(error);
  }
}
