import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ch01FunctionalFingerprint } from './functional-fingerprint.mjs';

const required = {
  'AUTH-RECOVER-OPEN': 'SEL-CH01-RECOVERY', 'AUTH-RECOVER-CANCEL': 'SEL-CH01-RECOVERY', 'AUTH-INSTALL': 'SEL-CH01-INSTALL',
  'USER-MENU-OPEN': 'SEL-CH01-USER-MENU', 'USER-MENU-CLOSE': 'SEL-CH01-USER-MENU', 'USER-PROFILE-OPEN': 'SEL-CH01-USER-MENU',
  'PATIENT-TAB-IMPORT': 'SEL-CH01-IMPORT', 'PATIENT-EXPORT-XLSX': 'SEL-CH01-XLSX', 'PATIENT-BOTMAKER-CONSENT': 'SEL-CH01-BOTMAKER',
};
const source = readFileSync(resolve('tests/selenium/test_ch01.py'), 'utf8');
const resultPath = resolve('.qa-results/selenium-patients.json');
const results = existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, 'utf8')).results ?? [] : [];
const fingerprint = ch01FunctionalFingerprint();
const errors = [];
for (const [action, testId] of Object.entries(required)) {
  if (!source.includes(`# test-id: ${testId}`)) errors.push(`${action}: missing declared ${testId}`);
  const evidence = results.find((result) => result.action_id === action);
  if (!evidence) errors.push(`${action}: no runtime evidence`);
  else {
    if (evidence.status !== 'PASS') errors.push(`${action}: runtime status is not PASS`);
    if (evidence.test_id !== testId) errors.push(`${action}: incorrect test id`);
    if (evidence.functional_fingerprint !== fingerprint) errors.push(`${action}: stale functional fingerprint`);
    if (!evidence.executed_at || !evidence.duration_ms || !evidence.url) errors.push(`${action}: incomplete runtime evidence`);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`selenium CH01 coverage passed: ${Object.keys(required).length}/${Object.keys(required).length}, fingerprint=${fingerprint}`);
