import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ch01FunctionalFingerprint } from './functional-fingerprint.mjs';

const required = ['PATIENT-NATIONALITY-SEARCH', 'PATIENT-COMPANY-SEARCH', 'PATIENT-INSURER-SEARCH', 'PATIENT-INSURANCE-HOLDER-YES', 'PATIENT-COVERAGE-ADD', 'PATIENT-ADDRESS-IMPORT', 'PATIENT-MAP-ZOOM-IN', 'PATIENT-MAP-ZOOM-OUT', 'PATIENT-MAP-LAYER', 'PATIENT-BACK'];
const evidencePath = resolve('.qa-results/selenium-patients.json');
const evidence = existsSync(evidencePath) ? JSON.parse(readFileSync(evidencePath, 'utf8')).results ?? [] : [];
const fingerprint = ch01FunctionalFingerprint();
const errors = required.flatMap((action) => {
  const result = evidence.find((item) => item.action_id === action);
  if (!result) return [`${action}: no runtime evidence`];
  if (result.status !== 'PASS' || result.test_id !== 'SEL-CH02-PATIENT-FORM') return [`${action}: failed or wrong test id`];
  if (result.functional_fingerprint !== fingerprint || !result.executed_at || !result.duration_ms || !result.url) return [`${action}: stale or incomplete evidence`];
  return [];
});
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`selenium CH02 coverage passed: ${required.length}/${required.length}, fingerprint=${fingerprint}`);
