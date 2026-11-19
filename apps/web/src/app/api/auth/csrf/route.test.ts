import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SessionError } from '@/server/auth-service';

const getCsrf = vi.hoisted(() => vi.fn());
vi.mock('@/server/persistence', () => ({ persistence: async () => ({ auth: { getCsrf } }) }));
import { GET } from './route';

describe('CSRF session retrieval', () => {
  beforeEach(() => {
    getCsrf.mockReset();
  });
  it('returns the session token without rotating cookies and prevents caching', async () => {
    getCsrf.mockResolvedValue('synthetic-csrf');
    const response = await GET(
      new NextRequest('https://example.test/api/auth/csrf', {
        headers: { cookie: 'analiza_session=synthetic-session', 'sec-fetch-site': 'same-origin' },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ csrfToken: 'synthetic-csrf' });
    expect(getCsrf).toHaveBeenCalledWith('synthetic-session');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
  it('rejects explicit cross-site requests before accessing the session', async () => {
    const response = await GET(
      new NextRequest('https://example.test/api/auth/csrf', {
        headers: { cookie: 'analiza_session=synthetic-session', 'sec-fetch-site': 'cross-site' },
      }),
    );
    expect(response.status).toBe(403);
    expect(getCsrf).not.toHaveBeenCalled();
  });
  it('clears an expired session and issues only a pre-auth challenge', async () => {
    getCsrf.mockRejectedValue(new SessionError());
    const response = await GET(
      new NextRequest('https://example.test/api/auth/csrf', {
        headers: { cookie: 'analiza_session=synthetic-session' },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.cookies.get('analiza_session')?.value).toBe('');
    expect(response.cookies.get('analiza_login_csrf')?.value).toBe(
      (await response.json()).csrfToken,
    );
  });
  it('does not hide persistence outages as a new session', async () => {
    getCsrf.mockRejectedValue(new Error('synthetic outage'));
    const response = await GET(
      new NextRequest('https://example.test/api/auth/csrf', {
        headers: { cookie: 'analiza_session=synthetic-session' },
      }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
