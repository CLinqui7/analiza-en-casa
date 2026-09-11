import { afterEach, beforeEach, expect, it, vi } from 'vitest';
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_RELEASE_PROFILE', 'core');
  vi.stubEnv('NEXT_PUBLIC_DATA_MODE', 'mongodb');
  vi.stubEnv('ANALIZA_DATA_MODE', 'mongodb');
  vi.stubEnv('ANALIZA_API_ORIGIN', '');
});
afterEach(() => vi.unstubAllEnvs());
it('refuses a core build with a demo server', async () => {
  vi.stubEnv('ANALIZA_DATA_MODE', 'mock');
  await expect(import('../../next.config')).rejects.toThrow('Core requires');
});
it('keeps cloud API rewrites before local API handlers', async () => {
  vi.stubEnv('ANALIZA_API_ORIGIN', 'https://qa-example.onrender.com');
  const { default: config } = await import('../../next.config');
  expect(await config.rewrites!()).toEqual({
    beforeFiles: [
      { source: '/api/:path*', destination: 'https://qa-example.onrender.com/api/:path*' },
    ],
    afterFiles: [],
    fallback: [],
  });
});
it.each([
  'http://qa.onrender.com',
  'https://user:password@qa.onrender.com',
  'https://qa.onrender.com/path',
  'https://untrusted.invalid',
])('rejects unsafe backend configuration %s', async (origin) => {
  vi.stubEnv('ANALIZA_API_ORIGIN', origin);
  await expect(import('../../next.config')).rejects.toThrow('ANALIZA_API_ORIGIN');
});
