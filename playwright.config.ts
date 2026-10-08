import { defineConfig, devices } from '@playwright/test';

// E2E_BASE_URL points at a running stack (Phase 5: `docker compose up`).
// Without it, Playwright builds the app and serves it with `vite preview`.
const externalBaseUrl = process.env.E2E_BASE_URL;
const previewPort = 4173;

export default defineConfig({
  testDir: './e2e',
  // e2e/stack/ is the real-stack suite (playwright.stack.config.ts, `npm run test:e2e:stack`): no mocks.
  testIgnore: ['stack/**', 'recordings/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // PW_WORKERS caps parallel browsers on a loaded machine (Firefox times out under load); default: Playwright's.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${previewPort}`,
    trace: 'retain-on-failure',
  },
  // NFR-6: current Chrome, Edge and Firefox on a laptop at 1280×720. `msedge` drives the installed
  // Edge (Windows ships it); `npx playwright install firefox` provides Firefox. A missing browser
  // fails the run, it is never skipped.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    { name: 'msedge', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1280, height: 720 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 } } },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${previewPort} --strictPort`,
        url: `http://localhost:${previewPort}`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
