import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { CsrfError, SessionError } from '@/server/auth-service';
import { persistence } from '@/server/persistence';
import { PUT } from './avatar/route';
import { POST } from './password/route';
import sharp from 'sharp';

vi.mock('@/server/persistence', () => ({ persistence: vi.fn() }));

const actor = { userId: 'synthetic-user', organizationId: 'synthetic-org', role: 'NURSE' };
const profile = {
  email: 'synthetic@example.test',
  displayName: 'Synthetic Nurse',
  avatarVersion: 1,
};
const saveAvatar = vi.fn(async () => profile);
const changePassword = vi.fn(async () => undefined);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(persistence).mockResolvedValue({
    auth: {
      requireSession: async (token?: string) => {
        if (token !== 'synthetic-session') throw new SessionError();
        return actor;
      },
      requireCsrf: async (_token?: string, csrf?: string) => {
        if (csrf !== 'synthetic-csrf') throw new CsrfError();
      },
    },
    accountProfile: { saveAvatar, changePassword },
  } as never);
});

const png = await sharp({ create: { width: 1, height: 1, channels: 4, background: '#116d77' } })
  .png()
  .toBuffer();

function request(
  path: string,
  method: 'PUT' | 'POST',
  mime: string,
  body: BodyInit,
  csrf = 'synthetic-csrf',
) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      cookie: 'analiza_session=synthetic-session',
      'content-type': mime,
      'x-analiza-csrf': csrf,
    },
    body,
  });
}

describe('private avatar and password endpoints', () => {
  it('rejects images with a MIME/signature mismatch', async () => {
    const response = await PUT(
      request('/api/profile/avatar', 'PUT', 'image/jpeg', Buffer.from(png)),
    );
    expect(response.status).toBe(400);
    expect(saveAvatar).not.toHaveBeenCalled();
  });

  it('stores only a valid private image for the session actor', async () => {
    const response = await PUT(
      request('/api/profile/avatar', 'PUT', 'image/png', Buffer.from(png)),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(saveAvatar).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ mimeType: 'image/webp' }),
    );
  });

  it('refuses a password change without CSRF', async () => {
    const response = await POST(
      request(
        '/api/profile/password',
        'POST',
        'application/json',
        JSON.stringify({
          currentPassword: 'synthetic-old-password',
          newPassword: 'synthetic-new-password',
        }),
        'bad',
      ),
    );
    expect(response.status).toBe(403);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('clears the current session cookie after a valid password change', async () => {
    const response = await POST(
      request(
        '/api/profile/password',
        'POST',
        'application/json',
        JSON.stringify({
          currentPassword: 'synthetic-old-password',
          newPassword: 'synthetic-new-password',
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect(response.cookies.get('analiza_session')?.value).toBe('');
    expect(changePassword).toHaveBeenCalledWith(
      actor,
      'synthetic-old-password',
      'synthetic-new-password',
    );
  });
});
