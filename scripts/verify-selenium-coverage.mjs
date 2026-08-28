import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

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
const required = inventory.actions.filter((action) => action.selenium_required);
const uncovered = required.filter((action) => !action.selenium_test_ids.length || action.selenium_test_ids.some((id) => !discovered.has(id)));
const covered = required.length - uncovered.length;
const coverage = required.length ? (covered / required.length) * 100 : 100;

console.log(`total_actions=${inventory.actions.length}`);
console.log(`selenium_required=${required.length}`);
console.log(`covered=${covered}`);
console.log(`uncovered=${uncovered.length}`);
console.log(`coverage_percent=${coverage.toFixed(2)}`);
for (const action of uncovered) console.log(`UNCOVERED ${action.action_id}: ${action.selenium_test_ids.join(', ') || 'no selenium_test_ids'}`);
if (coverage !== 100) process.exitCode = 1;
