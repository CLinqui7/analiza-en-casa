import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ch01FunctionalFingerprint } from './functional-fingerprint.mjs';

const inventory = JSON.parse(readFileSync(resolve('docs/qa/UI_ACTION_INVENTORY.json'), 'utf8'));
const testSource = readFileSync(resolve('tests/selenium/test_hospitalizations.py'), 'utf8');
const declaredIds = new Set([...testSource.matchAll(/^\s*#\s*test-id:\s*([\w.-]+)\s*$/gm)].map((match) => match[1]));
const required = inventory.actions.filter((action) => action.action_id.startsWith('HOSPITALIZATION-') && action.selenium_required);
const uncovered = required.filter((action) => !action.selenium_test_ids.length || action.selenium_test_ids.some((id) => !declaredIds.has(id)));
const resultPath = resolve('.qa-results/selenium-hospitalizations.json');
const result = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, 'utf8')) : { results: [] };
const fingerprint = ch01FunctionalFingerprint();
const executionByAction = new Map(result.results.map((entry) => [entry.action_id, entry]));
const executed = required.filter((action) => executionByAction.has(action.action_id));
const failed = required.filter((action) => {
  const entry = executionByAction.get(action.action_id);
  return !entry || entry.status !== 'PASS' || entry.functional_fingerprint !== fingerprint || !entry.executed_at || !entry.duration_ms || !entry.url;
});
const passed = executed.filter((action) => {
  const entry = executionByAction.get(action.action_id);
  return entry.status === 'PASS' && entry.functional_fingerprint === fingerprint && entry.executed_at && entry.duration_ms && entry.url;
});
const coverage = required.length ? (required.length - uncovered.length) / required.length * 100 : 100;

console.log(`hospitalization_actions_total=${required.length}`);
console.log(`required=${required.length}`);
console.log(`declared=${required.length - uncovered.length}`);
console.log(`executed=${executed.length}`);
console.log(`passed=${passed.length}`);
console.log(`failed=${failed.length}`);
console.log(`uncovered=${uncovered.length}`);
console.log(`coverage_percent=${coverage.toFixed(2)}`);
console.log(`functional_fingerprint=${fingerprint}`);
for (const action of uncovered) console.log(`UNCOVERED ${action.action_id}: ${action.selenium_test_ids.join(', ') || 'no selenium_test_ids'}`);
for (const action of failed) console.log(`FAILED ${action.action_id}: missing, non-PASS, stale fingerprint, or incomplete evidence`);
if (coverage !== 100 || failed.length) process.exitCode = 1;
