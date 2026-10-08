import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('../database/postgresql/migrations/028_account_profiles.sql', import.meta.url), 'utf8');
const repo = await readFile(new URL('../apps/web/src/server/persistence/postgres-account-profile.ts', import.meta.url), 'utf8');

test('account photos remain private, bounded and constrained in PostgreSQL', () => {
  assert.match(sql, /ADD COLUMN avatar_bytes bytea/);
  assert.match(sql, /avatar_mime IN \('image\/png','image\/jpeg','image\/webp'\)/);
  assert.match(sql, /octet_length\(avatar_bytes\) BETWEEN 16 AND 1048576/);
  assert.doesNotMatch(sql, /DISABLE ROW LEVEL SECURITY|GRANT\s+.*\bPUBLIC\b|service_role/i);
});

test('account changes scope to active membership and append an audit event', () => {
  assert.match(repo, /m\.organization_id=\$2 AND m\.active AND u\.disabled_at IS NULL/);
  assert.match(repo, /FOR UPDATE OF u/);
  assert.match(repo, /UPDATE analiza\.sessions SET revoked_at=now\(\)/);
  assert.match(repo, /ACCOUNT_PROFILE_NAME_UPDATED/);
  assert.match(repo, /ACCOUNT_PROFILE_AVATAR_UPDATED/);
  assert.match(repo, /ACCOUNT_PASSWORD_CHANGED/);
});
