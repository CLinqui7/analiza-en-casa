import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-registration',
  timeout: 60000,
  workers: 1,
  fullyParallel: false,
  reporter: [['line']],
  use: {
    baseURL: process.env.REGISTRATION_TEST_URL ?? 'http://127.0.0.1:4311',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
