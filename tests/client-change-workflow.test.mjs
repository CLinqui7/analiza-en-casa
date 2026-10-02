import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registry = JSON.parse(
  await readFile(new URL('../docs/qa/CLIENT_CHANGE_REQUESTS.json', import.meta.url), 'utf8'),
);
const workflow = JSON.parse(
  await readFile(new URL('../docs/qa/CLIENT_CHANGE_WORKFLOW.json', import.meta.url), 'utf8'),
);

test('the owner-requested Done state covers all current changes without altering technical evidence', () => {
  const registeredIds = registry.changes.map((change) => change.change_id);
  assert.equal(registeredIds.length, 32);
  assert.equal(new Set(workflow.done_ids).size, workflow.done_ids.length);
  assert.deepEqual([...workflow.done_ids].sort(), [...registeredIds].sort());
  assert.ok(registry.changes.some((change) => change.status !== 'IMPLEMENTED'));
});

test('the closure overlay is included in the Vercel deployment bundle', async () => {
  const ignore = await readFile(new URL('../.vercelignore', import.meta.url), 'utf8');
  assert.match(ignore, /^!docs\/qa\/CLIENT_CHANGE_WORKFLOW\.json$/m);
});
