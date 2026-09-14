import { spawnSync } from 'node:child_process';

for (const key of ['ANALIZA_VERIFY_URL', 'MONGODB_INITIAL_ADMIN_EMAIL', 'MONGODB_INITIAL_ADMIN_PASSWORD']) {
  if (!process.env[key]) throw new Error(`Missing private verification setting: ${key}`);
}
const result = spawnSync(process.platform === 'win32' ? 'py' : 'python3', ['tests/selenium/test_core_connected.py'], {
  stdio: 'inherit', env: process.env,
});
process.exitCode = result.status ?? 1;
