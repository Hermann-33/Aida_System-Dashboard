import { defineConfig, devices } from '@playwright/test';

const WEB = process.env.E2E_WEB_URL || 'http://localhost:5173';
const PREVIEW_SUITE = process.argv.some((argument) => argument.includes('preview-closure'));

/**
 * Supported browser gates run against the current same-origin Dashboard/BFF
 * architecture. Preview closure additionally enables fixture-only UI mode and
 * asserts that privileged/live authority is never silently replaced by mocks.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: WEB,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run dev -- --port 5173 --strictPort',
        url: WEB,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          ...(PREVIEW_SUITE ? { VITE_UI_PREVIEW_MODE: 'true' } : {}),
        },
      },
});
