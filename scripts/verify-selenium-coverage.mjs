import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const moduleName = process.argv[process.argv.indexOf('--module') + 1];
const prefix = process.argv[process.argv.indexOf('--prefix') + 1];
const requireExecuted = args.has('--require-executed');

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const inventoryPath = resolve('docs/qa/UI_ACTION_INVENTORY.json');
const seleniumRoot = resolve('tests/selenium');
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
const source = existsSync(seleniumRoot)
  ? files(seleniumRoot).filter((path) => path.endsWith('.py')).map((path) => readFileSync(path, 'utf8')).join('\n')
  : '';
const discovered = new Set([...source.matchAll(/^\s*#\s*test-id:\s*([\w.-]+)\s*$/gm)].map((match) => match[1]));
const required = inventory.actions.filter((action) => action.selenium_required && (!moduleName || action.module === moduleName) && (!prefix || action.action_id.startsWith(prefix)));
const uncovered = required.filter((action) => !action.selenium_test_ids.length || action.selenium_test_ids.some((id) => !discovered.has(id)));
const covered = required.length - uncovered.length;
const coverage = required.length ? (covered / required.length) * 100 : 100;

const resultsPath = resolve('.qa-results/selenium-patients.json');
const execution = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : { results: [] };
const sha = process.env.GIT_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const executionByAction = new Map(execution.results.map((result) => [result.action_id, result]));
const failed = requireExecuted ? required.filter((action) => executionByAction.get(action.action_id)?.status !== 'PASS' || executionByAction.get(action.action_id)?.git_sha !== sha) : [];
const executed = requireExecuted ? required.filter((action) => executionByAction.has(action.action_id)).length : 0;
console.log(`patient_actions_total=${required.length}`);
console.log(`selenium_required=${required.length}`);
console.log(`declared=${covered}`);
console.log(`executed=${executed}`);
console.log(`passed=${executed - failed.length}`);
console.log(`failed=${failed.length}`);
console.log(`uncovered=${uncovered.length}`);
console.log(`coverage_percent=${coverage.toFixed(2)}`);
console.log(`git_sha=${sha}`);
for (const action of uncovered) console.log(`UNCOVERED ${action.action_id}: ${action.selenium_test_ids.join(', ') || 'no selenium_test_ids'}`);
if (coverage !== 100 || failed.length) process.exitCode = 1;
