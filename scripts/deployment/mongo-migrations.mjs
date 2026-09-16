import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';

export async function migrationPlan() {
  const directory = new URL('../../database/mongodb/migrations/', import.meta.url);
  const names = (await readdir(directory))
    .filter((name) => /^\d+_[a-z_]+\.json$/.test(name))
    .sort();
  assert.ok(names.length, 'No MongoDB migrations found');
  return Promise.all(
    names.map(async (version) => {
      const raw = (await readFile(new URL(version, directory), 'utf8')).replace(/\r\n/g, '\n');
      return {
        ...JSON.parse(raw),
        version,
        sha256: createHash('sha256').update(raw).digest('hex'),
      };
    }),
  );
}

export async function migrateMongo(environment = process.env) {
  assert.equal(environment.ANALIZA_DATA_MODE, 'mongodb', 'MongoDB mode required');
  assert.ok(
    environment.MONGODB_URI && environment.MONGODB_DB,
    'Private MongoDB configuration required',
  );
  const prefix = environment.MONGODB_COLLECTION_PREFIX || '';
  assert.ok(!prefix || /^[a-z][a-z0-9_]{0,47}_$/.test(prefix), 'Invalid collection prefix');
  const plan = await migrationPlan();
  const client = new MongoClient(environment.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const owner = randomUUID();
  let acquired = false;
  try {
    await client.connect();
    const database = client.db(environment.MONGODB_DB);
    const collection = (name) => database.collection(prefix + name);
    const locks = collection('schemaMigrationLocks');
    const ledger = collection('schemaMigrations');
    // No expiring lease: a crashed operator must be checked before manually releasing its lock.
    // Mongo's unique _id prevents two operators from holding the same lock.
    try {
      await locks.findOneAndUpdate(
        { _id: 'deployment', released: true },
        { $set: { owner, released: false, startedAt: new Date() } },
        { upsert: true, returnDocument: 'after', writeConcern: { w: 'majority' } },
      );
      acquired = true;
    } catch {
      throw new Error('Migration lock unavailable; check the active operator before retrying.');
    }
    const applied = [];
    const skipped = [];
    for (const migration of plan) {
      const previous = await ledger.findOne({ _id: migration.version });
      if (previous) {
        assert.equal(
          previous.sha256,
          migration.sha256,
          'Applied MongoDB migration changed; add a new version',
        );
        skipped.push(migration.version);
        continue;
      }
      // Index creation is idempotent. Interrupted DDL is retried; no ledger entry until all succeed.
      for (const { collection: name, key, ...options } of migration.indexes) {
        await collection(name).createIndex(key, options);
      }
      await ledger.insertOne(
        { _id: migration.version, sha256: migration.sha256, appliedAt: new Date() },
        { writeConcern: { w: 'majority' } },
      );
      applied.push(migration.version);
    }
    return { status: 'PASS', applied, skipped, seededUsers: 0 };
  } finally {
    try {
      if (acquired)
        await client
          .db(environment.MONGODB_DB)
          .collection(prefix + 'schemaMigrationLocks')
          .updateOne(
            { _id: 'deployment', owner },
            { $set: { released: true, completedAt: new Date() } },
            { writeConcern: { w: 'majority' } },
          );
    } finally {
      await client.close();
    }
  }
}
