import { readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import {
  readDoctorImportFile,
  type DoctorSnapshot,
} from '../apps/web/src/server/doctor-import-preflight';
import { directoryHash, planDoctorDirectory } from '../apps/web/src/server/doctor-directory-import';
import {
  applyDoctorDirectory,
  type DirectoryManifest,
} from '../apps/web/src/server/persistence/postgres-doctor-directory';
import { postgresPool, closePostgresPool } from '../apps/web/src/server/persistence/postgres-pool';

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: 'string' },
      sheet: { type: 'string' },
      snapshot: { type: 'string' },
      organization: { type: 'string' },
      actor: { type: 'string' },
      output: { type: 'string' },
      manifest: { type: 'string' },
      'manifest-sha256': { type: 'string' },
      'expected-database': { type: 'string' },
      'historical-pending-approved': { type: 'boolean' },
      apply: { type: 'boolean' },
    },
  });
  if (!values.input) throw new Error('Falta fuente.');
  const bytes = await readFile(values.input);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const read = await readDoctorImportFile(bytes, '.xlsx', values.sheet);
  const source = { sha256, sheet: read.sheet, rows: read.rows };
  if (values.apply) {
    if (
      !values.manifest ||
      !values['manifest-sha256'] ||
      !values['expected-database'] ||
      values['expected-database'] !== process.env.PGDATABASE
    )
      throw new Error('Falta destino o manifiesto explícito.');
    const raw = await readFile(values.manifest);
    if (createHash('sha256').update(raw).digest('hex') !== values['manifest-sha256'])
      throw new Error('El manifiesto cambió.');
    const manifest = JSON.parse(raw.toString('utf8')) as DirectoryManifest;
    console.log(JSON.stringify(await applyDoctorDirectory(postgresPool(), source, manifest)));
  } else {
    if (!values.snapshot || !values.organization || !values.actor || !values.output)
      throw new Error('Faltan parámetros de planificación.');
    const snapshot = JSON.parse(await readFile(values.snapshot, 'utf8')) as DoctorSnapshot;
    if (snapshot.organizationId !== values.organization)
      throw new Error('Snapshot de otra organización.');
    const plan = planDoctorDirectory(source, snapshot, {
      allowIncompleteHistorical: values['historical-pending-approved'] === true,
    });
    const manifest: DirectoryManifest = {
      organizationId: values.organization,
      actorUserId: values.actor,
      sourceSha256: sha256,
      sourceSheet: source.sheet,
      snapshotSha256: plan.snapshotSha256,
      planSha256: directoryHash(plan),
      options: plan.options,
    };
    const output = resolve(
      await realpath(dirname(resolve(values.output))),
      values.output.split(/[\\/]/).at(-1)!,
    );
    const delta = relative(await realpath(process.cwd()), output);
    if (!delta || (!delta.startsWith('..') && !isAbsolute(delta)))
      throw new Error('La salida debe estar fuera del repositorio.');
    // Use a private folder established by the operator; exclusive files never overwrite.
    await writeFile(output, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await writeFile(output + '.review.json', JSON.stringify(plan, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    console.log(
      JSON.stringify({
        mode: 'PLAN_ONLY',
        ...plan.summary,
        manifestSha256: createHash('sha256')
          .update(await readFile(output))
          .digest('hex'),
      }),
    );
  }
}
main()
  .catch(() => {
    console.error(
      'Importación detenida. Revise autorización, procedencia, plan, organización y vigencia de la conciliación. No se imprimen datos privados.',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePostgresPool();
  });
