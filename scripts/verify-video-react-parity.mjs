import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

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
const errors = [];
const allowed = new Set(['EXACT', 'PARTIAL', 'MISSING', 'BLOCKED_CLIENT', 'BLOCKED_INTEGRATION', 'NOT_TESTABLE', 'NOT_APPLICABLE']);
const expected = new Set(canonical.requirements.map((item) => item.requirement_id));
const found = new Set(trace.requirements.map((item) => item.requirement_id));
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
    if (item.last_verified_sha !== currentSha) errors.push(`${item.requirement_id}: certification SHA ${item.last_verified_sha ?? 'missing'} does not match HEAD ${currentSha}`);
  }
}
for (const route of routes.routes) {
  const related = trace.requirements.filter((item) => item.route_id === route.route_id);
  if (route.full_video_parity_status === 'EXACT' && related.some((item) => ['PARTIAL', 'MISSING'].includes(item.parity_status))) errors.push(`${route.route_id}: false EXACT while related requirements remain open`);
}
const dashboard = readFileSync(resolve(root, 'apps/web/src/app/(workspace)/dashboard/page.tsx'), 'utf8');
if (/unresolvedMissing\s*:\s*0/.test(dashboard)) errors.push('Dashboard still hardcodes unresolvedMissing: 0');
if (process.argv.includes('--self-test')) {
  const route = routes.routes.find((item) => item.route_id === 'ROUTE-PATIENTS');
  const partial = trace.requirements.find((item) => item.route_id === 'ROUTE-PATIENTS' && item.parity_status === 'PARTIAL');
  if (!route || !partial) throw new Error('Anti-false-EXACT fixture is unavailable.');
  route.full_video_parity_status = 'EXACT';
  const fixtureDetected = trace.requirements.some((item) => item.route_id === route.route_id && ['PARTIAL', 'MISSING'].includes(item.parity_status));
  if (!fixtureDetected) throw new Error('False EXACT fixture was not detected.');
  console.log(`anti-false-exact fixture detected: ${route.route_id} conflicts with ${partial.requirement_id}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log(`video-parity gate passed: ${reviewedRequirements.length}/${chapter ? reviewedRequirements.length : expected.size} requirements traced${chapter ? ` for ${chapter}` : ''}`);
