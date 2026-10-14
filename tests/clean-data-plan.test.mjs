import test from 'node:test';
import assert from 'node:assert/strict';
import { planCleanCopy } from '../scripts/deployment/clean-data-plan.mjs';
const row=(id,classification,dependencies=[])=>({entity:'qa_fixture',id,organizationId:'qa-org',classification,bodySha256:'a'.repeat(64),evidence:[{sourcePath:'synthetic-fixture',sourceSha256:'b'.repeat(64),bodySha256:'a'.repeat(64)}],dependencies});
test('unknown origin cannot become a clean database or an exclusion',()=>{
  const result=planCleanCopy([{entity:'qa_fixture',id:'unknown',classification:'CONFIRMED_DEMO_DATA'}]);
  assert.deepEqual(result.counts,{INCLUDE:0,EXCLUDE:0,QUARANTINE:1});assert.equal(result.publishable,false);
});
test('real records and dependencies are retained while unrelated evidenced demo is excluded',()=>{
  const result=planCleanCopy([row('real','REAL_USER_DATA'),row('demo','CONFIRMED_DEMO_DATA')]);
  assert.deepEqual(result.counts,{INCLUDE:1,EXCLUDE:1,QUARANTINE:0});assert.equal(result.sourceWrites,0);
});
test('mixed provenance never deletes a real account or automatically drops its relationships',()=>{
  const real=row('real','REAL_USER_DATA');
  const demo=row('demo','CONFIRMED_DEMO_DATA',[real]);
  const result=planCleanCopy([real,demo]);assert.equal(result.manifest[0].decision,'INCLUDE');assert.equal(result.manifest[1].decision,'QUARANTINE');
});
test('unresolved dependencies propagate quarantine and identity is organization scoped',()=>{
  const demo=row('demo','UNKNOWN_ORIGIN');
  const real=row('real','REAL_USER_DATA',[demo]);
  assert.equal(planCleanCopy([demo,real]).counts.QUARANTINE,2);
  assert.throws(()=>planCleanCopy([real,real]),/duplicate/);
  assert.equal(planCleanCopy([real,{...real,organizationId:'another-qa-org',dependencies:[]}]).manifest.length,2);
});
