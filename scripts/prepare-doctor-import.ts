import { readFile, open, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, dirname, relative, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import {
  previewDoctorImport,
  readDoctorImportFile,
  type DoctorSnapshot,
} from '../apps/web/src/server/doctor-import-preflight';

const run = promisify(execFile);
const repository = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    output: { type: 'string' },
    organization: { type: 'string' },
    existing: { type: 'string' },
    sheet: { type: 'string' },
    help: { type: 'boolean' },
  },
});
if (values.help) {
  console.log(
    'Prevalidación sin escrituras: npm run doctors:prepare -- --input archivo.xlsx --sheet Medicos --organization ID --output C:/ruta/privada/informe.json [--existing medicos-existentes.json]',
  );
} else {
  try {
    if (!values.input || !values.output || !values.organization)
      throw new Error('Faltan parámetros.');
    if ((await stat(values.input)).size > 5 * 1024 * 1024)
      throw new Error('El archivo supera 5 MB.');
    const output = resolve(
      await realpath(dirname(resolve(values.output))),
      values.output.split(/[\\/]/).at(-1)!,
    );
    const delta = relative(repository, output);
    if (!delta || (!delta.startsWith('..') && !isAbsolute(delta)))
      throw new Error('El informe privado debe guardarse fuera del repositorio.');
    const bytes = await readFile(values.input);
    const source = await readDoctorImportFile(bytes, extname(values.input), values.sheet);
    let snapshot: DoctorSnapshot | undefined;
    if (values.existing) {
      if ((await stat(values.existing)).size > 20 * 1024 * 1024)
        throw new Error('La conciliación supera 20 MB.');
      snapshot = JSON.parse(await readFile(values.existing, 'utf8'));
    }
    const preview = previewDoctorImport(source.rows, values.organization, snapshot);
    const report = {
      ...preview,
      sheet: source.sheet,
      sourceSha256: createHash('sha256').update(bytes).digest('hex'),
      preparedAt: new Date().toISOString(),
      nextStep: snapshot
        ? 'Revisar incidencias y confirmar el lote antes de implementar o ejecutar una carga.'
        : 'Conciliar con una exportación reciente de médicos de la organización antes de cargar.',
    };
    // Create an empty file exclusively, secure it, then write private data. Never overwrite.
    const handle = await open(output, 'wx', 0o600);
    try {
      if (process.platform === 'win32') {
        const identity = (await run('whoami.exe')).stdout.trim();
        await run('icacls.exe', [output, '/inheritance:r', '/grant:r', `${identity}:F`]);
      }
      await handle.writeFile(JSON.stringify(report, null, 2) + '\n', 'utf8');
    } finally {
      await handle.close();
    }
    console.log(
      JSON.stringify({
        mode: preview.mode,
        ...preview.summary,
        comparedWithExisting: preview.comparedWithExisting,
        readyForControlledImport: preview.readyForControlledImport,
        output,
      }),
    );
    if (!preview.readyForControlledImport) process.exitCode = 2;
  } catch {
    // No source cells, credentials, paths or Zod payloads are exposed in failure logs.
    console.error(
      'No se preparó el lote. Revise formato, hoja, organización y carpeta privada existente; el archivo de salida debe ser nuevo. Consulte la guía de preparación.',
    );
    process.exitCode = 1;
  }
}
