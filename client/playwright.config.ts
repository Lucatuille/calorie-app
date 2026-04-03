import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(import.meta.dirname, 'e2e', '.auth-state.json');

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'https://caliro.dev',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'auth',
      testMatch: 'auth.spec.ts',
      use: { ...devices['Desktop Chrome'] },  // no storageState = fresh browser
    },
    {
      name: 'chromium',
      testIgnore: 'auth.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
      // dependencies: ['auth'],  // run independently
    },
  ],
});
