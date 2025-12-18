// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  workers: process.env.CI ? 1 : 6,
  reporter: 'html',

  use: {
    baseURL: 'https://wecommunicate-nextjs.onrender.com/',
    trace: 'on-first-retry',
    headless: process.env.CI ? true : false,
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});