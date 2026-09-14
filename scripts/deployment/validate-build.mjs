import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function buildIdentity(env) {
  const required = (name, pattern) => {
    const value = env[name];
    assert.ok(
      typeof value === 'string' && value !== 'REQUIRED' && pattern.test(value),
      `Missing/invalid ${name}`,
    );
    return value;
  };
  const project = required('GCP_PROJECT_ID', /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/);
  const region = required('GCP_REGION', /^[a-z]+-[a-z]+[0-9]+$/);
  const repository = required('ARTIFACT_REGISTRY_REPOSITORY', /^[a-z][a-z0-9_-]*$/);
  const name = required('IMAGE_NAME', /^[a-z0-9][a-z0-9._-]*$/);
  const sha = required('SOURCE_SHA', /^[a-f0-9]{40}$/);
  assert.ok(!env.TRIGGER_SHA || env.TRIGGER_SHA === sha, 'Trigger SHA differs from tested source');
  return `${region}-docker.pkg.dev/${project}/${repository}/${name}:core-postgresql-${sha}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const image = buildIdentity(process.env);
  await mkdir('.local/cloud-run', { recursive: true });
  await writeFile('.local/cloud-run/image-ref.txt', image);
  console.info(
    JSON.stringify({ image, mode: 'postgresql', profile: 'core', schema: 'analiza-core-v1' }),
  );
}
