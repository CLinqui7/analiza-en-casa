import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { migrateMongo, migrationPlan } from './deployment/mongo-migrations.mjs';

assert.match(process.env.MONGODB_COLLECTION_PREFIX || '', /^registration_qa_/);
const first = await migrateMongo();
assert.equal(first.status, 'PASS');
const repeat = await migrateMongo();
assert.deepEqual(repeat.applied, []);
assert.equal(repeat.skipped.length, (await migrationPlan()).length);
const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  const database = client.db(process.env.MONGODB_DB);
  const prefix = process.env.MONGODB_COLLECTION_PREFIX;
  const ledger = database.collection(prefix + 'schemaMigrations');
  const previous = await ledger.findOne({ _id: repeat.skipped[0] });
  try {
    await ledger.updateOne({ _id: previous._id }, { $set: { sha256: 'injected-invalid-checksum' } });
    await assert.rejects(migrateMongo(), /Applied MongoDB migration changed/);
  } finally {
    await ledger.updateOne({ _id: previous._id }, { $set: { sha256: previous.sha256 } });
  }
  const locks = database.collection(prefix + 'schemaMigrationLocks');
  await locks.updateOne({ _id: 'deployment' }, { $set: { released: false } });
  try { await assert.rejects(migrateMongo(), /Migration lock unavailable/); }
  finally { await locks.updateOne({ _id: 'deployment' }, { $set: { released: true } }); }
  assert.equal((await migrateMongo()).status, 'PASS');
  console.log('PASS: MongoDB migration apply/replay, checksum rejection, concurrent-operator rejection and recovery; no seed.');
} finally { await client.close(); }
