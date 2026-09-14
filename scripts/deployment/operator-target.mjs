import assert from 'node:assert/strict';

/** Explicit destination checks before any synthetic seed or role provisioning. */
export function assertSyntheticTarget(env) {
  const local =
    env.ANALIZA_QA_MODE === '1' &&
    !env.K_SERVICE &&
    !env.CLOUD_RUN_JOB &&
    !env.PGHOST?.startsWith('/cloudsql/');
  const staging =
    env.ANALIZA_ENVIRONMENT === 'staging' &&
    env.ANALIZA_STAGING_SEED_APPROVED === '1' &&
    !env.K_SERVICE &&
    env.CLOUD_RUN_JOB === 'analiza-staging-seed' &&
    env.PGDATABASE === 'analiza_en_casa' &&
    /^[a-z][a-z0-9-]{4,28}[a-z0-9]:us-central1:analiza-sql-staging$/.test(
      env.ANALIZA_SQL_CONNECTION_NAME || '',
    ) &&
    env.PGHOST === `/cloudsql/${env.ANALIZA_SQL_CONNECTION_NAME}`;
  assert.ok(
    local || staging,
    'Synthetic seed requires isolated local QA or the explicitly approved staging seed job/socket/database',
  );
  return local ? 'local-qa' : 'staging';
}

export function assertProvisionTarget(env) {
  assert.ok(
    !env.CLOUD_RUN_JOB || env.CLOUD_RUN_JOB === 'analiza-staging-migrate',
    'Role provisioning is limited to the migration operator',
  );
  const target = {
    ...env,
    CLOUD_RUN_JOB:
      env.CLOUD_RUN_JOB === 'analiza-staging-migrate' ? 'analiza-staging-seed' : env.CLOUD_RUN_JOB,
  };
  assertSyntheticTarget(target);
  assert.equal(
    env.ANALIZA_PROVISION_RUNTIME_APPROVED,
    '1',
    'Runtime role provisioning requires explicit approval',
  );
  assert.ok(
    env.ANALIZA_PG_RUNTIME_PASSWORD?.length >= 32,
    'A generated private runtime password is required',
  );
}
