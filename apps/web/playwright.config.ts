import { defineConfig } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT ?? '4205';
const baseURL = `http://127.0.0.1:${port}`;
const serverCommand = process.env.PLAYWRIGHT_SERVER_MODE === 'production' ? 'start' : 'dev';

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
    // The production mode exercises a freshly built Next server, including API functions.
    // It never changes assertions, authentication or test coverage.
    command: `npm run ${serverCommand} --workspace=@analiza/web -- --port ${port}`,
    url: baseURL,
    // A reused development process can serve an obsolete route tree. Release
    // verification must either start a fresh server or fail visibly.
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true',
    timeout: 60_000,
  },
});
