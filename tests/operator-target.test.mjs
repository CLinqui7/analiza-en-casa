import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSyntheticTarget,
  assertProvisionTarget,
} from '../scripts/deployment/operator-target.mjs';

const staging = {
  ANALIZA_ENVIRONMENT: 'staging',
  ANALIZA_STAGING_SEED_APPROVED: '1',
  CLOUD_RUN_JOB: 'analiza-staging-seed',
  PGDATABASE: 'analiza_en_casa',
  ANALIZA_SQL_CONNECTION_NAME: 'synthetic-project:us-central1:analiza-sql-staging',
  PGHOST: '/cloudsql/synthetic-project:us-central1:analiza-sql-staging',
};
test('seed requires the exact approved job, database and managed SQL socket', () => {
  assert.equal(assertSyntheticTarget(staging), 'staging');
  for (const invalid of [
    { ANALIZA_ENVIRONMENT: 'production' },
    { ANALIZA_STAGING_SEED_APPROVED: '0' },
    { CLOUD_RUN_JOB: 'analiza-prod-seed' },
    { K_SERVICE: 'analiza-staging' },
    { PGDATABASE: 'corporate' },
    { PGHOST: 'localhost' },
    { ANALIZA_SQL_CONNECTION_NAME: 'synthetic-project:us-central1:corporate' },
  ]) {
    assert.throws(() => assertSyntheticTarget({ ...staging, ...invalid }));
  }
});
test('local QA authorization cannot be used from a deployed job or web service', () => {
  const qa = { ANALIZA_QA_MODE: '1', PGHOST: '127.0.0.1', PGDATABASE: 'analiza_qa' };
  assert.equal(assertSyntheticTarget(qa), 'local-qa');
  for (const invalid of [
    { CLOUD_RUN_JOB: 'some-job' },
    { K_SERVICE: 'some-service' },
    { PGHOST: staging.PGHOST },
    { PGHOST: 'corporate.example.invalid' },
    { PGDATABASE: 'corporate' },
  ])
    assert.throws(() => assertSyntheticTarget({ ...qa, ...invalid }));
});
test('runtime role provisioning has independent authorization and requires a strong private password', () => {
  const provision = {
    ...staging,
    CLOUD_RUN_JOB: 'analiza-staging-migrate',
    ANALIZA_PROVISION_RUNTIME_APPROVED: '1',
    ANALIZA_PG_RUNTIME_PASSWORD: 'synthetic-test-only-credential-32chars',
  };
  assert.doesNotThrow(() => assertProvisionTarget(provision));
  assert.throws(() =>
    assertProvisionTarget({ ...provision, ANALIZA_PROVISION_RUNTIME_APPROVED: '0' }),
  );
  assert.throws(() => assertProvisionTarget({ ...provision, ANALIZA_PG_RUNTIME_PASSWORD: '' }));
});
