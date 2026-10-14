import { readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const provenanceClasses = ['REAL_USER_DATA','APPROVED_BUSINESS_CATALOG','REQUIRED_SYSTEM_REFERENCE','CONFIRMED_DEMO_DATA','UNKNOWN_ORIGIN'];
const key = (row) => `${row.organizationId ?? ''}:${row.entity}:${row.id}`;

/** Read-only planning. Classification needs evidence; uncertainty never becomes deletion. */
export function planCleanCopy(records) {
  const indexed = new Map();
  for (const row of records) {
    if (!row.entity || !row.id || indexed.has(key(row))) throw new Error('Missing or duplicate scoped identity');
    indexed.set(key(row),row);
  }
  const decisions = new Map(records.map((row) => {
    const classification = provenanceClasses.includes(row.classification) ? row.classification : 'UNKNOWN_ORIGIN';
    const evidence = Array.isArray(row.evidence) && row.evidence.some((item) => item.sourcePath && /^[0-9a-f]{64}$/.test(item.sourceSha256 ?? '') && item.bodySha256 === row.bodySha256 && /^[0-9a-f]{64}$/.test(row.bodySha256 ?? ''));
    return [key(row), {identity:key(row),classification:evidence ? classification : 'UNKNOWN_ORIGIN',decision:!evidence || classification === 'UNKNOWN_ORIGIN' ? 'QUARANTINE' : classification === 'CONFIRMED_DEMO_DATA' ? 'EXCLUDE' : 'INCLUDE',reason:evidence ? 'Evidence supplied; requires authorized source review.' : 'Missing matching origin evidence.'}];
  }));
  let changed;
  do {
    changed = false;
    for(const row of records) {
      const decision = decisions.get(key(row));
      const dependencies = (row.dependencies ?? []).map((dependency) => decisions.get(key(dependency)));
      const mixed = decision.decision === 'EXCLUDE' && dependencies.some((parent) => parent && parent.classification === 'REAL_USER_DATA');
      const broken = decision.decision === 'INCLUDE' && dependencies.some((parent) => !parent || parent.decision !== 'INCLUDE');
      if(mixed || broken) { decision.decision='QUARANTINE';decision.reason=mixed ? 'Demo depends on real data; manual reconciliation required.' : 'Unresolved dependency; preserve source and review.';changed=true; }
    }
  } while(changed);
  const manifest = [...decisions.values()];
  return {operation:'PLAN_ONLY',sourceWrites:0,destinationWrites:0,publishable:manifest.every((row)=>row.decision!=='QUARANTINE'),counts:Object.fromEntries(['INCLUDE','EXCLUDE','QUARANTINE'].map((decision)=>[decision,manifest.filter((row)=>row.decision===decision).length])),manifest};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [input, output] = process.argv.slice(2);
  if(!input || !output) throw new Error('Provide private inventory JSON and private output JSON');
  const privateRoot = resolve('.local')+sep;
  const destination=resolve(output);
  if(!destination.startsWith(privateRoot)) throw new Error('Manifest must stay in ignored .local');
  const result = planCleanCopy(JSON.parse(await readFile(input,'utf8')).records);
  await writeFile(destination,JSON.stringify(result,null,2),{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({operation:result.operation,publishable:result.publishable,counts:result.counts}));
}
