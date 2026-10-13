// Isolated Linux verification of the Ubuntu contract: PostgreSQL and web share only a Unix socket.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { request } from '@playwright/test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const webImage = process.env.ANALIZA_VERIFY_IMAGE || 'analiza-web:selfhosted';
const operatorImage = process.env.ANALIZA_VERIFY_OPERATOR_IMAGE || 'analiza-operator:postgresql';
const postgresImage = process.env.ANALIZA_VERIFY_POSTGRES_IMAGE || 'postgres:18-bookworm';
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
    '--network',
    'none',
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
    postgresImage,
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
    `printf 'local all all scram-sha-256\\n' | cat - "$PGDATA/pg_hba.conf" > /tmp/pg_hba.conf && cat /tmp/pg_hba.conf > "$PGDATA/pg_hba.conf"`,
  ]);
  await waitFor(
    () => attempt(['exec', '--user', 'postgres', names.db, 'pg_ctl', 'reload']).status === 0,
    'PostgreSQL SCRAM reload',
    30,
  );
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
  const template = await readFile('apps/web/public/templates/plantilla_carga_analiza_en_casa.xlsx');
  function importFixture(serviceId, { currency = 'USD', rateId = 'QA-RATE' } = {}) {
    const files = unzipSync(template);
    const rows = [
      [
        3,
        {
          A: serviceId,
          B: `Servicio QA sintético ${serviceId}`,
          C: 'Enfermeria',
          E: 'Visita',
          G: 31.3528,
          ...(currency ? { H: currency } : {}),
          L: 'Activo',
        },
      ],
      [
        7,
        {
          A: rateId,
          B: serviceId.toLowerCase(),
          E: 20.125,
          F: 'USD',
          K: '2026-10-01',
          L: '2027-01-01',
          M: 'Activo',
        },
      ],
    ];
    for (const [index, values] of rows) {
      const path = `xl/worksheets/sheet${index}.xml`;
      const row = `<row r="6">${Object.entries(values)
        .map(([column, value]) =>
          typeof value === 'number'
            ? `<c r="${column}6"><v>${value}</v></c>`
            : `<c r="${column}6" t="inlineStr"><is><t>${value}</t></is></c>`,
        )
        .join('')}</row>`;
      files[path] = strToU8(
        strFromU8(files[path]).replace(/<row\b[^>]*r="6"[^>]*>[\s\S]*?<\/row>/, row),
      );
    }
    return Buffer.from(zipSync(files));
  }
  const imported = importFixture('Qa-Case');
  async function sendImport(bytes, action) {
    return admin.context.post('/api/information-import', {
      headers: { 'x-analiza-csrf': admin.csrf },
      multipart: {
        action,
        file: {
          name: 'ubuntu-synthetic.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: bytes,
        },
      },
    });
  }
  const importPreview = await sendImport(imported, 'preview');
  assert.equal(importPreview.status(), 200, await importPreview.text());
  assert.equal((await importPreview.json()).ready, true);
  const importCommit = await sendImport(imported, 'import');
  assert.equal(importCommit.status(), 201, await importCommit.text());
  const repeated = await sendImport(imported, 'import');
  assert.equal(repeated.status(), 201, await repeated.text());
  const link = command([
    'exec',
    '-e',
    `PGPASSWORD=${migrationPassword}`,
    names.db,
    'psql',
    '-U',
    migrator,
    '-d',
    database,
    '-At',
    '-c',
    "SELECT target_record_id FROM analiza.import_record_links WHERE source_record_id='QA-RATE' AND relation='servicio_id'",
  ]);
  assert.equal(link, 'Qa-Case');
  const differentCase = await sendImport(importFixture('QA-CASE'), 'import');
  assert.equal(differentCase.status(), 400, await differentCase.text());
  const unpriced = await sendImport(
    importFixture('No-Currency', { currency: '', rateId: 'QA-RATE-NOCURRENCY' }),
    'import',
  );
  assert.equal(unpriced.status(), 201, await unpriced.text());
  const catalog = (await (await admin.context.get('/api/workspace')).json()).catalogItems;
  const pricedService = catalog.find((item) => item.id === 'Qa-Case');
  const pendingService = catalog.find((item) => item.id === 'No-Currency');
  assert.equal(pricedService?.salePriceExcludingTax, 31.3528);
  assert.equal(pendingService?.salePriceExcludingTax, undefined);
  const correctedPending = await mutate(admin, '/api/operations', {
    command: 'catalog.save',
    item: { ...pendingService, name: 'Servicio QA revisado' },
  });
  assert.equal(correctedPending.name, 'Servicio QA revisado');
  const unsafeActivation = await admin.context.post('/api/operations', {
    headers: { 'x-analiza-csrf': admin.csrf },
    data: { command: 'catalog.save', item: { ...correctedPending, status: 'ACTIVE' } },
  });
  assert.equal(unsafeActivation.status(), 400, await unsafeActivation.text());
  const activeService = await mutate(admin, '/api/operations', {
    command: 'catalog.save',
    item: { ...pricedService, status: 'ACTIVE' },
  });
  assert.equal(activeService.status, 'ACTIVE');
  assert.equal((await (await foreign.context.get('/api/workspace')).json()).catalogItems.length, 0);
  checks.push(
    'Synthetic Excel idempotency, references, tenant isolation, catalog corrections and unconfirmed-currency activation denial',
  );

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
  const quote = {
    id: randomUUID(),
    patientId: patient.id,
    version: 1,
    status: 'DRAFT',
    summary: 'Cotización QA sintética',
    immutable: false,
    createdAt: new Date().toISOString(),
    insurerAmount: 0,
    items: [
      {
        id: randomUUID(),
        category: 'SERVICES',
        name: activeService.name,
        inventoryItemId: activeService.id,
        quantity: 1,
        unitPrice: activeService.salePriceExcludingTax,
        discountAmount: 0,
      },
    ],
  };
  const createdQuote = await mutate(admin, '/api/quotes', { quote }, 201);
  assert.ok(createdQuote.total > 0);
  assert.equal((await (await foreign.context.get('/api/quotes')).json()).quotes.length, 0);
  assert.equal(
    (await (await admin.context.get('/api/quotes')).json()).quotes[0].quote.id,
    quote.id,
  );
  checks.push('Active priced service relates to PostgreSQL quote; foreign tenant cannot list it');

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
  const restoredWorkspace = await (await admin.context.get('/api/workspace')).json();
  assert.equal(
    restoredWorkspace.quotes.some((entry) => entry.id === quote.id),
    true,
  );
  assert.equal(
    restoredWorkspace.catalogItems.some(
      (entry) => entry.id === pendingService.id && entry.status === 'INACTIVE',
    ),
    true,
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
        postgresImage,
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
