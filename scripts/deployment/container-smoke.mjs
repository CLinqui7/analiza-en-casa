// Run with node inside the FINAL runtime image, with no database credentials.
import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
assert.notEqual(process.getuid(), 0);
for (const path of [
  '/app/apps/web/server.js',
  '/app/apps/web/.next/static',
  '/app/apps/web/public',
])
  await access(path);
for (const path of [
  '/app/.git',
  '/app/.local',
  '/app/.analiza-runtime',
  '/app/apps/web/.env.local',
  '/app/node_modules/@playwright',
  '/app/node_modules/vitest',
  '/app/node_modules/typescript',
])
  await assert.rejects(access(path), `Runtime must exclude ${path}`);
const forbiddenPath =
  /(?:^|\/)(?:\.env(?:\..*)?|\.npmrc|\.local|\.analiza-runtime|\.ssh|\.aws)(?:\/|$)|\.(?:pem|key|p12|pfx|dump|bson|bak|zip)$/i;
const appFiles = await readdir('/app/apps/web', { recursive: true });
assert.deepEqual(
  appFiles.filter((path) => forbiddenPath.test(path)),
  [],
  'No credentials or private runtime state in app artifact',
);
const config = JSON.parse(await readFile('/app/apps/web/.next/required-server-files.json', 'utf8'));
assert.equal(config.config.output, 'standalone');
const routes = JSON.parse(await readFile('/app/apps/web/.next/routes-manifest.json', 'utf8'));
assert.deepEqual(routes.rewrites, { beforeFiles: [], afterFiles: [], fallback: [] });
const base = `http://127.0.0.1:${process.env.PORT || 8080}`;
const request = (path, options) =>
  fetch(base + path, { ...options, signal: AbortSignal.timeout(10_000) });
let alive = false;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    alive = (await request('/api/health/live')).ok;
  } catch {
    /* wait for production startup */
  }
  if (alive) break;
  await delay(500);
}
assert.ok(alive, 'Production server must start within 30 seconds');
assert.deepEqual(await (await request('/api/health/live')).json(), { status: 'alive' });
const ready = await request('/api/health');
assert.equal(ready.status, 503, 'Missing DB must not report ready');
assert.equal(ready.headers.get('cache-control'), 'no-store');
assert.deepEqual(await ready.json(), { status: 'unavailable' });
const login = await request('/login');
assert.equal(login.status, 200);
const html = await login.text();
const assets = [
  ...new Set(
    [...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map((match) =>
      match[1].replaceAll('&amp;', '&'),
    ),
  ),
];
assert.ok(assets.length > 1, 'Standalone must reference its actual JS/CSS assets');
for (const asset of assets)
  assert.equal((await request(asset)).status, 200, 'Bundled asset available');
for (const path of ['/patients', '/hospitalizations', '/agenda', '/doctors'])
  assert.equal((await request(path)).status, 200, 'Deep navigation available');
for (const path of ['/api/patients', '/api/hospitalizations', '/api/doctors', '/api/workspace']) {
  const response = await request(path);
  assert.equal(response.status, 503, 'No DB means no fabricated data');
  const body = await response.json();
  assert.ok(body.error && !JSON.stringify(body).includes('mongodb://'));
}
assert.equal(
  (
    await request('/api/patients', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
  ).status,
  503,
);
assert.equal(
  (
    await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
  ).status,
  403,
);
assert.equal((await request('/api/quotes')).status, 404);
console.info(
  JSON.stringify({
    passed: true,
    platform: 'linux/amd64',
    uid: process.getuid(),
    port: process.env.PORT,
    assets: assets.length,
    database: 'unconfigured-safe-failure',
    scope: 'Runtime smoke only; connected persistence gate is separate',
  }),
);
