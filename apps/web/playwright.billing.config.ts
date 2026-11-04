import { defineConfig } from '@playwright/test';
if (
  process.env.ANALIZA_QA_MODE !== '1' ||
  process.env.PGDATABASE !== 'analiza_qa' ||
  process.env.PGHOST !== '127.0.0.1'
)
  throw new Error('Billing QA requires the isolated synthetic database.');
export default defineConfig({
  testDir: './e2e-billing',
  timeout: 90000,
  workers: 1,
  fullyParallel: false,
  reporter: [['line']],
  use: {
    baseURL: 'http://127.0.0.1:55440',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    trace: 'off',
    screenshot: 'only-on-failure',
  },
});
