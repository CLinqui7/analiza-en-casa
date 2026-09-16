import { afterEach, expect, it, vi } from 'vitest';
import { postgresConfig } from './postgres-pool';
import { persistence } from './index';
afterEach(() => vi.unstubAllEnvs());
const env = {
  ANALIZA_DATA_MODE: 'postgresql',
  ANALIZA_DB_TRANSPORT: 'cloudsql',
  PGHOST: '/cloudsql/project:us-central1:instance',
  PGDATABASE: 'synthetic',
  PGUSER: 'qa-runtime',
  PGPASSWORD: 'synthetic-unit-test-only',
};
it('accepts an explicit Cloud SQL transport with the managed socket', () => {
  expect(postgresConfig(env)).toMatchObject({
    host: env.PGHOST,
    max: 5,
    connectionTimeoutMillis: 2000,
    statement_timeout: 5000,
  });
});
it('accepts the supported explicit Unix socket transport', () => {
  expect(
    postgresConfig({
      ...env,
      ANALIZA_DB_TRANSPORT: 'unix',
      PGHOST: '/var/run/postgresql',
    }),
  ).toMatchObject({ host: '/var/run/postgresql', port: 5432 });
});
it('accepts TCP only when selected explicitly with a valid host', () => {
  expect(
    postgresConfig({ ...env, ANALIZA_DB_TRANSPORT: 'tcp', PGHOST: 'db.internal' }),
  ).toMatchObject({ host: 'db.internal' });
});
it('rejects unknown or missing transports', () => {
  expect(() => postgresConfig({ ...env, ANALIZA_DB_TRANSPORT: 'unknown' })).toThrow(
    'ANALIZA_DB_TRANSPORT',
  );
  expect(() => postgresConfig({ ...env, ANALIZA_DB_TRANSPORT: undefined })).toThrow(
    'ANALIZA_DB_TRANSPORT',
  );
});
it('rejects TCP without a host', () => {
  expect(() => postgresConfig({ ...env, ANALIZA_DB_TRANSPORT: 'tcp', PGHOST: '' })).toThrow(
    'configuración',
  );
});
it('rejects a normal host in Cloud SQL mode', () => {
  expect(() => postgresConfig({ ...env, PGHOST: 'db.internal' })).toThrow('Cloud SQL');
});
it('rejects an invalid path in Unix mode', () => {
  expect(() =>
    postgresConfig({ ...env, ANALIZA_DB_TRANSPORT: 'unix', PGHOST: '/tmp/postgresql' }),
  ).toThrow('Unix');
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
}, 30_000);
