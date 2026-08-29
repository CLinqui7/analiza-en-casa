import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const inventory = JSON.parse(readFileSync(resolve('docs/qa/UI_ACTION_INVENTORY.json'), 'utf8'));
const sources = [
  'apps/web/src/components/app-shell.tsx',
  'apps/web/src/app/(workspace)/quotes/page.tsx',
  'apps/web/src/app/(workspace)/quotes/[id]/page.tsx',
].map((path) => readFileSync(resolve(path), 'utf8'));
const uiActionIds = new Set(sources.flatMap((source) => [...source.matchAll(/QUOTE-[A-Z-]+/g)].map((match) => match[0])));
const required = inventory.actions.filter((action) => action.action_id.startsWith('QUOTE-') && action.selenium_required);
const requiredIds = new Set(required.map((action) => action.action_id));
const inventoryQuoteIds = new Set(inventory.actions.filter((action) => action.action_id.startsWith('QUOTE-')).map((action) => action.action_id));
const testSource = readFileSync(resolve('tests/selenium/test_quotes.py'), 'utf8');
const declaredTestIds = new Set([...testSource.matchAll(/^\s*#\s*test-id:\s*([\w.-]+)\s*$/gm)].map((match) => match[1]));
const missingInUi = [...requiredIds].filter((id) => !uiActionIds.has(id));
const orphanUiIds = [...uiActionIds].filter((id) => !inventoryQuoteIds.has(id));
const uncovered = required.filter((action) => !action.selenium_test_ids?.length || action.selenium_test_ids.some((id) => !declaredTestIds.has(id)));
const resultPath = resolve(process.env.SELENIUM_QUOTE_RESULTS_PATH ?? '.qa-results/selenium-quotes.json');
const result = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, 'utf8')) : { results: [] };
const sha = process.env.GIT_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const entries = Array.isArray(result.results) ? result.results : [];
const byAction = new Map(entries.map((entry) => [entry.action_id, entry]));
const orphanEvidence = entries.filter((entry) => !requiredIds.has(entry.action_id));
const executed = required.filter((action) => byAction.has(action.action_id));
const failed = required.filter((action) => {
  const entry = byAction.get(action.action_id);
  return !entry || entry.status !== 'PASS' || entry.git_sha !== sha || !action.selenium_test_ids.includes(entry.test_id)
    || !entry.executed_at || !Number.isFinite(entry.duration_ms) || !entry.url;
});
const passed = executed.filter((action) => !failed.includes(action));
const coverage = required.length ? (required.length - uncovered.length) / required.length * 100 : 100;

console.log(`quote_actions_total=${required.length}`);
console.log(`required=${required.length}`);
console.log(`executed=${executed.length}`);
console.log(`passed=${passed.length}`);
console.log(`failed=${failed.length}`);
console.log(`uncovered=${uncovered.length}`);
console.log(`coverage_percent=${coverage.toFixed(2)}`);
console.log(`git_sha=${sha}`);
console.log(`result_path=${resultPath}`);
for (const id of missingInUi) console.log(`MISSING_UI_ACTION ${id}`);
for (const id of orphanUiIds) console.log(`ORPHAN_UI_ACTION ${id}`);
for (const action of uncovered) console.log(`UNCOVERED ${action.action_id}: ${(action.selenium_test_ids ?? []).join(', ') || 'no selenium_test_ids'}`);
for (const action of failed) console.log(`FAILED ${action.action_id}: missing, invalid, non-PASS, or stale git SHA`);
for (const entry of orphanEvidence) console.log(`ORPHAN_EVIDENCE ${entry.action_id}`);
if (coverage !== 100 || failed.length || missingInUi.length || orphanUiIds.length || orphanEvidence.length) process.exitCode = 1;
