import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = process.cwd();
const registry = JSON.parse(readFileSync(resolve(root, 'docs/qa/CLIENT_CHANGE_REQUESTS.json'), 'utf8'));
const certifications = JSON.parse(readFileSync(resolve(root, 'docs/qa/CLIENT_CHANGE_CERTIFICATIONS.json'), 'utf8')).certifications;
const inventory = JSON.parse(readFileSync(resolve(root, 'docs/qa/UI_ACTION_INVENTORY.json'), 'utf8'));
const batchIndex = process.argv.indexOf('--batch');
const batch = batchIndex === -1 ? null : process.argv[batchIndex + 1];
if (batchIndex !== -1 && !batch) throw new Error('Expected a batch after --batch.');
const expected = Array.from({ length: 32 }, (_, index) => `CR-${String(index + 1).padStart(3, '0')}`);
const statuses = new Set(['IMPLEMENTED','IMPLEMENTED_DEMO_ONLY','PARTIAL','MISSING','BLOCKED_CLIENT','BLOCKED_INTEGRATION','BLOCKED_CLINICAL_APPROVAL','BLOCKED_SOURCE_DATA','SOURCE_CONFLICT','DUPLICATE','NOT_APPLICABLE']);
const errors = [];
const testText = (() => { const files = []; const walk = (dir) => { for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) { const path = `${dir}/${entry.name}`; if (entry.isDirectory() && !path.includes('node_modules')) walk(path); else if (entry.isFile() && /\.(?:ts|tsx|js|mjs|py)$/.test(path)) files.push(path); } }; walk('apps'); walk('tests'); return files.map((path) => readFileSync(resolve(root, path), 'utf8')).join('\n'); })();
const actionSet = new Set(inventory.actions.map((action) => action.action_id));
const fingerprint = (files) => createHash('sha256').update(files.map((file) => `${file}\0${existsSync(resolve(root, file)) ? readFileSync(resolve(root, file)) : ''}`).join('\0')).digest('hex');
const selected = batch ? registry.changes.filter((change) => change.dependency_ids.includes(batch)) : registry.changes;
if (registry.changes.length !== 32) errors.push(`Registry has ${registry.changes.length} changes, expected 32.`);
for (const id of expected) if (!registry.changes.some((change) => change.change_id === id)) errors.push(`Missing ${id}.`);
for (const change of selected) {
  if (!statuses.has(change.status)) errors.push(`${change.change_id}: invalid status.`);
  if (!change.source_text || !change.normalized_interpretation || !change.source_rows?.length) errors.push(`${change.change_id}: source traceability is incomplete.`);
  if (change.source_conflict?.detected && !change.confirmation_required) errors.push(`${change.change_id}: source conflict closed without confirmation.`);
  if (change.status === 'SOURCE_CONFLICT' && (!change.source_conflict?.detected || !change.confirmation_required)) errors.push(`${change.change_id}: source conflict is not held open.`);
  for (const actionId of change.action_ids) if (!actionSet.has(actionId)) errors.push(`${change.change_id}: action_id ${actionId} does not exist.`);
  for (const testId of [...change.unit_test_ids, ...change.playwright_test_ids, ...change.selenium_test_ids]) if (!testText.includes(`test-id: ${testId}`)) errors.push(`${change.change_id}: test_id ${testId} does not exist.`);
  if (change.status === 'IMPLEMENTED') {
    if (!change.react_files.length || ![...change.unit_test_ids, ...change.playwright_test_ids, ...change.selenium_test_ids].length) errors.push(`${change.change_id}: IMPLEMENTED lacks functional files or tests.`);
    if (!change.react_files.some((path) => /\.(?:ts|tsx|js|mjs)$/.test(path))) errors.push(`${change.change_id}: SQL metadata is not a functional implementation.`);
    if (change.write_required && change.persistence_status !== 'VERIFIED') errors.push(`${change.change_id}: writing implementation lacks verified persistence.`);
    if (change.multiuser_required && (change.production_status === 'DEMO_LOCAL_ONLY' || change.react_files.some((path) => readFileSync(resolve(root, path), 'utf8').includes('localStorage')))) errors.push(`${change.change_id}: multiuser implementation relies on localStorage.`);
    if (change.clinical_change && change.certification_status !== 'CLINICAL_APPROVED') errors.push(`${change.change_id}: clinical implementation lacks approved version.`);
  }
  if (change.status === 'BLOCKED_CLIENT' && change.technical_status === 'RESOLVABLE') errors.push(`${change.change_id}: technically resolvable function is hidden as BLOCKED_CLIENT.`);
  if (change.status.startsWith('IMPLEMENTED')) {
    const certified = certifications[change.change_id];
    if (!certified || certified.functional_fingerprint !== change.functional_fingerprint) errors.push(`${change.change_id}: certification fingerprint does not match registry.`);
    if (change.functional_fingerprint !== fingerprint([...change.react_files, ...change.db_objects])) errors.push(`${change.change_id}: functional fingerprint is stale.`);
  }
}
if (process.argv.includes('--self-test')) {
  const baseline = selected.find((change) => change.change_id === 'CR-001') ?? registry.changes[0];
  const fakeImplemented = { ...baseline, status: 'IMPLEMENTED', react_files: [], unit_test_ids: [], playwright_test_ids: [], selenium_test_ids: [] };
  if (!(fakeImplemented.status === 'IMPLEMENTED' && (!fakeImplemented.react_files.length || ![...fakeImplemented.unit_test_ids, ...fakeImplemented.playwright_test_ids, ...fakeImplemented.selenium_test_ids].length))) throw new Error('false IMPLEMENTED fixture not detected');
  if (testText.includes('test-id: DOES-NOT-EXIST')) throw new Error('missing test fixture unexpectedly exists');
  if (baseline.functional_fingerprint === '0'.repeat(64)) throw new Error('wrong fingerprint fixture not detected');
  const baselineFingerprint = fingerprint([...baseline.react_files, ...baseline.db_objects]);
  const metadataOnly = fingerprint([...baseline.react_files, ...baseline.db_objects]);
  if (metadataOnly !== baselineFingerprint) throw new Error('metadata-only fixture unexpectedly changed fingerprint');
  const functionalPath = baseline.react_files[0];
  const changed = createHash('sha256').update([...baseline.react_files, ...baseline.db_objects].map((file) => `${file}\0${file === functionalPath ? `${readFileSync(resolve(root, file))}\nfixture` : readFileSync(resolve(root, file))}`).join('\0')).digest('hex');
  if (changed === baselineFingerprint) throw new Error('functional-change fixture not detected');
  console.log('self-tests passed: false IMPLEMENTED, missing test_id, wrong fingerprint, metadata-only, functional change');
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; } else console.log(`client-change gate passed: ${selected.length}/${registry.changes.length}${batch ? ` for ${batch}` : ''}`);
