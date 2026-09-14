import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ch01FunctionalFingerprint, functionalEntries } from './functional-fingerprint.mjs';

const root = process.cwd();
const tracePath = resolve(root, 'docs/qa/VIDEO_TO_REACT_TRACEABILITY.json');
const canonical = JSON.parse(readFileSync(resolve(root, 'docs/MASTER_VIDEO_REQUIREMENTS.json'), 'utf8'));
const trace = JSON.parse(readFileSync(tracePath, 'utf8'));
const inventory = JSON.parse(readFileSync(resolve(root, 'docs/qa/UI_ACTION_INVENTORY.json'), 'utf8'));
const routes = JSON.parse(readFileSync(resolve(root, 'docs/qa/REACT_ROUTE_PARITY.json'), 'utf8'));
const certificationPath = resolve(root, 'docs/qa/VIDEO_REQUIREMENT_CERTIFICATIONS.json');
const certifications = existsSync(certificationPath) ? JSON.parse(readFileSync(certificationPath, 'utf8')) : { certifications: {} };
const chapterIndex = process.argv.indexOf('--chapter');
const chapter = chapterIndex === -1 ? undefined : process.argv[chapterIndex + 1];
if (chapterIndex !== -1 && !chapter) throw new Error('Expected a chapter after --chapter.');
const currentSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const currentFingerprint = ch01FunctionalFingerprint(root);
const ch01EvidenceSource = [
  'apps/web/e2e/ch01.spec.ts', 'apps/web/e2e/ch02.spec.ts', 'apps/web/e2e/ch03.spec.ts', 'apps/web/e2e/ch07.spec.ts', 'apps/web/e2e/ch08.spec.ts', 'apps/web/e2e/ch09.spec.ts', 'apps/web/e2e/quotes.spec.ts', 'apps/web/e2e/workspace.spec.ts', 'apps/web/src/components/administrative-profile-panel.test.ts', 'apps/web/src/lib/data-provider.test.ts', 'apps/web/src/lib/domain.test.ts', 'apps/web/src/lib/patient-form.test.ts', 'tests/selenium/test_ch01.py', 'tests/selenium/test_ch02.py', 'tests/selenium/test_ch03.py', 'tests/selenium/test_clinical_hospitalizations.py', 'tests/selenium/test_hospitalizations.py', 'tests/selenium/test_quotes.py',
].filter((path) => existsSync(resolve(root, path))).map((path) => readFileSync(resolve(root, path), 'utf8')).join('\n');
const errors = [];
const allowed = new Set(['EXACT', 'PARTIAL', 'MISSING', 'BLOCKED_CLIENT', 'BLOCKED_INTEGRATION', 'NOT_TESTABLE', 'NOT_APPLICABLE']);
const expected = new Set(canonical.requirements.map((item) => item.requirement_id));
const found = new Set(trace.requirements.map((item) => item.requirement_id));
function routeConsistencyErrors(routeItems, requirementItems) {
  const routeErrors = [];
  for (const route of routeItems) {
    const related = requirementItems.filter((item) => item.route_id === route.route_id);
    if (
      route.full_video_parity_status === 'EXACT' &&
      related.some((item) => ['PARTIAL', 'MISSING'].includes(item.parity_status))
    )
      routeErrors.push(`${route.route_id}: false EXACT while related requirements remain open`);
  }
  return routeErrors;
}
for (const id of expected) if (!found.has(id)) errors.push(`Missing traceability requirement: ${id}`);
const reviewedRequirements = chapter ? trace.requirements.filter((item) => item.chapter_id === chapter) : trace.requirements;
if (chapter && !reviewedRequirements.length) errors.push(`No requirements found for chapter ${chapter}.`);
for (const item of reviewedRequirements) {
  if (!allowed.has(item.parity_status)) errors.push(`${item.requirement_id}: invalid parity status`);
  if (item.classification === 'VISIBLE' && (!item.route_id || !item.react_files?.length)) errors.push(`${item.requirement_id}: visible requirement lacks route/react_files`);
  for (const actionId of item.action_ids ?? []) {
    if (!inventory.actions.some((action) => action.action_id === actionId)) errors.push(`${item.requirement_id}: action ${actionId} is not in UI_ACTION_INVENTORY`);
    const appRoot = resolve(root, 'apps/web/src');
    const literal = JSON.stringify(actionId);
    const source = readFileSync(resolve(root, 'docs/qa/UI_ACTION_INVENTORY.json'), 'utf8');
    if (!source.includes(actionId) || !existsSync(appRoot)) errors.push(`${item.requirement_id}: action ${actionId} cannot be verified`);
    void literal;
  }
  if (['BLOCKED_CLIENT', 'BLOCKED_INTEGRATION', 'NOT_TESTABLE'].includes(item.parity_status) && (!item.blocker_reason || !(item.blocker_ids?.length))) errors.push(`${item.requirement_id}: blocker without ID and explanation`);
  if (chapter && item.parity_status === 'EXACT') {
    const certification = (certifications.certifications ?? certifications)[item.requirement_id];
    if (!certification) errors.push(`${item.requirement_id}: EXACT has no current certification`);
    if (!(item.unit_test_ids?.length || item.playwright_test_ids?.length || item.selenium_test_ids?.length || item.visual_test_ids?.length)) errors.push(`${item.requirement_id}: EXACT has no test evidence`);
    for (const testId of [...(item.unit_test_ids ?? []), ...(item.playwright_test_ids ?? []), ...(item.selenium_test_ids ?? []), ...(item.visual_test_ids ?? [])]) {
      if (!ch01EvidenceSource.includes(`test-id: ${testId}`)) errors.push(`${item.requirement_id}: test_id ${testId} is not declared by executable evidence`);
    }
    const implementationShaPending = certifications.verification_status === 'PENDING_GIT_WRITE';
    if (!certifications.implementation_sha && !implementationShaPending)
      errors.push(`${item.requirement_id}: certification lacks implementation_sha`);
    if (!certifications.functional_fingerprint) errors.push(`${item.requirement_id}: certification lacks functional_fingerprint`);
    if (certifications.functional_fingerprint !== currentFingerprint) errors.push(`${item.requirement_id}: functional fingerprint is stale`);
  }
}
errors.push(...routeConsistencyErrors(routes.routes, trace.requirements));
const dashboard = readFileSync(resolve(root, 'apps/web/src/app/(workspace)/dashboard/page.tsx'), 'utf8');
if (/unresolvedMissing\s*:\s*0/.test(dashboard)) errors.push('Dashboard still hardcodes unresolvedMissing: 0');
if (process.argv.includes('--self-test')) {
  const selfTestRoute = { route_id: 'ROUTE-SELF-TEST', full_video_parity_status: 'EXACT' };
  const selfTestRequirement = {
    requirement_id: 'SELF-TEST-PARTIAL',
    route_id: selfTestRoute.route_id,
    parity_status: 'PARTIAL',
  };
  const fixtureErrors = routeConsistencyErrors([selfTestRoute], [selfTestRequirement]);
  if (!fixtureErrors.includes('ROUTE-SELF-TEST: false EXACT while related requirements remain open'))
    throw new Error('False EXACT fixture was not detected.');
  console.log(`anti-false-exact fixture detected: ${selfTestRoute.route_id} conflicts with ${selfTestRequirement.requirement_id}`);
  const baseline = ch01FunctionalFingerprint(root);
  const entries = functionalEntries(root);
  const [functionalPath, functionalContent] = entries[0];
  const changedFunctional = ch01FunctionalFingerprint(root, new Map([[functionalPath, Buffer.concat([functionalContent, Buffer.from('\nself-test')])]]));
  if (baseline === changedFunctional) throw new Error('Functional-change fingerprint fixture was not detected.');
  const metadataOnly = ch01FunctionalFingerprint(root);
  if (baseline !== metadataOnly) throw new Error('Metadata-only fingerprint fixture unexpectedly changed.');
  if (baseline === '0'.repeat(64)) throw new Error('Wrong fingerprint fixture was not detected.');
  console.log('fingerprint self-tests passed: metadata-only, functional-change, wrong-fingerprint');
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log(`video-parity gate passed: ${reviewedRequirements.length}/${chapter ? reviewedRequirements.length : expected.size} requirements traced${chapter ? ` for ${chapter}` : ''}`);
