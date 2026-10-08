// Phase 6 recordings for the FRs the per-slice recorders (tools/record-slice*.mjs) did not cover:
// runs the clips in e2e/recordings/ (playwright.record.config.ts: headless Chromium, 1280×720, video
// on), where each clip DRIVES its flow and ASSERTS the FRs it names (`proof` annotation) and attaches
// a settled full-page still. This tool copies each clip's video and still under OUT_DIR and writes the
// explainers and the manifest in the shape of scripts/record-demos.mjs, which
// scripts/check-recordings.mjs validates. A clip is `asserted: true` only when its test passed AND its
// video and still exist; otherwise it is written `asserted: false` and the tool exits 1, as it does
// for a clip in EXPECTED with no result and for a result not in EXPECTED. Re-recording replaces the
// stills, so it drops the vision verdicts on purpose: re-run vision-verify over the new stills.
// Never opens the user's browser.
//
// Run: `npm run build && node tools/record-e2e-clips.mjs`
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = 'docs/qa/demo-recordings/phase6-admin-theme';
const REPORT = 'test-results-record/report.json';
/** Every clip e2e/recordings/ must produce (its title prefix): a missing one fails the run. */
const EXPECTED = [
  'rec-source-upload',
  'rec-pdf-beside-editor',
  'rec-task-images',
  'rec-parts-hints-translations',
  'rec-preview-tester',
  'rec-task-list-provenance',
  'rec-skin-hq',
  'rec-theme-light',
  'rec-theme-dark',
  'rec-stats',
  'rec-flag-queue',
];

if (!existsSync('dist/index.html')) throw new Error('dist/ is missing: run `npm run build` first');
rmSync('test-results-record', { recursive: true, force: true });
spawnSync('npx playwright test -c playwright.record.config.ts', { shell: true, stdio: 'inherit' });
if (!existsSync(REPORT)) throw new Error(`${REPORT} missing: the recording run did not complete`);

const report = JSON.parse(readFileSync(REPORT, 'utf8'));
const specs = [];
const walk = (suite) => {
  for (const s of suite.specs ?? []) specs.push(s);
  for (const child of suite.suites ?? []) walk(child);
};
for (const s of report.suites) walk(s);

const strip = (text) => text.replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0];
const usable = (path) => !!path && existsSync(path) && statSync(path).size > 0;

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
const results = [];
const seen = new Set();
let failed = 0;
for (const spec of specs) {
  const match = /^(rec-[\w-]+): (.*)$/.exec(spec.title);
  if (!match || !EXPECTED.includes(match[1])) {
    failed += 1;
    console.log(`✗ unexpected clip "${spec.title}" (not in EXPECTED)`);
    continue;
  }
  const [, id, title] = match;
  seen.add(id);
  const run = spec.tests[0]?.results?.at(-1);
  if (!run) {
    failed += 1;
    console.log(`✗ ${id}: no result in the report`);
    continue;
  }
  const proof = spec.tests[0].annotations?.find((a) => a.type === 'proof')?.description ?? '';
  const out = (ext) => join(OUT_DIR, `${id}.${ext}`).replaceAll('\\', '/');
  const video = run.attachments.find((a) => a.name === 'video')?.path;
  const still = run.attachments.find((a) => a.name === 'still')?.path;
  const hasVideo = usable(video);
  const hasStill = usable(still);
  if (hasVideo) copyFileSync(video, out('webm'));
  if (hasStill) copyFileSync(still, out('png'));
  const error =
    run.status !== 'passed'
      ? strip(run.error?.message ?? run.status)
      : !hasVideo
        ? 'no video recorded'
        : !hasStill
          ? 'no still attached'
          : !proof
            ? 'no proof annotation'
            : null;
  const asserted = error === null;
  if (!asserted) failed += 1;
  writeFileSync(
    out('md'),
    `# ${title}\n\n**Proves:** ${proof}\n\n**Result:** ${asserted ? 'asserted ✓' : `FAILED — ${error}`}\n\n` +
      `Clip \`${spec.title}\` in \`e2e/recordings/admin-and-theme.spec.ts\`: the steps and every assertion are the ` +
      `test body (Playwright \`expect\`). Recorded against the production build (\`vite preview\`) with the API ` +
      `answered by the contract stubs \`src/test/fake-admin-backend.ts\` / \`src/test/fake-child-backend.ts\` ` +
      `(self-authored data). The real-stack suite is \`e2e/stack/\` (docs/qa/e2e-stack-latest.md).\n\n![still](${id}.png)\n`,
  );
  results.push({ id, title, proof, video: out('webm'), screenshot: out('png'), explainer: out('md'), asserted, ...(error ? { error } : {}) });
  console.log(`${asserted ? '✓' : '✗'} ${id} (${proof})${error ? ` — ${error}` : ''}`);
}
for (const id of EXPECTED.filter((e) => !seen.has(e))) {
  failed += 1;
  console.log(`✗ ${id}: expected clip missing from the report`);
}
writeFileSync(join(OUT_DIR, 'manifest.json'), `${JSON.stringify({ kind: 'demo', results }, null, 2)}\n`);
console.log(`${results.length} clip(s), ${failed} problem(s) → ${OUT_DIR}/manifest.json`);
process.exit(failed || results.length === 0 ? 1 : 0);
