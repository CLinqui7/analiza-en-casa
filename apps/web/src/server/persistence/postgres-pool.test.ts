import { afterEach, expect, it, vi } from 'vitest';
import { postgresConfig } from './postgres-pool';
import { persistence } from './index';
afterEach(() => vi.unstubAllEnvs());
const env = {
  ANALIZA_DATA_MODE: 'postgresql',
  PGHOST: '/cloudsql/project:us-central1:instance',
  PGDATABASE: 'synthetic',
  PGUSER: 'qa-runtime',
  PGPASSWORD: 'synthetic-unit-test-only',
};
it('uses the approved socket with bounded pooling and query timeouts', () => {
  expect(postgresConfig(env)).toMatchObject({
    host: env.PGHOST,
    max: 5,
    connectionTimeoutMillis: 2000,
    statement_timeout: 5000,
  });
});
it('does not permit public TCP or local emulators inside Cloud Run', () => {
  expect(() => postgresConfig({ ...env, PGHOST: 'public.example.invalid' })).toThrow('socket');
  expect(() =>
    postgresConfig({ ...env, PGHOST: 'db', ANALIZA_QA_MODE: '1', K_SERVICE: 'staging' }),
  ).toThrow('socket');
  expect(() => postgresConfig({ ...env, PGHOST: 'db', ANALIZA_QA_MODE: '1' })).not.toThrow();
});
it('accepts only the declared Neon integration on Vercel', () => {
  const connectionString =
    'postgresql://nurse_app:synthetic-unit-test-only@ep-example-pooler.us-east-1.aws.neon.tech/neondb';
  expect(
    postgresConfig({
      ANALIZA_DATA_MODE: 'postgresql',
      ANALIZA_MANAGED_POSTGRES: 'neon',
      VERCEL: '1',
      DATABASE_URL: connectionString,
    }),
  ).toMatchObject({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  });
  expect(() =>
    postgresConfig({
      ANALIZA_DATA_MODE: 'postgresql',
      ANALIZA_MANAGED_POSTGRES: 'neon',
      VERCEL: '1',
      DATABASE_URL: connectionString.replace('.neon.tech', '.example.invalid'),
    }),
  ).toThrow('no está autorizada');
  expect(() =>
    postgresConfig({
      ANALIZA_DATA_MODE: 'postgresql',
      ANALIZA_MANAGED_POSTGRES: 'neon',
      DATABASE_URL: connectionString,
    }),
  ).toThrow('no está autorizada');
});
it('rejects missing secrets and unsafe pool bounds without printing values', () => {
  expect(() => postgresConfig({ ...env, PGUSER: '' })).toThrow('configuración');
  for (const max of ['0', '100', '2.5', 'invalid'])
    expect(() => postgresConfig({ ...env, PGPOOL_MAX: max })).toThrow('Pool');
});
it('never falls back to a Mongo or local provider when PostgreSQL configuration fails', async () => {
  vi.stubEnv('ANALIZA_DATA_MODE', 'postgresql');
  vi.stubEnv('PGHOST', '');
  vi.stubEnv('MONGODB_URI', 'mongodb://synthetic.invalid');
  await expect(persistence()).rejects.toThrow('PostgreSQL');
  vi.stubEnv('ANALIZA_DATA_MODE', 'unknown');
  await expect(persistence()).rejects.toThrow('persistencia');
});
