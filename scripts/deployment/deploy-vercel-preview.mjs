import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { migrateMongo } from './mongo-migrations.mjs';

// Explicit preview command; never invoked at request time or by the generic Next build.
try {
  const envPath = process.argv[2];
  assert.ok(envPath, 'Pass the private preview env file');
  const environment = { ...process.env, ...parseEnv(await readFile(envPath, 'utf8')) };
  assert.equal(environment.ANALIZA_REGISTRATION_MODE, 'isolated');
  assert.equal(environment.NEXT_PUBLIC_REGISTRATION_MODE, 'isolated');
  assert.equal(environment.NEXT_PUBLIC_DATA_MODE, 'mongodb');
  assert.equal(environment.NEXT_PUBLIC_RELEASE_PROFILE, 'core');
  assert.match(environment.VERCEL_SCOPE || '', /^[a-zA-Z0-9_-]+$/, 'VERCEL_SCOPE is required');
  // Environment values must already be configured on the linked Vercel Preview project/branch.
  console.log(JSON.stringify(await migrateMongo(environment)));
  const args = [
    '--yes',
    'vercel',
    'deploy',
    '--yes',
    '--target',
    'preview',
    '--scope',
    environment.VERCEL_SCOPE,
  ];
  const child =
    process.platform === 'win32'
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npx', ...args], {
          stdio: 'inherit',
          env: environment,
          windowsHide: true,
        })
      : spawn('npx', args, { stdio: 'inherit', env: environment });
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
} catch {
  console.error(
    'Preview deployment stopped. Check private configuration and MongoDB migration status.',
  );
  process.exitCode = 1;
}
