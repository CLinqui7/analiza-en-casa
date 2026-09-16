// Isolated Linux verification of the Ubuntu contract: PostgreSQL and web share only a Unix socket.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { request } from '@playwright/test';

const webImage = process.env.ANALIZA_VERIFY_IMAGE || 'analiza-web:selfhosted';
const operatorImage = process.env.ANALIZA_VERIFY_OPERATOR_IMAGE || 'analiza-operator:postgresql';
const run = `analiza-ubuntu-${Date.now()}`;
const names = {
  db: `${run}-postgres18`,
  web: `${run}-web`,
  socket: `${run}-socket`,
  data: `${run}-pgdata`,
  files: `${run}-files`,
};
const output = `.local/ubuntu-selfhosted/${run}`;
const migrationPassword = randomBytes(32).toString('base64url');
const runtimePassword = randomBytes(32).toString('base64url');
const accountPassword = randomBytes(24).toString('base64url');
const database = 'analiza_en_casa';
const migrator = 'analiza_migrator';
const runtime = 'analiza_app';
const secrets = [migrationPassword, runtimePassword, accountPassword];
const redact = (value) =>
  secrets.reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(value));

function command(args, options = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: 300_000,
    ...options,
  });
  if (result.status !== 0)
    throw new Error(`docker ${args[0]} failed: ${redact(result.stderr || result.stdout)}`);
  return result.stdout.trim();
}

function attempt(args) {
  return spawnSync('docker', args, { encoding: 'utf8', timeout: 30_000 });
}

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

async function waitFor(check, label, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    if (await check()) return;
    await delay(1000);
  }
  throw new Error(`${label} did not become ready`);
}

await mkdir(output, { recursive: true });
const port = await freePort();
// Browsers treat localhost as a secure cookie context; the port remains bound to loopback only.
const base = `http://localhost:${port}`;
const clients = [];
const checks = [];

try {
  for (const volume of [names.socket, names.data, names.files])
    command(['volume', 'create', volume]);
  command([
    'run',
    '-d',
    '--name',
    names.db,
    '--restart',
    'no',
    '-e',
    `POSTGRES_DB=${database}`,
    '-e',
    `POSTGRES_USER=${migrator}`,
    '-e',
    `POSTGRES_PASSWORD=${migrationPassword}`,
    '-v',
    `${names.data}:/var/lib/postgresql`,
    '-v',
    `${names.socket}:/var/run/postgresql`,
    'postgres:18-bookworm',
    '-c',
    'listen_addresses=',
    '-c',
    'unix_socket_permissions=0770',
    '-c',
    'password_encryption=scram-sha-256',
  ]);
  await waitFor(
    () =>
      attempt([
        'exec',
        names.db,
        'pg_isready',
        '-h',
        '/var/run/postgresql',
        '-U',
        migrator,
        '-d',
        database,
      ]).status === 0,
    'PostgreSQL socket',
  );
  const socketGid = command(['exec', names.db, 'id', '-g', 'postgres']);
  command([
    'exec',
    '--user',
    'postgres',
    names.db,
    'sh',
    '-ec',
    `printf 'local all all scram-sha-256\\n' | cat - "$PGDATA/pg_hba.conf" > /tmp/pg_hba.conf && cat /tmp/pg_hba.conf > "$PGDATA/pg_hba.conf" && pg_ctl reload`,
  ]);
  checks.push('PostgreSQL 18 reachable through a shared Unix socket with SCRAM');

  command([
    'run',
    '--rm',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--user',
    '1000:1000',
    '--group-add',
    socketGid,
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,uid=1000,gid=1000',
    '-v',
    `${names.socket}:/var/run/postgresql:ro`,
    '-e',
    'PGHOST=/var/run/postgresql',
    '-e',
    'PGPORT=5432',
    '-e',
    `PGDATABASE=${database}`,
    '-e',
    `PGUSER=${migrator}`,
    '-e',
    `PGPASSWORD=${migrationPassword}`,
    '-e',
    `ANALIZA_PG_RUNTIME_ROLE=${runtime}`,
    '-e',
    `ANALIZA_PG_RUNTIME_PASSWORD=${runtimePassword}`,
    '-e',
    'ANALIZA_MIGRATION_APPROVED=1',
    '-e',
    'ANALIZA_ENVIRONMENT=selfhosted',
    '-e',
    'ANALIZA_DB_TRANSPORT=unix',
    '-e',
    'ANALIZA_SELFHOSTED_PROVISION_APPROVED=1',
    '-e',
    'ANALIZA_PROVISION_RUNTIME_APPROVED=1',
    operatorImage,
    '--migrate',
    '--provision-runtime',
  ]);
  checks.push('Explicit operator migration and restricted runtime-role provisioning over Unix');

  command([
    'run',
    '--rm',
    '--user',
    'root',
    '-v',
    `${names.files}:/data/private-files`,
    '--entrypoint',
    '/bin/sh',
    webImage,
    '-ec',
    'chown 1000:1000 /data/private-files && chmod 0700 /data/private-files',
  ]);

  const webArgs = [
    'run',
    '-d',
    '--name',
    names.web,
    '--restart',
    'no',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--user',
    '1000:1000',
    '--group-add',
    socketGid,
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,uid=1000,gid=1000,mode=1777',
    '--tmpfs',
    '/app/apps/web/.next/cache:rw,noexec,nosuid,uid=1000,gid=1000,mode=0700',
    '-p',
    `127.0.0.1:${port}:8080`,
    '-v',
    `${names.socket}:/var/run/postgresql:ro`,
    '-v',
    `${names.files}:/data/private-files`,
    '-e',
    'PORT=8080',
    '-e',
    'HOSTNAME=0.0.0.0',
    '-e',
    'ANALIZA_DATA_MODE=postgresql',
    '-e',
    'ANALIZA_REGISTRATION_MODE=isolated',
    '-e',
    'ANALIZA_DB_TRANSPORT=unix',
    '-e',
    'PGHOST=/var/run/postgresql',
    '-e',
    'PGPORT=5432',
    '-e',
    `PGDATABASE=${database}`,
    '-e',
    `PGUSER=${runtime}`,
    '-e',
    `PGPASSWORD=${runtimePassword}`,
    '-e',
    'PGPOOL_MAX=5',
    '-e',
    'ANALIZA_FILE_STORAGE=filesystem',
    '-e',
    'ANALIZA_FILES_PATH=/data/private-files',
    webImage,
  ];
  command(webArgs);
  await waitFor(async () => (await fetch(`${base}/api/health/live`).catch(() => null))?.ok, 'web');
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  checks.push('Liveness and PostgreSQL readiness through the final non-root image');

  async function register(email, password) {
    const context = await request.newContext({ baseURL: base });
    clients.push(context);
    const csrf = (await (await context.get('/api/auth/csrf')).json()).csrfToken;
    const response = await context.post('/api/auth/register', {
      headers: { origin: base, 'x-analiza-csrf': csrf },
      data: { displayName: 'Cuenta Ubuntu sintética', email, password },
    });
    assert.equal(response.status(), 201, await response.text());
    return { context, csrf: (await response.json()).csrfToken };
  }
  async function mutate(client, path, data, status = 200, method = 'POST') {
    const response = await client.context.fetch(path, {
      method,
      headers: { 'x-analiza-csrf': client.csrf },
      data,
    });
    assert.equal(response.status(), status, `${method} ${path}: ${await response.text()}`);
    return response.json();
  }

  const admin = await register(`ubuntu-${randomUUID()}@example.test`, accountPassword);
  const foreign = await register(`ubuntu-${randomUUID()}@example.test`, accountPassword);
  const patient = {
    id: randomUUID(),
    fullName: 'Paciente Ubuntu sintético',
    documentType: 'OTHER',
    documentId: `UBUNTU-${randomUUID().slice(0, 8)}`,
    status: 'ACTIVE',
  };
  await mutate(admin, '/api/patients', { patient }, 201);
  const edited = await mutate(
    admin,
    `/api/patients/${patient.id}`,
    { patient: { ...patient, fullName: 'Paciente Ubuntu editado' }, expectedVersion: 1 },
    200,
    'PUT',
  );
  assert.equal(edited.fullName, 'Paciente Ubuntu editado');
  assert.equal((await foreign.context.get(`/api/patients/${patient.id}`)).status(), 404);

  const nurseId = randomUUID();
  await mutate(admin, '/api/operations', {
    command: 'nurse.create',
    email: `nurse-${randomUUID()}@example.test`,
    password: randomBytes(24).toString('base64url'),
    resource: {
      id: nurseId,
      displayName: 'Enfermera Ubuntu sintética',
      territory: 'Zona sintética',
      shift: 'MORNING',
      availability: 'AVAILABLE',
      capacity: 1,
      boardRegistrationNumber: 'QA-UBUNTU',
    },
  });
  const hospitalization = {
    id: randomUUID(),
    patientId: patient.id,
    startDate: '2026-09-16',
    status: 'ACTIVE',
    accountType: 'PARTICULAR',
    assignedNursingResourceIds: [nurseId],
  };
  await mutate(admin, '/api/hospitalizations', { hospitalization }, 201);
  await mutate(
    admin,
    `/api/hospitalizations/${hospitalization.id}`,
    { hospitalization: { ...hospitalization, nextAction: 'Seguimiento' }, expectedVersion: 1 },
    200,
    'PUT',
  );
  const shift = {
    id: randomUUID(),
    resourceId: nurseId,
    patientId: patient.id,
    startsAt: '2026-12-10T08:00:00Z',
    endsAt: '2026-12-10T14:00:00Z',
    status: 'SCHEDULED',
  };
  await mutate(admin, '/api/shifts', { shifts: [shift], idempotencyKey: randomUUID() }, 201);
  checks.push(
    'Registration/login session, patient create/edit, hospitalization and shift over PostgreSQL',
  );

  const bytes = Buffer.from('private self-hosted file\n');
  const upload = await admin.context.post('/api/files', {
    headers: { 'x-analiza-csrf': admin.csrf },
    multipart: {
      ownerType: 'patient',
      ownerId: patient.id,
      file: { name: 'private.txt', mimeType: 'text/plain', buffer: bytes },
    },
  });
  assert.equal(upload.status(), 201, await upload.text());
  const file = await upload.json();
  assert.equal(file.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(await (await admin.context.get(`/api/files/${file.id}`)).body(), bytes);
  assert.equal((await foreign.context.get(`/api/files/${file.id}`)).status(), 404);
  assert.ok(
    Number(
      command([
        'run',
        '--rm',
        '-v',
        `${names.files}:/data:ro`,
        '--entrypoint',
        '/bin/sh',
        webImage,
        '-ec',
        'find /data/private -type f | wc -l',
      ]),
    ) >= 1,
  );
  checks.push('Filesystem upload/download, SHA256, private tenant denial and persisted bytes');

  command(['restart', '--time', '10', names.db]);
  await waitFor(
    async () => (await fetch(`${base}/api/health`).catch(() => null))?.status === 200,
    'database restart',
  );
  command(['restart', '--time', '10', names.web]);
  await waitFor(
    async () => (await fetch(`${base}/api/health`).catch(() => null))?.status === 200,
    'web restart',
  );
  assert.equal(
    (await (await admin.context.get(`/api/patients/${patient.id}`)).json()).fullName,
    'Paciente Ubuntu editado',
  );
  assert.equal(
    (await admin.context.get(`/api/hospitalizations/${hospitalization.id}`)).status(),
    200,
  );
  assert.deepEqual(await (await admin.context.get(`/api/files/${file.id}`)).body(), bytes);
  checks.push('PostgreSQL, session and private file persistence after database and web restarts');

  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      {
        passed: true,
        run,
        webImage,
        operatorImage,
        transport: 'Unix socket shared between isolated PostgreSQL and application containers',
        storage: 'Docker volume mounted at /data/private-files',
        checks,
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, report: `${output}/report.json`, checks }));
} catch (error) {
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      { passed: false, run, checks, error: redact(error), checkedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await Promise.all(clients.map((client) => client.dispose()));
  for (const container of [names.web, names.db]) attempt(['rm', '-f', container]);
  for (const volume of [names.files, names.socket, names.data]) attempt(['volume', 'rm', volume]);
}
