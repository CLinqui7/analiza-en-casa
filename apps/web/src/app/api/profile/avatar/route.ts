import { NextRequest, NextResponse } from 'next/server';
import { maximumAvatarBytes } from '@/lib/account-profile';
import { normalizeAccountAvatar } from '@/server/account-avatar';
import { privateHeaders } from '@/server/auth-http';
import { boundedAvatar, profileFailure, profileRequest } from '@/server/profile-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { backend, actor } = await profileRequest(request);
    const avatar = await backend.accountProfile.avatar(actor);
    if (!avatar) return new NextResponse(null, { status: 404, headers: privateHeaders });
    return new NextResponse(Buffer.from(avatar.bytes), {
      headers: {
        ...privateHeaders,
        'Content-Type': avatar.mimeType,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return profileFailure(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { backend, actor } = await profileRequest(request, true);
    const claimedMime = request.headers.get('content-type') ?? '';
    const declaredSize = Number(request.headers.get('content-length') ?? 0);
    if (
      declaredSize > maximumAvatarBytes ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(claimedMime)
    )
      throw new Error('AVATAR_INVALID');
    const avatar = await normalizeAccountAvatar(await boundedAvatar(request), claimedMime);
    return NextResponse.json(await backend.accountProfile.saveAvatar(actor, avatar), {
      headers: privateHeaders,
    });
  } catch (error) {
    return profileFailure(error);
  }
}
