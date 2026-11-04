import { defineConfig } from '@playwright/test';
if (
  process.env.ANALIZA_QA_MODE !== '1' ||
  process.env.PGDATABASE !== 'analiza_qa' ||
  process.env.PGHOST !== '127.0.0.1'
)
  throw new Error('Clinical black-box tests require the isolated synthetic PostgreSQL database.');
const port = 4317;
export default defineConfig({
  testDir: './e2e-clinical',
  timeout: 90000,
  workers: 1,
  fullyParallel: false,
  reporter: [['line']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  webServer: {
    command: `npm run start --workspace=@analiza/web -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    timeout: 60000,
    reuseExistingServer: false,
  },
});
