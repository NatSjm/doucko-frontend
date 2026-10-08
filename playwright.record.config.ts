import { defineConfig, devices } from '@playwright/test';

// Phase 6 recordings (`node tools/record-e2e-clips.mjs`): the clips in e2e/recordings/ drive and
// assert their FRs in Chromium at 1280×720 with video on; the tool turns the JSON report into the
// manifest that scripts/check-recordings.mjs validates. Served by `vite preview` of the build.
const port = 4181;

export default defineConfig({
  testDir: './e2e/recordings',
  outputDir: 'test-results-record',
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results-record/report.json' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: `npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
