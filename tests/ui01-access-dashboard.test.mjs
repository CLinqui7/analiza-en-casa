import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const loginForm = new URL('../apps/web/src/components/login-form.tsx', import.meta.url);
const dashboard = new URL('../apps/web/src/app/(workspace)/dashboard/page.tsx', import.meta.url);

test('UI01 login starts empty and supports keyboard focus/errors; fixture hints remain demo-only', async () => {
  const source = await readFile(loginForm, 'utf8');

  assert.match(source, /const demoMode = isDemoAuthMode\(\)/);
  assert.match(source, /\[email, setEmail\] = useState\(''\)/);
  assert.match(source, /\[password, setPassword\] = useState\(''\)/);
  assert.doesNotMatch(source, /admin@demo\.local|demo-admin/);
  assert.match(source, /if \(!loading && !session\) emailRef\.current\?\.focus\(\)/);
  assert.match(source, /aria-invalid=\{Boolean\(fieldErrors\.email\)\}/);
  assert.match(source, /aria-invalid=\{Boolean\(fieldErrors\.password\)\}/);
  assert.match(source, /aria-busy=\{submitting\}/);
  assert.match(source, /\{demoMode \? <p className="field-help">Modo demo local:/);
});

test('UI01 dashboard filters source activity and only offers links covered by the current role', async () => {
  const source = await readFile(dashboard, 'utf8');

  assert.match(source, /filterDashboardReadings\(vitalReadings, dateRange\)/);
  assert.match(source, /getDashboardActions\(shifts, hospitalizations, patients, dateRange\)/);
  assert.match(source, /data-action-id="DASHBOARD-DATE-FROM"/);
  assert.match(source, /data-action-id="DASHBOARD-DATE-TO"/);
  assert.match(source, /can\('agenda:read'\)/);
  assert.match(source, /can\('patients:read'\)/);
  assert.match(source, /can\('quotes:read'\)/);
});
