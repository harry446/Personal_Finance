import 'dotenv/config';

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'unauthenticated',
      testMatch: /[\\/]unauthenticated\.spec\.ts$/,
    },
  ],
  webServer: {
    command: 'npm run build && npm run start -- --port 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: false,
    env: {
      ...process.env,
      AUTH_GOOGLE_ID:
        process.env.AUTH_GOOGLE_ID ?? 'browser-test-google-client',
      AUTH_GOOGLE_SECRET:
        process.env.AUTH_GOOGLE_SECRET ?? 'browser-test-google-secret',
      AUTH_SECRET:
        process.env.AUTH_SECRET ??
        'browser-test-auth-secret-that-is-not-used-in-production',
      NEXT_DIST_DIR: '.next-playwright',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3001',
      NEXTAUTH_SECRET:
        process.env.AUTH_SECRET ??
        'browser-test-auth-secret-that-is-not-used-in-production',
      NEXTAUTH_URL: 'http://localhost:3001',
    },
  },
});
