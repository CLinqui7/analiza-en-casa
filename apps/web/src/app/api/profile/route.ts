import { NextRequest, NextResponse } from 'next/server';
import { profileNameSchema } from '@/lib/account-profile';
import { privateHeaders } from '@/server/auth-http';
import { profileFailure, profileJson, profileRequest } from '@/server/profile-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { backend, actor } = await profileRequest(request);
    return NextResponse.json(await backend.accountProfile.get(actor), { headers: privateHeaders });
  } catch (error) {
    return profileFailure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { backend, actor } = await profileRequest(request, true);
    const { displayName } = profileNameSchema.parse(await profileJson(request));
    return NextResponse.json(await backend.accountProfile.rename(actor, displayName), {
      headers: privateHeaders,
    });
  } catch (error) {
    return profileFailure(error);
  }
}
