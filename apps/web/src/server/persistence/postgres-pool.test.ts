import { afterEach, expect, it, vi } from 'vitest';
import { postgresConfig } from './postgres-pool';
import { persistence } from './index';
afterEach(() => vi.unstubAllEnvs());
const syntheticPassword = ['synthetic', 'unit', 'test', 'only'].join('-');
const env = {
  ANALIZA_DATA_MODE: 'postgresql',
  PGHOST: '/cloudsql/project:us-central1:instance',
  PGDATABASE: 'synthetic',
  PGUSER: 'qa-runtime',
  PGPASSWORD: syntheticPassword,
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
