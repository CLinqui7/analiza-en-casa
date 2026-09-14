import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIdentity } from '../scripts/deployment/validate-build.mjs';
const input = {
  GCP_PROJECT_ID: 'synthetic-project',
  GCP_REGION: 'us-central1',
  ARTIFACT_REGISTRY_REPOSITORY: 'synthetic',
  IMAGE_NAME: 'app',
  SOURCE_SHA: 'a'.repeat(40),
};
test('image identity uses the full source SHA as the registry tag', () => {
  assert.equal(
    buildIdentity(input),
    `us-central1-docker.pkg.dev/synthetic-project/synthetic/app:${'a'.repeat(40)}`,
  );
});
test('publication rejects missing identifiers, shell payloads and mismatched provenance', () => {
  for (const key of Object.keys(input)) {
    for (const value of ['', 'REQUIRED', '$(command)', 'value;command'])
      assert.throws(() => buildIdentity({ ...input, [key]: value }));
  }
  assert.throws(() => buildIdentity({ ...input, SOURCE_SHA: 'abc1234' }));
  assert.throws(() => buildIdentity({ ...input, TRIGGER_SHA: 'b'.repeat(40) }));
});
