import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ch01FunctionalFingerprint } from './functional-fingerprint.mjs';

const inventory = JSON.parse(readFileSync(resolve('docs/qa/UI_ACTION_INVENTORY.json'), 'utf8'));
const source = readFileSync(resolve('tests/selenium/test_hospitalizations.py'), 'utf8');
const declared = new Set([...source.matchAll(/^\s*#\s*test-id:\s*([\w.-]+)\s*$/gm)].map((match) => match[1]));
const required = inventory.actions.filter((action) => action.selenium_required && action.action_id.startsWith('HOSPITALIZATION-'));
const evidencePath = resolve('.qa-results/selenium-hospitalizations.json');
const results = existsSync(evidencePath) ? JSON.parse(readFileSync(evidencePath, 'utf8')).results ?? [] : [];
const byAction = new Map(results.map((entry) => [entry.action_id, entry]));
const fingerprint = ch01FunctionalFingerprint();
const uncovered = required.filter((action) => !action.selenium_test_ids?.length || action.selenium_test_ids.some((id) => !declared.has(id)));
const failed = required.filter((action) => {
  const entry = byAction.get(action.action_id);
  return !entry || entry.status !== 'PASS' || entry.functional_fingerprint !== fingerprint || !entry.executed_at || !entry.duration_ms || !entry.url;
});

console.log(`selenium_ch03_actions_total=${required.length}`);
console.log(`failed=${failed.length}`);
console.log(`uncovered=${uncovered.length}`);
console.log(`functional_fingerprint=${fingerprint}`);
for (const action of uncovered) console.log(`UNCOVERED ${action.action_id}`);
for (const action of failed) console.log(`FAILED ${action.action_id}`);
if (failed.length || uncovered.length) process.exitCode = 1;
