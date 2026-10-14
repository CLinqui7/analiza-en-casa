import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';

test('source archive verification authenticates the payload and rejects a wrong key', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'analiza-source-snapshot-test-'));
  const archive = path.join(directory, 'synthetic.aesgcm');
  const passwordFile = path.join(directory, 'password');
  const otherPasswordFile = path.join(directory, 'other-password');
  const script = path.resolve('scripts/deployment/source-snapshot.mjs');
  try {
    const password = randomBytes(32);
    fs.writeFileSync(passwordFile, password);
    fs.writeFileSync(otherPasswordFile, randomBytes(32));
    const salt = randomBytes(16), iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', scryptSync(password, salt, 32), iv);
    const metadata = { kind: 'metadata', format: 2, source: 'synthetic-test', tables: ['organizations'], counts: { organizations: 1 } };
    const record = { kind: 'row', table: 'organizations', record_json: '{"id":"synthetic-org","large":9007199254740993}' };
    const data = Buffer.from(`${JSON.stringify(metadata)}\n${JSON.stringify(record)}\n`);
    fs.writeFileSync(archive, Buffer.concat([Buffer.from('ANALIZA1'), salt, iv, cipher.update(data), cipher.final(), cipher.getAuthTag()]));
    const verify = (keyFile) => execFileSync(process.execPath, [script, 'verify', '--archive', archive, '--password-file', keyFile], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.deepEqual(JSON.parse(verify(passwordFile)).rows, 1);
    assert.throws(() => verify(otherPasswordFile));
    const tampered = fs.readFileSync(archive);
    tampered[tampered.length - 17] ^= 1;
    fs.writeFileSync(archive, tampered);
    assert.throws(() => verify(passwordFile));
  } finally {
    for (const file of [archive, passwordFile, otherPasswordFile]) fs.rmSync(file, { force: true });
    fs.rmdirSync(directory);
  }
});
