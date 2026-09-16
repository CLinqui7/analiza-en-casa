// Creates ONLY new local synthetic QA resources; no cloud calls, production writes or old images.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer, createConnection } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from 'pg';
import { chromium, request } from '@playwright/test';
import { verifyPostgresRegistration } from './verify-postgres-registration.mjs';

const image = process.env.ANALIZA_VERIFY_IMAGE || 'analiza-web:cloudrun';
const operatorImage = process.env.ANALIZA_VERIFY_OPERATOR_IMAGE;
const run = 'analiza-sqlqa-' + Date.now(),
  out = '.local/cloud-run/' + run;
await mkdir(out, { recursive: true });
const names = {
  network: run,
  db: run + '-postgres18',
  web: run + '-web',
  gcs: run + '-gcs-emulator',
};
async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const secret = randomBytes(32).toString('base64url'),
  appSecret = randomBytes(32).toString('base64url'),
  qaSecret = randomBytes(32).toString('base64url');
function docker(args, options = {}) {
  const p = spawnSync('docker', args, { encoding: 'utf8', timeout: 120000, ...options });
  assert.equal(
    p.status,
    0,
    `Docker ${args[0]} failed: ${(p.stderr || '').replaceAll(secret, '[redacted]').replaceAll(appSecret, '[redacted]')}`,
  );
  return p.stdout.trim();
}
const imageInfo = JSON.parse(docker(['image', 'inspect', image]))[0];
if (operatorImage) {
  const operatorInfo = JSON.parse(docker(['image', 'inspect', operatorImage]))[0];
  assert.equal(operatorInfo.Config.User, 'node');
  assert.equal(
    operatorInfo.Config.Labels['org.opencontainers.image.revision'],
    imageInfo.Config.Labels['org.opencontainers.image.revision'],
  );
}
function runOperator(args, env) {
  if (!operatorImage)
    return spawnSync(process.execPath, ['scripts/deployment/db-command.mjs', ...args], {
      env,
      encoding: 'utf8',
    });
  const privateEnv = {
    ...env,
    ANALIZA_DB_TRANSPORT: 'tcp',
    ANALIZA_FILE_STORAGE: 'gcs',
    PGHOST: 'db',
    PGPORT: '5432',
  };
  const keys = Object.keys(privateEnv).filter((key) =>
    /^(PG(HOST|PORT|DATABASE|USER|PASSWORD)|ANALIZA_(QA_|MIGRATION_|PG_RUNTIME_|PROVISION_))/.test(
      key,
    ),
  );
  return spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '--read-only',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--network',
      names.network,
      ...keys.flatMap((key) => ['--env', key]),
      operatorImage,
      ...args,
    ],
    { env: privateEnv, encoding: 'utf8', timeout: 120000 },
  );
}
assert.equal(imageInfo.Os, 'linux');
assert.equal(imageInfo.Architecture, 'amd64');
assert.equal(imageInfo.Config.User, 'node');
assert.ok(imageInfo.Config.Env.includes('PORT=8080'));
assert.ok(imageInfo.Config.Env.includes('ANALIZA_DATA_MODE=postgresql'));
assert.ok(
  !imageInfo.Config.Env.some((e) =>
    /^(PGPASSWORD|MONGODB_URI|GOOGLE_APPLICATION_CREDENTIALS)=/.test(e),
  ),
);
await writeFile(
  out + '/image.json',
  JSON.stringify(
    {
      id: imageInfo.Id,
      repoDigests: imageInfo.RepoDigests,
      architecture: imageInfo.Architecture,
      os: imageInfo.Os,
      user: imageInfo.Config.User,
      labels: imageInfo.Config.Labels,
    },
    null,
    2,
  ),
);
// A dedicated bridge isolates this run from other Docker projects. Only loopback is published.
docker(['network', 'create', names.network]);
docker(
  [
    'run',
    '-d',
    '--name',
    names.db,
    '--network',
    names.network,
    '--network-alias',
    'db',
    '-p',
    `127.0.0.1:${await freePort()}:5432`,
    '--env',
    'POSTGRES_PASSWORD',
    '--env',
    'POSTGRES_DB=analiza_qa',
    'postgres:18-bookworm',
  ],
  { env: { ...process.env, POSTGRES_PASSWORD: secret } },
);
const dbPort = Number(docker(['port', names.db, '5432/tcp']).split(':').at(-1));
const operatorEnv = {
  ...process.env,
  PGHOST: '127.0.0.1',
  PGPORT: String(dbPort),
  PGDATABASE: 'analiza_qa',
  PGUSER: 'postgres',
  PGPASSWORD: secret,
  ANALIZA_QA_PASSWORD: qaSecret,
  ANALIZA_MIGRATION_APPROVED: '1',
  ANALIZA_PG_RUNTIME_ROLE: 'analiza_runtime',
  ANALIZA_QA_MODE: '1',
};
const connect = async (env) => {
  const c = new Client({
    host: env.PGHOST,
    port: Number(env.PGPORT),
    database: env.PGDATABASE,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    connectionTimeoutMillis: 3000,
  });
  c.on('error', () => {});
  await c.connect();
  return c;
};
let admin;
for (let i = 0; i < 60; i++) {
  try {
    admin = await connect(operatorEnv);
    break;
  } catch {
    await delay(500);
  }
}
assert.ok(admin, 'PostgreSQL 18 local QA startup');
const databaseVersion = (await admin.query('SHOW server_version')).rows[0].server_version;
await admin.query(
  'CREATE ROLE analiza_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD ' +
    admin.escapeLiteral(appSecret),
);
const migrationSecret = randomBytes(32).toString('base64url');
await admin.query(
  'CREATE ROLE analiza_migrator LOGIN NOINHERIT PASSWORD ' + admin.escapeLiteral(migrationSecret),
);
await admin.query('GRANT CREATE ON DATABASE analiza_qa TO analiza_migrator');
for (const operation of ['--migrate', '--migrate', '--seed-synthetic']) {
  const p = runOperator([operation], {
    ...operatorEnv,
    PGUSER: 'analiza_migrator',
    PGPASSWORD: migrationSecret,
  });
  await writeFile(out + '/' + operation.slice(2) + '.log', p.stdout + p.stderr);
  assert.equal(p.status, 0, operation + ' must pass');
}
await writeFile(
  out + '/migration-identity.json',
  JSON.stringify({
    role: 'analiza_migrator',
    superuser: false,
    bypassRls: false,
    repeatedMigrations: true,
    seedWithForcedRls: true,
  }),
);
const provisionSecret = randomBytes(32).toString('base64url');
const provisionEnv = {
  ...operatorEnv,
  ANALIZA_PG_RUNTIME_ROLE: 'analiza_provision_probe',
  ANALIZA_PG_RUNTIME_PASSWORD: provisionSecret,
  ANALIZA_PROVISION_RUNTIME_APPROVED: '1',
};
for (let attempt = 0; attempt < 2; attempt++) {
  const p = runOperator(['--migrate', '--provision-runtime'], provisionEnv);
  assert.equal(p.status, 0, 'Explicit runtime provisioning must pass and be repeatable');
}
const mismatch = runOperator(['--migrate', '--provision-runtime'], {
  ...provisionEnv,
  ANALIZA_PG_RUNTIME_PASSWORD: randomBytes(32).toString('base64url'),
});
assert.notEqual(
  mismatch.status,
  0,
  'Existing role with a mismatched secret must fail instead of reporting success',
);
await writeFile(
  out + '/runtime-provisioning.json',
  JSON.stringify({
    createdAndRepeated: true,
    mismatchedSecretRejected: true,
    passwordsPrinted: false,
  }),
);
const runtimeEnv = { ...operatorEnv, PGUSER: 'analiza_runtime', PGPASSWORD: appSecret };
const limited = await connect(runtimeEnv);
assert.equal(
  (await limited.query('SELECT count(*)::int AS n FROM analiza.patients')).rows[0].n,
  0,
  'RLS defaults to no tenant',
);
await assert.rejects(limited.query('DELETE FROM analiza.patients'), (e) => e.code === '42501');
await assert.rejects(
  limited.query('UPDATE analiza.audit_events SET action=$1', ['FORGED']),
  (e) => e.code === '42501',
);
await assert.rejects(
  limited.query('CREATE TABLE analiza.forbidden(id int)'),
  (e) => e.code === '42501',
);
docker([
  'run',
  '-d',
  '--name',
  names.gcs,
  '--network',
  names.network,
  '--network-alias',
  'gcs',
  '-p',
  `127.0.0.1:${await freePort()}:4443`,
  'fsouza/fake-gcs-server:1.54.0',
  '-scheme',
  'http',
  '-port',
  '4443',
  '-external-url',
  'http://gcs:4443',
  '-public-host',
  'gcs:4443',
]);
const gcsPort = Number(docker(['port', names.gcs, '4443/tcp']).split(':').at(-1));
for (let i = 0; i < 40; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${gcsPort}/storage/v1/b?project=analiza-local-qa`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'analiza-private-qa' }),
    });
    if (r.ok || r.status === 409) break;
  } catch {}
  if (i === 39) throw Error('Local GCS emulator failed');
  await delay(500);
}
const envPath = out + '/runtime.env';
await writeFile(
  envPath,
  `ANALIZA_DB_TRANSPORT=tcp\nPGHOST=db\nPGPORT=5432\nPGDATABASE=analiza_qa\nPGUSER=analiza_runtime\nPGPASSWORD=${appSecret}\nPGPOOL_MAX=5\nANALIZA_QA_MODE=1\nANALIZA_FILE_STORAGE=gcs\nGCS_PRIVATE_BUCKET=analiza-private-qa\nANALIZA_QA_STORAGE_EMULATOR=http://gcs:4443\n`,
);
docker([
  'run',
  '-d',
  '--name',
  names.web,
  '--network',
  names.network,
  '-p',
  `127.0.0.1:${await freePort()}:8080`,
  '--read-only',
  '--tmpfs',
  '/tmp',
  '--tmpfs',
  '/app/apps/web/.next/cache:uid=1000,gid=1000',
  '--cap-drop',
  'ALL',
  '--security-opt',
  'no-new-privileges',
  '--env-file',
  envPath,
  image,
]);
const port = Number(docker(['port', names.web, '8080/tcp']).split(':').at(-1)),
  base = `http://localhost:${port}`;
await writeFile(
  out + '/resources.json',
  JSON.stringify({ run, names, base, image: imageInfo.Id, dbPort, gcsPort }, null, 2),
);
const passed = [];
async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + '/api/health', { signal: AbortSignal.timeout(6000) })).ok) return;
    } catch {}
    await delay(500);
  }
  throw Error('Final PostgreSQL image readiness failed');
}
await ready();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const clients = [];
async function login(email) {
  const context = await request.newContext({ baseURL: base });
  clients.push(context);
  const csrf = await (await context.get('/api/auth/csrf')).json();
  const response = await context.post('/api/auth/login', {
    headers: { 'x-analiza-csrf': csrf.csrfToken },
    data: { email, password: qaSecret },
  });
  assert.equal(response.status(), 200, 'PostgreSQL login');
  return { context, csrf: (await response.json()).csrfToken };
}
const mutate = async (c, path, data, status = 200, method = 'POST') => {
  const r = await c.context.fetch(path, { method, headers: { 'x-analiza-csrf': c.csrf }, data });
  assert.equal(r.status(), status, `${method} ${path}: ${await r.text()}`);
  return r.json();
};
try {
  assert.equal((await fetch(base + '/api/health/live')).status, 200);
  const a = await login('qa-admin@example.test'),
    b = await login('qa-admin-b@example.test'),
    c = await login('qa-foreign@example.test'),
    nurse = await login('qa-nurse@example.test'),
    finance = await login('qa-finance@example.test');
  for (const role of ['doctor', 'inventory', 'auditor']) await login(`qa-${role}@example.test`);
  assert.equal((await fetch(base + '/api/patients')).status, 401);
  assert.equal((await a.context.post('/api/patients', { data: {} })).status(), 403);
  passed.push('PostgreSQL health, 8 independent account sessions, anonymous denial and CSRF');
  const registration = await verifyPostgresRegistration({ base, admin, limited, clients, finance });
  passed.push(
    'PostgreSQL registration and onboarding: atomic rollback, concurrent versions, tenant RLS, CSRF, permissions and no DELETE',
  );
  const pageContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
    page = await pageContext.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/login');
  await page.locator('[data-action-id="AUTH-LOGIN-EMAIL"]').fill('qa-admin@example.test');
  await page.locator('[data-action-id="AUTH-LOGIN-PASSWORD"]').fill(qaSecret);
  await page.locator('[data-action-id="AUTH-LOGIN"]').click();
  await page.waitForURL('**/dashboard');
  await page.goto(base + '/patients');
  await page.locator('[data-action-id="PATIENT-CREATE"]').click();
  const dialog = page.getByRole('dialog', { name: 'Agregar paciente' });
  await dialog.getByLabel('Tipo de documento').selectOption('OTHER');
  await dialog.getByLabel('Número de documento').fill(run);
  await dialog.getByLabel('Nombre completo').fill('Paciente ficticio SQL');
  await dialog.getByLabel('Fecha de nacimiento').fill('1990-01-01');
  await dialog.getByLabel('Femenino').check();
  await dialog.getByLabel('Teléfono celular').fill('7000-0000');
  await dialog.getByLabel('Empresa', { exact: true }).fill('Empresa demo');
  await dialog.getByRole('option', { name: 'Empresa demo', exact: true }).click();
  await dialog
    .getByRole('textbox', { name: 'Dirección obligatorio', exact: true })
    .fill('Dirección ficticia QA');
  await dialog.getByLabel('Comentarios relevantes de la dirección').fill('Sin datos reales');
  const storageBefore = await page.evaluate(() => JSON.stringify(localStorage));
  await dialog.locator('[data-action-id="PATIENT-SAVE"]').click();
  await dialog.waitFor({ state: 'hidden' });
  let workspace = await (await a.context.get('/api/workspace')).json();
  let patient = workspace.patients.find((p) => p.documentId === run);
  assert.ok(patient, 'React patient persisted in PostgreSQL');
  assert.equal(
    (await limited.query('SELECT count(*)::int AS n FROM analiza.patients')).rows[0].n,
    0,
    'RLS without tenant hides a populated table',
  );
  await limited.query('BEGIN');
  await limited.query("SELECT set_config('analiza.organization_id',$1,true)", ['qa-org-c']);
  assert.equal(
    (
      await limited.query(
        'SELECT count(*)::int AS n FROM analiza.patients WHERE organization_id=$1',
        ['qa-org-a'],
      )
    ).rows[0].n,
    0,
    'RLS rejects foreign SELECT independent of HTTP',
  );
  await assert.rejects(
    limited.query(
      'INSERT INTO analiza.patients(organization_id,id,document_key,body) VALUES($1,$2,$3,$4)',
      [
        'qa-org-a',
        run + '-rls-forged',
        run + '-rls-forged',
        JSON.stringify({ ...patient, id: run + '-rls-forged' }),
      ],
    ),
    (e) => e.code === '42501',
  );
  await limited.query('ROLLBACK');
  patient = await mutate(
    a,
    `/api/patients/${patient.id}`,
    {
      patient: { ...patient, fullName: 'Paciente SQL editado' },
      expectedVersion: workspace.patientVersions[patient.id],
    },
    200,
    'PUT',
  );
  assert.equal(
    (await (await b.context.get('/api/patients/' + patient.id)).json()).fullName,
    'Paciente SQL editado',
  );
  assert.equal((await c.context.get('/api/patients/' + patient.id)).status(), 404);
  await mutate(c, '/api/patients/' + patient.id, { patient, expectedVersion: 2 }, 409, 'PUT');
  await mutate(a, '/api/patients/' + patient.id, { patient, expectedVersion: 1 }, 409, 'PUT');
  await mutate(finance, '/api/patients', { patient: { ...patient, id: run + '-denied' } }, 403);
  await mutate(
    a,
    '/api/patients',
    { patient: { ...patient, id: run + '-authority', organizationId: 'qa-org-c' } },
    400,
  );
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), storageBefore);
  passed.push(
    'React patient create; versioned edit; session B read; foreign tenant, role, stale version and forged tenant rejected',
  );
  await mutate(a, '/api/operations', {
    command: 'configuration.save',
    entry: {
      id: run + '-specialty',
      category: 'SPECIALTY',
      label: 'Especialidad ficticia QA',
      active: true,
    },
  });
  await page.goto(base + '/doctors');
  await page.locator('[data-action-id="DOCTOR-CREATE"]').click();
  const dd = page.getByRole('dialog', { name: 'Nuevo médico' });
  await dd.getByLabel('Nombre completo').fill('Médico ficticio SQL');
  await dd.getByLabel('JVPM', { exact: true }).fill(run);
  await dd.getByLabel('DUI', { exact: true }).fill('00000000-0');
  await dd.getByLabel('Especialidad o profesión').fill('Especialidad ficticia QA');
  await dd.getByRole('option', { name: 'Especialidad ficticia QA', exact: true }).click();
  await dd.getByLabel('Dirección', { exact: true }).fill('Dirección ficticia');
  await dd.locator('[data-action-id="DOCTOR-SAVE"]').click();
  await dd.waitFor({ state: 'hidden' });
  workspace = await (await a.context.get('/api/workspace')).json();
  let doctor = workspace.doctors.find((d) => d.jvpm === run);
  assert.ok(doctor);
  doctor = await mutate(
    a,
    '/api/doctors/' + doctor.id,
    { doctor: { ...doctor, address: 'Dirección ficticia editada' }, expectedVersion: 1 },
    200,
    'PUT',
  );
  assert.equal((await c.context.get('/api/doctors/' + doctor.id)).status(), 404);
  const hospitalization = {
    id: run + '-case',
    patientId: patient.id,
    startDate: '2026-09-14',
    status: 'ACTIVE',
    accountType: 'PARTICULAR',
    assignedNursingResourceIds: ['qa-resource'],
  };
  const created = await mutate(a, '/api/hospitalizations', { hospitalization }, 201);
  assert.deepEqual(created.assignedNurseUserIds, ['qa-nurse']);
  await mutate(
    a,
    '/api/hospitalizations/' + hospitalization.id,
    {
      hospitalization: { ...hospitalization, nextAction: 'Seguimiento ficticio' },
      expectedVersion: 1,
    },
    200,
    'PUT',
  );
  await mutate(
    nurse,
    '/api/hospitalizations',
    { hospitalization: { ...hospitalization, id: run + '-denied-case' } },
    403,
  );
  assert.equal((await c.context.get('/api/hospitalizations/' + hospitalization.id)).status(), 404);
  passed.push(
    'React doctor create and API edit; hospitalization create/edit with active assigned nurse; role and organization denials',
  );
  const shift = {
    id: run + '-shift',
    resourceId: 'qa-resource',
    patientId: patient.id,
    startsAt: '2026-12-10T08:00:00Z',
    endsAt: '2026-12-10T14:00:00Z',
    status: 'SCHEDULED',
  };
  const input = { shifts: [shift], idempotencyKey: run + '-series' };
  await mutate(a, '/api/shifts', input, 201);
  await mutate(a, '/api/shifts', input, 201);
  await mutate(
    a,
    '/api/shifts',
    { shifts: [{ ...shift, id: run + '-collision' }], idempotencyKey: run + '-collision' },
    400,
  );
  const conflicts = await Promise.all(
    ['a', 'b'].map((s) =>
      a.context.post('/api/shifts', {
        headers: { 'x-analiza-csrf': a.csrf },
        data: {
          shifts: [
            {
              ...shift,
              id: run + '-race-' + s,
              startsAt: '2026-12-11T08:00:00Z',
              endsAt: '2026-12-11T14:00:00Z',
            },
          ],
          idempotencyKey: run + '-race-' + s,
        },
      }),
    ),
  );
  assert.deepEqual(conflicts.map((r) => r.status()).sort(), [201, 400]);
  passed.push('Shift creation, idempotent retry, existing and concurrent scheduling conflicts');
  const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1kAAAAASUVORK5CYII=',
      'base64',
    ),
    files = [];
  for (const [ownerType, ownerId] of [
    ['patient', patient.id],
    ['doctor', doctor.id],
    ['hospitalization', hospitalization.id],
  ]) {
    const r = await a.context.post('/api/files', {
      headers: { 'x-analiza-csrf': a.csrf },
      multipart: {
        ownerType,
        ownerId,
        file: { name: 'archivo-ficticio.png', mimeType: 'image/png', buffer: png },
      },
    });
    assert.equal(r.status(), 201, 'Private upload');
    const id = (await r.json()).id;
    files.push(id);
    const downloaded = await b.context.get('/api/files/' + id);
    assert.equal(downloaded.status(), 200);
    assert.deepEqual(await downloaded.body(), png);
    assert.equal((await c.context.get('/api/files/' + id)).status(), 404);
  }
  passed.push(
    'GCS SDK with explicit local emulator: real bytes, private metadata, authorized second session and foreign denial',
  );
  for (const route of [
    '/dashboard',
    '/patients',
    '/hospitalizations',
    '/agenda',
    '/doctors',
    '/nursing-team',
    '/catalogs/operational',
  ]) {
    await page.goto(base + route);
    await page.locator('h1').waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  }
  await page.screenshot({ path: out + '/desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/hospitalizations');
  await page.locator('h1').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: out + '/mobile.png' });
  await page.goto(base + '/patients');
  await page.locator('[data-action-id="PATIENT-CREATE"]').click();
  const failDialog = page.getByRole('dialog', { name: 'Agregar paciente' });
  await failDialog.getByLabel('Tipo de documento').selectOption('OTHER');
  await failDialog.getByLabel('Número de documento').fill(run + '-outage');
  await failDialog.getByLabel('Nombre completo').fill('Paciente ficticio rechazado');
  await failDialog.getByLabel('Fecha de nacimiento').fill('1990-01-01');
  await failDialog.getByLabel('Femenino').check();
  await failDialog.getByLabel('Teléfono celular').fill('7000-0000');
  await failDialog.getByLabel('Empresa', { exact: true }).fill('Empresa demo');
  await failDialog.getByRole('option', { name: 'Empresa demo', exact: true }).click();
  await failDialog
    .getByRole('textbox', { name: 'Dirección obligatorio', exact: true })
    .fill('Dirección ficticia QA');
  await failDialog.getByLabel('Comentarios relevantes de la dirección').fill('Sin datos reales');
  docker(['stop', '--time', '10', names.db]);
  await registration.outage();
  await failDialog.locator('[data-action-id="PATIENT-SAVE"]').click();
  await failDialog
    .getByText('El acceso seguro no está disponible.', { exact: false })
    .waitFor({ timeout: 25000 });
  assert.ok(await failDialog.isVisible());
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), storageBefore);
  await page.screenshot({ path: out + '/sql-outage.png' });
  docker(['start', names.db]);
  await ready();
  // The test operator connections were severed by the outage; reconnect explicitly.
  await admin.end().catch(() => {});
  admin = await connect(operatorEnv);
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int AS n FROM analiza.patients WHERE body->>'documentId'=$1",
        [run + '-outage'],
      )
    ).rows[0].n,
    0,
  );
  passed.push(
    'Real SQL outage: failed save stays open, no localStorage write, no success and no database record',
  );
  // Reproduce zero-byte browser/proxy preconnections deterministically.
  const preconnections = await Promise.all(
    [1, 2].map(
      () =>
        new Promise((resolve, reject) => {
          const socket = createConnection({ host: '127.0.0.1', port }, () => resolve(socket));
          socket.on('error', reject);
        }),
    ),
  );
  docker(['stop', '--time', '10', names.web]);
  assert.equal(
    JSON.parse(docker(['inspect', names.web]))[0].State.ExitCode,
    143,
    'Next graceful SIGTERM (128 + 15)',
  );
  preconnections.forEach((socket) => socket.destroy());
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name='analiza-web'",
      )
    ).rows[0].n,
    0,
    'Pool connections close after stop',
  );
  docker(['start', names.web]);
  await ready();
  await registration.persistent();
  assert.equal(
    (await (await b.context.get('/api/patients/' + patient.id)).json()).fullName,
    'Paciente SQL editado',
  );
  assert.equal((await b.context.get('/api/hospitalizations/' + hospitalization.id)).status(), 200);
  assert.equal((await c.context.get('/api/patients/' + patient.id)).status(), 404);
  for (const id of files)
    assert.deepEqual(await (await b.context.get('/api/files/' + id)).body(), png);
  assert.equal(
    (await admin.query('SELECT count(*)::int AS n FROM analiza.shifts WHERE id=$1', [shift.id]))
      .rows[0].n,
    1,
  );
  passed.push(
    'Web container restart: external PostgreSQL data, sessions, GCS emulator bytes and tenant isolation persist; graceful pool shutdown',
  );
  const timings = await Promise.all(
    Array.from({ length: 30 }, async () => {
      const start = performance.now();
      assert.equal((await b.context.get('/api/workspace')).status(), 200);
      return performance.now() - start;
    }),
  );
  const connections = (
    await admin.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name='analiza-web'",
    )
  ).rows[0].n;
  assert.ok(connections <= 5, 'Bounded PostgreSQL pool');
  await admin.query('UPDATE analiza.users SET disabled_at=now() WHERE id=$1', ['qa-admin-b']);
  assert.equal(
    (await b.context.get('/api/patients')).status(),
    401,
    'Disabled user loses existing session access',
  );
  await admin.query('UPDATE analiza.users SET disabled_at=NULL WHERE id=$1', ['qa-admin-b']);
  // Hold a real SQL lock while SIGTERM arrives. The statement must time out and roll back
  // within Cloud Run's grace; a synchronous docker stop deliberately keeps the lock held.
  await admin.query('BEGIN');
  await admin.query('LOCK TABLE analiza.patients IN ACCESS EXCLUSIVE MODE');
  const blockedSave = b.context.put('/api/patients/' + patient.id, {
    headers: { 'x-analiza-csrf': b.csrf },
    data: { patient: { ...patient, fullName: 'No debe confirmarse' }, expectedVersion: 2 },
  });
  await delay(500);
  const shutdownStart = performance.now();
  docker(['stop', '--time', '10', names.web]);
  assert.equal(
    JSON.parse(docker(['inspect', names.web]))[0].State.ExitCode,
    143,
    'SIGTERM under SQL lock must drain without SIGKILL',
  );
  assert.ok(performance.now() - shutdownStart < 10000, 'SQL shutdown grace');
  assert.equal((await blockedSave).status(), 503, 'Locked write cannot report success');
  await admin.query('ROLLBACK');
  docker(['start', names.web]);
  await ready();
  assert.equal(
    (await (await b.context.get('/api/patients/' + patient.id)).json()).fullName,
    'Paciente SQL editado',
  );
  passed.push(
    'SIGTERM with a real blocked SQL mutation: timeout, rollback, HTTP 503 and exit 143 within 10 seconds',
  );
  const logout = await b.context.post('/api/auth/logout', {
    headers: { 'x-analiza-csrf': b.csrf },
  });
  assert.equal(logout.status(), 200);
  assert.equal((await b.context.get('/api/patients')).status(), 401);
  assert.equal((await a.context.get('/api/quotes')).status(), 404, 'Quotes remain outside Core');
  assert.deepEqual(errors, []);
  passed.push(
    '30 concurrent workspace reads, pool <=5 connections, logout revocation, Core scope and browser errors',
  );
  await writeFile(
    out + '/report.json',
    JSON.stringify(
      {
        passed: true,
        run,
        image: imageInfo.Id,
        sourceSha: imageInfo.Config.Labels['org.opencontainers.image.revision'],
        base,
        checks: passed,
        connections,
        p95Ms: Math.round(timings.sort((a, b) => a - b)[28]),
        database: 'PostgreSQL 18 local QA',
        databaseVersion,
        storage: 'Google SDK + local GCS emulator; real GCS/IAM pending',
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, run, report: out + '/report.json', checks: passed }));
} catch (error) {
  await writeFile(
    out + '/report.json',
    JSON.stringify(
      {
        passed: false,
        run,
        image: imageInfo.Id,
        checks: passed,
        error: String(error).replaceAll(qaSecret, '[redacted]').replaceAll(secret, '[redacted]'),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await Promise.all(clients.map((c) => c.dispose()));
  await browser.close();
  await admin.end().catch(() => {});
  await limited.end().catch(() => {});
}
