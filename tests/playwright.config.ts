// @ts-check
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

/**
 * @see https://playwright.dev/docs/test-configuration
 */

export default defineConfig({
  testDir: './',
  timeout: 30 * 1000,
  retries: process.env.CI ? 3 : 0,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  workers: process.env.CI ? 1 : 6,
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  webServer: process.env.CI ? undefined : {
    command: 'pnpm dev',
    url: 'https://localhost:3000',
    cwd: path.resolve(__dirname, '..'),
    reuseExistingServer: !process.env.CI,
    ignoreHTTPSErrors: true,
  },
  use: {
    ignoreHTTPSErrors: true,
    // baseURL: process.env.CI ? 'https://wecommunicate-nextjs.onrender.com/' : 'https://localhost:3000/',
    baseURL: 'https://wecommunicate-nextjs.onrender.com/',
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