import { defineConfig } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT ?? '4174';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL,
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev --workspace=@analiza/web -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
