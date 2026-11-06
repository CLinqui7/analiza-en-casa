import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, readdir, unlink, rmdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Synthetic, local operator-CLI checks. No server, credentials or database connection.
const directory = await mkdtemp(join(tmpdir(), 'analiza-doctors-qa-'));
const script = resolve('scripts/prepare-doctor-import.ts');
const config = resolve('apps/web/tsconfig.json');
const input = join(directory, 'synthetic.csv');
const snapshot = join(directory, 'synthetic-existing.json');
const output = join(directory, 'private-preview.json');
const run = (extra: string[]) =>
  spawnSync(process.execPath, ['--import', 'tsx', script, '--input', input, ...extra], {
    encoding: 'utf8',
    env: { ...process.env, TSX_TSCONFIG_PATH: config },
    timeout: 30_000,
  });
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
try {
  await writeFile(
    input,
    [
      'Nombre completo,Especialidad,Teléfono fijo,Nuevo o recurrente,DUI',
      ...Array.from(
        { length: 700 },
        (_, i) =>
          `Profesional sintético ${i},Especialidad sintética,2222-0000,Nuevo,${String(i).padStart(8, '0')}-1`,
      ),
    ].join('\n'),
    'utf8',
  );
  await writeFile(snapshot, JSON.stringify({ organizationId: 'synthetic-cli', doctors: [] }));
  const inputHash = sha(await readFile(input));
  const args = ['--organization', 'synthetic-cli', '--existing', snapshot, '--output', output];
  const first = run(args);
  assert.equal(first.status, 0, first.stderr);
  const summary = JSON.parse(first.stdout);
  assert.equal(summary.total, 700);
  assert.equal(summary.issues, 0);
  assert.equal(summary.mode, 'PREVIEW_ONLY');
  assert.equal(summary.readyForControlledImport, true);
  assert.ok(!first.stdout.includes('Profesional sintético'));
  const report = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(report.records[699].doctor.documentId, '00000699-1');
  assert.equal(report.sourceSha256, inputHash);
  const reportHash = sha(await readFile(output));
  assert.equal(run(args).status, 1, 'Existing report must never be overwritten');
  assert.equal(sha(await readFile(output)), reportHash);
  assert.equal(sha(await readFile(input)), inputHash);
  const wrongOrg = run([
    '--organization',
    'other-org',
    '--existing',
    snapshot,
    '--output',
    join(directory, 'wrong-org.json'),
  ]);
  assert.equal(wrongOrg.status, 1);
  assert.ok(!wrongOrg.stderr.includes('Profesional sintético'));
  await assert.rejects(stat(join(directory, 'wrong-org.json')));
  const inRepository = resolve(`.local/doctor-import-${Date.now()}-forbidden.json`);
  assert.equal(run(['--organization', 'synthetic-cli', '--output', inRepository]).status, 1);
  await assert.rejects(stat(inRepository));
  const noSnapshot = run([
    '--organization',
    'synthetic-cli',
    '--output',
    join(directory, 'not-reconciled.json'),
  ]);
  assert.equal(noSnapshot.status, 2);
  assert.equal(JSON.parse(noSnapshot.stdout).readyForControlledImport, false);
  if (process.platform === 'win32') {
    const acl = spawnSync('icacls.exe', [output], { encoding: 'utf8' });
    assert.equal(acl.status, 0);
    assert.ok(!acl.stdout.includes('(I)'), 'Private report must not inherit access');
    assert.ok(acl.stdout.includes('(F)'), 'Operator must retain access');
  } else assert.equal((await stat(output)).mode & 0o777, 0o600);
  console.log(
    JSON.stringify({
      status: 'PASS',
      rows: 700,
      checks: [
        'complete-cli-preview',
        'leading-zeros',
        'source-hash',
        'input-immutable',
        'output-no-overwrite',
        'organization-mismatch',
        'report-outside-git',
        'missing-reconciliation',
        'private-report-permissions',
        'no-records-in-stdout',
      ],
    }),
  );
} finally {
  // Only this fresh, known temp directory and its direct synthetic files are removed.
  for (const entry of await readdir(directory, { withFileTypes: true }))
    if (entry.isFile()) await unlink(join(directory, entry.name));
  await rmdir(directory);
}
