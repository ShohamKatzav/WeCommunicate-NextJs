// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  workers: process.env.CI ? 1 : 6,
  reporter: [['html', { outputFolder: 'playwright-report' }]],

  use: {
    extraHTTPHeaders: {
      'x-bypass-ratelimit': process.env.TEST_BYPASS_KEY || '',
    },
    baseURL: process.env.CI ? 'https://wecommunicate-nextjs.onrender.com/' : 'https://localhost:3000/',
    trace: 'on-first-retry',
    headless: process.env.CI ? true : false,
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: 'utils/global.setup.ts',
    },
    {
      name: 'parallel',
      testIgnore: /(chat|presence)-.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/state.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'presence-serial',
      testMatch: /(presence)-.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/state.json',
      },
      dependencies: ['setup', 'parallel'],
      workers: 1,
    },
    {
      name: 'chat-serial',
      testMatch: /(chat)-.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/state.json',
      },
      dependencies: ['setup', 'parallel', 'presence-serial'],
      workers: 1,
    },
  ],
});