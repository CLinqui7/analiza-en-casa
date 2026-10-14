/** Authenticated, exact-text logical snapshot of an explicitly named PostgreSQL source.
 *
 * The connection URL is read only from ANALIZA_SOURCE_DATABASE_URL. Keep the
 * archive and password outside the repository. This tool never writes to SQL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const magic = Buffer.from('ANALIZA1');
const [operation, ...args] = process.argv.slice(2);
if (args.length % 2) throw new Error('Options require a value');
const options = {};
for (let index = 0; index < args.length; index += 2) {
  const name = args[index];
  if (!name.startsWith('--') || !args[index + 1] || args[index + 1].startsWith('--') || Object.hasOwn(options, name.slice(2))) throw new Error('Invalid or duplicate option');
  options[name.slice(2)] = args[index + 1];
}
const archive = options.archive && path.resolve(options.archive);
const passwordFile = options['password-file'] && path.resolve(options['password-file']);
if (!['create', 'verify'].includes(operation) || !archive || !passwordFile || !path.isAbsolute(options.archive) || !path.isAbsolute(options['password-file'])) {
  throw new Error('Usage: source-snapshot.mjs create|verify --archive ABSOLUTE_PATH --password-file ABSOLUTE_PATH [--expected-host HOST]');
}
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (archive === repository || archive.startsWith(repository + path.sep)) throw new Error('Sensitive archive must stay outside the repository');
if (passwordFile === repository || passwordFile.startsWith(repository + path.sep)) throw new Error('Password file must stay outside the repository');
const password = fs.readFileSync(passwordFile);
if (password.length < 16) throw new Error('Archive password file is too short');

if (operation === 'verify') {
  const bytes = fs.readFileSync(archive);
  if (!bytes.subarray(0, 8).equals(magic)) throw new Error('Unknown snapshot format');
  const decipher = createDecipheriv('aes-256-gcm', scryptSync(password, bytes.subarray(8, 24), 32), bytes.subarray(24, 36));
  decipher.setAuthTag(bytes.subarray(bytes.length - 16));
  const plain = Buffer.concat([decipher.update(bytes.subarray(36, bytes.length - 16)), decipher.final()]);
  const lines = plain.toString('utf8').trimEnd().split('\n').map((line) => JSON.parse(line));
  plain.fill(0);
  const metadata = lines.shift();
  if (metadata?.kind !== 'metadata' || metadata.format !== 2 || !Array.isArray(metadata.tables)) throw new Error('Unexpected snapshot metadata');
  const counts = Object.fromEntries(metadata.tables.map((table) => [table, 0]));
  for (const row of lines) {
    if (row.kind !== 'row' || !Object.hasOwn(counts, row.table) || typeof row.record_json !== 'string') throw new Error('Invalid snapshot record');
    const record = JSON.parse(row.record_json);
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid row JSON');
    counts[row.table]++;
  }
  if (JSON.stringify(counts) !== JSON.stringify(metadata.counts)) throw new Error('Snapshot row counts differ from authenticated metadata');
  console.log(JSON.stringify({ verified: true, format: 2, tables: metadata.tables.length, rows: lines.length, sha256: createHash('sha256').update(bytes).digest('hex') }));
  process.exit(0);
}

if (!options['expected-host'] || !/^[a-z0-9.-]+$/i.test(options['expected-host'])) throw new Error('create requires --expected-host');
if (fs.existsSync(archive)) throw new Error('Archive already exists');
const url = new URL(process.env.ANALIZA_SOURCE_DATABASE_URL || '');
if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== options['expected-host']) throw new Error('Unexpected source database host');
url.searchParams.set('sslmode', 'verify-full');
const db = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 5000, statement_timeout: 60000 });
const salt = randomBytes(16), iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', scryptSync(password, salt, 32), iv);
const fd = fs.openSync(archive, 'wx', 0o600);
let finished = false;
try {
  fs.writeFileSync(fd, Buffer.concat([magic, salt, iv]));
  await db.connect();
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const readOnly = (await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only;
  if (readOnly !== 'on') throw new Error('Source transaction is not read-only');
  const snapshotStartedAt = (await db.query('SELECT transaction_timestamp()::text AS started_at')).rows[0].started_at;
  const tables = (await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='analiza' AND table_type='BASE TABLE' ORDER BY table_name")).rows.map((row) => row.table_name);
  const counts = {};
  const content = [];
  for (const table of tables) {
    if (!/^[a-z_]+$/.test(table)) throw new Error('Unexpected table name');
    const rows = (await db.query(`SELECT to_jsonb(t)::text AS record_json FROM analiza.${table} t`)).rows;
    counts[table] = rows.length;
    for (const { record_json } of rows) content.push(JSON.stringify({ kind: 'row', table, record_json }) + '\n');
  }
  const metadata = { kind: 'metadata', format: 2, snapshot_at: snapshotStartedAt, captured_at: new Date().toISOString(), source: 'explicit-read-only-postgresql', isolation: 'REPEATABLE READ', tables, counts };
  const data = Buffer.from(JSON.stringify(metadata) + '\n' + content.join(''), 'utf8');
  fs.writeFileSync(fd, cipher.update(data));
  fs.writeFileSync(fd, cipher.final());
  fs.writeFileSync(fd, cipher.getAuthTag());
  fs.fsyncSync(fd);
  data.fill(0);
  await db.query('ROLLBACK');
  finished = true;
  console.log(JSON.stringify({ created: true, tables: tables.length, rows: Object.values(counts).reduce((sum, count) => sum + count, 0), bytes: fs.statSync(archive).size, sha256: createHash('sha256').update(fs.readFileSync(archive)).digest('hex') }));
} finally {
  await db.end().catch(() => {});
  fs.closeSync(fd);
  if (!finished) fs.rmSync(archive, { force: true });
}
