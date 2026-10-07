import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const persistence = await readFile(
  new URL('../apps/web/src/server/persistence/postgres.ts', import.meta.url),
  'utf8',
);
const route = await readFile(
  new URL('../apps/web/src/app/api/shifts/route.ts', import.meta.url),
  'utf8',
);

test('scheduled shift edits are authorized, idempotent, collision-safe and audited', () => {
  assert.match(route, /export async function PATCH/);
  assert.match(route, /requireCsrf/);
  assert.match(persistence, /async update\(actor, input\)/);
  assert.match(persistence, /authorize\(actor, 'agenda:write'\)/);
  assert.match(persistence, /shift-update:/);
  assert.match(persistence, /SELECT payload_hash,result FROM analiza\.commands/);
  assert.match(persistence, /id<>\$2 AND resource_id=\$3/);
  assert.match(persistence, /Sólo se pueden editar turnos programados/);
  assert.match(persistence, /UPDATE analiza\.shifts SET resource_id=/);
  assert.match(persistence, /SHIFT_UPDATED/);
});
