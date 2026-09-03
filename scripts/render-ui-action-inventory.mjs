import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const jsonPath = resolve('docs/qa/UI_ACTION_INVENTORY.json');
const csvPath = resolve('docs/qa/UI_ACTION_INVENTORY.csv');
const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
const columns = [
  'action_id', 'module', 'route', 'control_type', 'visible_label', 'selector_or_testid',
  'roles_allowed', 'roles_denied', 'preconditions', 'positive_scenario', 'negative_scenario',
  'persistence_required', 'refresh_required', 'selenium_required', 'selenium_test_ids',
  'playwright_test_ids', 'unit_test_ids', 'status', 'blocker',
];
const csv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const toCell = (value) => Array.isArray(value) ? value.join('|') : value;
writeFileSync(csvPath, `${columns.join(',')}\n${data.actions.map((row) => columns.map((column) => csv(toCell(row[column]))).join(',')).join('\n')}\n`);
