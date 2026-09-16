import assert from 'node:assert/strict';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { assertProvisionTarget, assertSyntheticTarget } from './operator-target.mjs';

const directory = new URL('../../database/postgresql/migrations/', import.meta.url);
const files = (await readdir(directory)).filter((name) => /^\d+_[a-z_]+\.sql$/.test(name)).sort();
const migrations = await Promise.all(
  files.map(async (version) => {
    const sql = await readFile(new URL(version, directory), 'utf8');
    return { version, sql, sha256: createHash('sha256').update(sql).digest('hex') };
  }),
);
if (process.argv.includes('--dry-run')) {
  console.log(
    JSON.stringify({
      operation: 'MIGRATION_PLAN_ONLY',
      migrations: migrations.map(({ version, sha256 }) => ({ version, sha256 })),
      target: 'analiza schema, PostgreSQL 16 through 19',
      automaticRuntimeDdl: false,
    }),
  );
  process.exit(0);
}
const seed = process.argv.includes('--seed-synthetic');
assert.ok(
  seed || process.argv.includes('--migrate'),
  'Specify --dry-run, --migrate or --seed-synthetic',
);
assert.equal(
  process.env.ANALIZA_MIGRATION_APPROVED,
  '1',
  'Explicit migration identity/target approval is required',
);
if (seed) assertSyntheticTarget(process.env);
const provision = process.argv.includes('--provision-runtime');
if (provision) {
  assert.ok(!seed, 'Provisioning belongs to the explicit migration operation');
  assertProvisionTarget(process.env);
}
const managedNeon = process.env.ANALIZA_MANAGED_POSTGRES === 'neon';
const neonConnectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const neonUsername =
  managedNeon && neonConnectionString
    ? decodeURIComponent(new URL(neonConnectionString).username)
    : undefined;
assert.ok(
  managedNeon
    ? neonConnectionString
    : process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD,
  'Private operator PostgreSQL configuration is required',
);
const client = new Client(
  managedNeon
    ? {
        connectionString: neonConnectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
        statement_timeout: 30000,
      }
    : { connectionTimeoutMillis: 5000, statement_timeout: 30000 },
);
try {
  await client.connect();
  const version = Number(
    (await client.query('SHOW server_version_num')).rows[0].server_version_num,
  );
  assert.ok(version >= 160000 && version < 200000, 'PostgreSQL 16 through 19 is required');
  await client.query("SELECT pg_advisory_lock(hashtextextended('analiza:migrations',0))");
  if (provision) {
    const name = process.env.ANALIZA_PG_RUNTIME_ROLE;
    assert.ok(
      name && /^[a-z][a-z0-9_]{0,62}$/.test(name) && name !== process.env.PGUSER,
      'Separate runtime role required',
    );
    const previous = (await client.query('SELECT rolname FROM pg_roles WHERE rolname=$1', [name]))
      .rows[0];
    if (!previous) {
      // PostgreSQL defaults are NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOBYPASSRLS.
      // No password or administrative role is overwritten on a repeat invocation.
      await client.query(
        `CREATE ROLE ${client.escapeIdentifier(name)} LOGIN NOINHERIT PASSWORD ${client.escapeLiteral(process.env.ANALIZA_PG_RUNTIME_PASSWORD)}`,
      );
    }
    const role = (
      await client.query(
        'SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=$1',
        [name],
      )
    ).rows[0];
    const memberships = (
      await client.query(
        'SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1)',
        [name],
      )
    ).rowCount;
    assert.ok(
      role &&
        !role.rolsuper &&
        !role.rolbypassrls &&
        !role.rolcreatedb &&
        !role.rolcreaterole &&
        !memberships,
      'Existing runtime role has elevated privileges; refusing to change it silently',
    );
    if (previous && process.env.ANALIZA_ROTATE_RUNTIME_PASSWORD_APPROVED === '1') {
      await client.query(
        `ALTER ROLE ${client.escapeIdentifier(name)} PASSWORD ${client.escapeLiteral(process.env.ANALIZA_PG_RUNTIME_PASSWORD)}`,
      );
    }
  }
  if (!seed) {
    await client.query('CREATE SCHEMA IF NOT EXISTS analiza');
    await client.query('REVOKE ALL ON SCHEMA analiza FROM PUBLIC');
    await client.query(
      'CREATE TABLE IF NOT EXISTS analiza.schema_migrations(version text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    for (const migration of migrations) {
      const previous = (
        await client.query('SELECT sha256 FROM analiza.schema_migrations WHERE version=$1', [
          migration.version,
        ])
      ).rows[0];
      if (previous) {
        assert.equal(
          previous.sha256,
          migration.sha256,
          'Applied migration changed; add a new version',
        );
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO analiza.schema_migrations(version,sha256) VALUES($1,$2)', [
          migration.version,
          migration.sha256,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    // Existing role only. This tool never creates a corporate user/password or grants DDL/DELETE.
    const runtimeRole =
      process.env.ANALIZA_PG_RUNTIME_ROLE ||
      (managedNeon ? process.env.PGUSER || neonUsername : undefined);
    assert.ok(
      runtimeRole && /^[a-z][a-z0-9_]{0,62}$/.test(runtimeRole),
      'Specify the existing restricted runtime SQL role',
    );
    const role = client.escapeIdentifier(runtimeRole);
    const info = (
      await client.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1', [
        runtimeRole,
      ])
    ).rows[0];
    assert.ok(
      info &&
        !info.rolsuper &&
        !info.rolbypassrls &&
        (managedNeon || runtimeRole !== process.env.PGUSER),
      'Runtime role must be separate, non-superuser and NOBYPASSRLS',
    );
    await client.query(`GRANT USAGE ON SCHEMA analiza TO ${role}`);
    await client.query(`GRANT SELECT ON analiza.schema_migrations TO ${role}`);
    await client.query(`GRANT SELECT,INSERT ON analiza.organizations TO ${role}`);
    await client.query(
      `GRANT SELECT,INSERT,UPDATE ON analiza.workspace_profiles,analiza.organization_staff,analiza.organization_services TO ${role}`,
    );
    await client.query(`GRANT SELECT,INSERT,UPDATE ON analiza.nurse_profiles TO ${role}`);
    await client.query(`GRANT SELECT,INSERT ON analiza.feedback_reports TO ${role}`);
    await client.query(
      `GRANT SELECT,INSERT,UPDATE ON analiza.users,analiza.memberships,analiza.sessions,analiza.auth_rate_limits,analiza.patients,analiza.doctors,analiza.nursing_resources,analiza.hospitalizations,analiza.hospitalization_nurses,analiza.configuration_entries TO ${role}`,
    );
    await client.query(
      `GRANT SELECT,INSERT ON analiza.shifts,analiza.commands,analiza.file_metadata,analiza.audit_events TO ${role}`,
    );
    await client.query(`GRANT SELECT ON analiza.catalog_items TO ${role}`);
    if (provision) {
      let runtimeConfig = {
        user: runtimeRole,
        password: process.env.ANALIZA_PG_RUNTIME_PASSWORD,
        connectionTimeoutMillis: 5000,
      };
      if (managedNeon && neonConnectionString) {
        const runtimeUrl = new URL(neonConnectionString);
        runtimeUrl.username = runtimeRole;
        runtimeUrl.password = process.env.ANALIZA_PG_RUNTIME_PASSWORD;
        runtimeConfig = {
          connectionString: runtimeUrl.toString(),
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 5000,
        };
      }
      const runtimeCheck = new Client(runtimeConfig);
      try {
        await runtimeCheck.connect();
        await runtimeCheck.query('SELECT version FROM analiza.schema_migrations LIMIT 1');
      } finally {
        await runtimeCheck.end();
      }
    }
    console.log(
      JSON.stringify({
        operation: 'MIGRATED',
        migrations: migrations.map(({ version, sha256 }) => ({ version, sha256 })),
        runtimeRole,
        deleteGranted: false,
        runtimePasswordRotated:
          provision && process.env.ANALIZA_ROTATE_RUNTIME_PASSWORD_APPROVED === '1',
      }),
    );
  } else {
    const password = process.env.ANALIZA_QA_PASSWORD;
    assert.ok(
      password && password.length >= 24,
      'Provide a generated private QA password of at least 24 characters',
    );
    const digest = () => {
      const salt = randomBytes(16).toString('base64url');
      return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('base64url')}`;
    };
    await client.query('BEGIN');
    await client.query(
      "INSERT INTO analiza.organizations(id,name) VALUES('qa-org-a','Organización ficticia A'),('qa-org-c','Organización ficticia C') ON CONFLICT(id) DO NOTHING",
    );
    for (const [id, role, org] of [
      ['qa-admin', 'ADMIN', 'qa-org-a'],
      ['qa-admin-b', 'ADMIN', 'qa-org-a'],
      ['qa-nurse', 'NURSE', 'qa-org-a'],
      ['qa-doctor', 'DOCTOR', 'qa-org-a'],
      ['qa-finance', 'FINANCE', 'qa-org-a'],
      ['qa-inventory', 'INVENTORY', 'qa-org-a'],
      ['qa-auditor', 'AUDITOR', 'qa-org-a'],
      ['qa-foreign', 'ADMIN', 'qa-org-c'],
    ]) {
      await client.query(
        'INSERT INTO analiza.users(id,email_normalized,password_hash,display_name) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',
        [id, `${id}@example.test`, digest(), `Usuario ficticio ${role}`],
      );
      await client.query(
        'INSERT INTO analiza.memberships(user_id,organization_id,role) VALUES($1,$2,$3) ON CONFLICT(user_id,organization_id) DO NOTHING',
        [id, org, role],
      );
    }
    const resource = {
      id: 'qa-resource',
      userId: 'qa-nurse',
      displayName: 'Enfermera ficticia QA',
      territory: 'Zona sintética',
      shift: 'MORNING',
      availability: 'AVAILABLE',
      capacity: 1,
      boardRegistrationNumber: 'QA-000',
    };
    await client.query("SELECT set_config('analiza.organization_id',$1,true)", ['qa-org-a']);
    await client.query(
      'INSERT INTO analiza.nursing_resources(organization_id,id,user_id,body) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,id) DO NOTHING',
      ['qa-org-a', resource.id, resource.userId, JSON.stringify(resource)],
    );
    // No prices, dosage, discounts or clinical catalogs are invented by this seed.
    await client.query('COMMIT');
    console.log(
      JSON.stringify({
        operation: 'SYNTHETIC_SEED',
        organizations: 2,
        users: 8,
        nursingResources: 1,
        passwordPrinted: false,
      }),
    );
  }
} catch (error) {
  console.error(
    JSON.stringify({
      operation: seed ? 'SEED' : 'MIGRATE',
      status: 'FAIL',
      reason:
        error instanceof assert.AssertionError
          ? error.message
          : 'Database operation failed; inspect private operator diagnostics.',
    }),
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
