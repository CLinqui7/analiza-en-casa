import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

assert.equal(process.env.ANALIZA_MANAGED_POSTGRES, 'neon');
const ownerUrl = new URL(process.env.DATABASE_URL);
assert.equal(ownerUrl.protocol, 'postgresql:');
assert.ok(ownerUrl.hostname.endsWith('.neon.tech'));
const runtimeRole = process.env.ANALIZA_PG_RUNTIME_ROLE;
const runtimePassword = process.env.ANALIZA_PG_RUNTIME_PASSWORD;
assert.ok(runtimeRole && /^[a-z][a-z0-9_]{0,62}$/.test(runtimeRole));
assert.ok(runtimePassword && runtimePassword.length >= 32);

const runtimeUrl = new URL(ownerUrl);
runtimeUrl.username = runtimeRole;
runtimeUrl.password = runtimePassword;

function setVariable(name, value, sensitive) {
  assert.match(name, /^[A-Z][A-Z0-9_]+$/);
  for (const environment of ['production', 'development']) {
    const args = [
      'vercel',
      'env',
      'add',
      name,
      environment,
      '--force',
      sensitive ? '--sensitive' : '--no-sensitive',
      '--yes',
      '--non-interactive',
    ];
    const result =
      process.platform === 'win32'
        ? spawnSync(
            process.env.ComSpec || 'cmd.exe',
            ['/d', '/s', '/c', `npx.cmd ${args.join(' ')}`],
            { input: `${value}\n`, encoding: 'utf8', windowsHide: true },
          )
        : spawnSync('npx', args, {
            input: `${value}\n`,
            encoding: 'utf8',
            windowsHide: true,
          });
    assert.equal(result.status, 0, `Could not configure ${name} for ${environment}`);
  }
}

setVariable('ANALIZA_DATABASE_URL', runtimeUrl.toString(), true);
for (const [name, value] of [
  ['ANALIZA_DATA_MODE', 'postgresql'],
  ['NEXT_PUBLIC_DATA_MODE', 'postgresql'],
  ['ANALIZA_MANAGED_POSTGRES', 'neon'],
  ['ANALIZA_REGISTRATION_MODE', 'isolated'],
  ['NEXT_PUBLIC_REGISTRATION_MODE', 'isolated'],
  ['NEXT_PUBLIC_ONBOARDING_PROFILE', 'nurse'],
]) {
  setVariable(name, value, false);
}

console.log(
  JSON.stringify({
    operation: 'VERCEL_NEON_RUNTIME_CONFIGURED',
    environments: ['production', 'development'],
    runtimeRole,
    secretPrinted: false,
  }),
);
