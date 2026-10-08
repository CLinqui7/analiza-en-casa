import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { CsrfError, SessionError } from '@/server/auth-service';
import { persistence } from '@/server/persistence';
import { GET, PATCH } from './route';

vi.mock('@/server/persistence', () => ({ persistence: vi.fn() }));

const actor = { userId: 'synthetic-user', organizationId: 'synthetic-org', role: 'NURSE' };
const profile = {
  email: 'synthetic@example.test',
  displayName: 'Synthetic Nurse',
  avatarVersion: 0,
};
const get = vi.fn(async () => profile);
const rename = vi.fn(async () => ({ ...profile, displayName: 'New Name' }));
const requireSession = vi.fn(async (token?: string) => {
  if (token !== 'synthetic-session') throw new SessionError();
  return actor;
});
const requireCsrf = vi.fn(async (_token?: string, csrf?: string) => {
  if (csrf !== 'synthetic-csrf') throw new CsrfError();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(persistence).mockResolvedValue({
    auth: { requireSession, requireCsrf },
    accountProfile: { get, rename },
  } as never);
});

function request(method: 'GET' | 'PATCH', body?: unknown, csrf?: string) {
  return new NextRequest('http://localhost/api/profile', {
    method,
    headers: {
      cookie: 'analiza_session=synthetic-session',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(csrf ? { 'x-analiza-csrf': csrf } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('own-profile HTTP boundary', () => {
  it('requires an authenticated session for reads', async () => {
    const response = await GET(new NextRequest('http://localhost/api/profile'));
    expect(response.status).toBe(401);
    expect(get).not.toHaveBeenCalled();
  });

  it('rejects a missing CSRF token before mutation', async () => {
    const response = await PATCH(request('PATCH', { displayName: 'New Name' }));
    expect(response.status).toBe(403);
    expect(rename).not.toHaveBeenCalled();
  });

  it('rejects user IDs supplied by the browser', async () => {
    const response = await PATCH(
      request('PATCH', { displayName: 'New Name', userId: 'victim' }, 'synthetic-csrf'),
    );
    expect(response.status).toBe(400);
    expect(rename).not.toHaveBeenCalled();
  });

  it('uses only the server actor and returns private no-store data', async () => {
    const response = await PATCH(request('PATCH', { displayName: 'New Name' }, 'synthetic-csrf'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(rename).toHaveBeenCalledWith(actor, 'New Name');
  });
});
