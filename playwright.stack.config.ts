import { defineConfig, devices } from '@playwright/test';

// Phase 5 (G5): the real-stack suite. e2e/stack/ runs against the isolated compose project
// `doucko-e2e` (Postgres + backend + nginx frontend) that `node tools/e2e-stack-run.mjs` brings up
// from the backend checkout, seeds, and always takes down. No route mocks: every request goes
// through nginx to the backend and Postgres. Never point E2E_STACK_URL at the owner's stack.
const baseURL = process.env.E2E_STACK_URL ?? 'http://127.0.0.1:18082';

export default defineConfig({
  testDir: './e2e/stack',
  // Refuses to run against anything but the isolated e2e stack (fake child name), before any write.
  globalSetup: './e2e/stack/preflight.ts',
  // One child profile and one database: the journeys read XP and stats deltas, so they run one at a
  // time. Each test authors its own uniquely named content, so the order does not matter and a rerun
  // against the same (accumulated) state passes.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  // Real backend + Postgres in Docker: a save took 4.6 s on a loaded laptop, so the default 5 s
  // assertion window failed random tests. A wrong state still fails; it just fails after 15 s.
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-stack' }]],
  outputDir: 'test-results-stack',
  use: { baseURL, trace: 'retain-on-failure' },
  // NFR-6 browsers as in playwright.config.ts; `--project=chromium` narrows a run.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    { name: 'msedge', use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1280, height: 720 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 } } },
  ],
});
