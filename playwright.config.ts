import { defineConfig, devices } from '@playwright/test';

// E2E_BASE_URL points at a running stack (Phase 5: `docker compose up`).
// Without it, Playwright builds the app and serves it with `vite preview`.
const externalBaseUrl = process.env.E2E_BASE_URL;
const previewPort = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${previewPort}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${previewPort} --strictPort`,
        url: `http://localhost:${previewPort}`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
