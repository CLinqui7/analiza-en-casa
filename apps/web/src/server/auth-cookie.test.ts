import { afterEach, expect, it, vi } from 'vitest';
import { authCookieOptions } from './auth-cookie';
afterEach(() => vi.unstubAllEnvs());
it('retains secure HttpOnly cookies behind cloud TLS termination', () => {
  vi.stubEnv('NODE_ENV', 'production');
  expect(authCookieOptions('http:')).toEqual({
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
});
it('allows HTTP only in explicit nonproduction tests', () => {
  vi.stubEnv('NODE_ENV', 'test');
  expect(authCookieOptions('http:').secure).toBe(false);
  expect(authCookieOptions('https:').secure).toBe(true);
});
