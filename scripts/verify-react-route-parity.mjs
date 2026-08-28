import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve('docs/qa/REACT_ROUTE_PARITY.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const allowed = new Set(['MIGRATED_EXACT', 'MIGRATED_PARTIAL', 'MISSING', 'BLOCKED_CLIENT', 'NOT_APPLICABLE']);
const rows = manifest.routes;
const invalid = rows.filter((row) => !allowed.has(row.status));
const resolvable = rows.filter(
  (row) => row.status === 'MISSING' || (row.status === 'MIGRATED_PARTIAL' && !row.blocker.includes('CLIENT')),
);
const migrated = rows.filter((row) => row.status === 'MIGRATED_EXACT' || row.status === 'BLOCKED_CLIENT' || row.status === 'NOT_APPLICABLE');

console.log(`total_routes=${rows.length}`);
console.log(`migrated_or_explicitly_blocked=${migrated.length}`);
console.log(`resolvable_gaps=${resolvable.length}`);
for (const row of resolvable) console.log(`GAP ${row.route_id}: ${row.status} — ${row.blocker}`);

if (invalid.length || resolvable.length) process.exitCode = 1;
