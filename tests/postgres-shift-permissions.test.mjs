import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repository = await readFile(
  new URL('../apps/web/src/server/persistence/postgres.ts', import.meta.url),
  'utf8',
);
const grants = await readFile(
  new URL('../scripts/deployment/db-command.mjs', import.meta.url),
  'utf8',
);

// test-id: node:postgres-shift-update-runtime-grant
test('the restricted runtime role can lock and update shifts while commands stay append-only', () => {
  assert.match(repository, /SELECT body,status FROM analiza\.shifts[^`]+FOR UPDATE/);
  assert.match(repository, /UPDATE analiza\.shifts SET resource_id=/);
  assert.match(grants, /GRANT SELECT,INSERT,UPDATE ON analiza\.shifts TO/);
  assert.match(grants, /GRANT SELECT,INSERT ON analiza\.commands,/);
  assert.doesNotMatch(grants, /DELETE ON analiza\.shifts/);
});
