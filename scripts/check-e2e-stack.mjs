// Doučko (PD-16) — G5 real-stack E2E evidence check (frontend role). No Docker.
//
// The frontend's `npm run test:e2e:stack` (tools/e2e-stack-run.mjs) runs the
// Playwright suite e2e/stack/ against the isolated compose stack and writes
// docs/qa/e2e-stack-latest.md. This check reads that committed evidence and
// decides whether it still proves the code at HEAD. It is the ONE
// implementation used by both gate-status (G5 key `e2eStack`) and the
// qa-verify battery member `e2e-stack-evidence`.
//
// PASS only when ALL hold:
//   - the file is the full-run evidence ("# Real-stack E2E latest", Playwright
//     args "(none…", "Stack: taken down");
//   - "Result: PASS" and "Tests: <n> passed, 0 failed, 0 flaky, 0 skipped", n > 0;
//   - "Frontend commit: <sha>" is clean (no "(working tree dirty)"), exists,
//     is an ancestor of HEAD, and `git diff <sha> HEAD` touches only
//     docs/qa/ and trace/ paths (evidence/ledger commits after the run).
// Otherwise:
//   - evidence says "Result: FAIL"                → Result: FAIL (exit 1)
//   - file missing, before any product code       → Result: SKIP-pending (exit 0)
//   - anything else (missing over product code, stale, narrowed, malformed,
//     NOT-EARNED run)                               → Result: NOT-EARNED (exit 1)
// Absence of evidence is never PASS (lesson vacuous-pass-not-earned).
//
//   node scripts/check-e2e-stack.mjs [--file=<path>]
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { hasProductCode } from "./lib/factory-config.mjs";

const root = process.cwd();
const rel = process.argv.slice(2).find((a) => a.startsWith("--file="))?.slice(7) ?? "docs/qa/e2e-stack-latest.md";
const FRESH_PATHS = /^(docs\/qa\/|trace\/)/;
const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });

function finish(result, scope, reasons) {
  console.log(`e2e-stack evidence: ${rel}`);
  for (const r of reasons) console.log(`  - ${r}`);
  console.log(`Scope: ${scope} real-stack test(s)`);
  console.log(`Result: ${result}`);
  process.exit(result === "PASS" || result === "SKIP-pending" ? 0 : 1);
}

if (!existsSync(resolve(root, rel))) {
  if (!hasProductCode(root)) finish("SKIP-pending", 0, ["no real-stack run recorded yet and no product code (pre-Phase 5)"]);
  finish("NOT-EARNED", 0, [`missing: run \`npm run test:e2e:stack\` (Docker) and commit ${rel}`]);
}

const md = readFileSync(resolve(root, rel), "utf8").replace(/\r\n/g, "\n");
const field = (name) => md.match(new RegExp(`^- ${name}:\\s*(.+)$`, "m"))?.[1].trim() ?? null;
const problems = [];

if (!/^# Real-stack E2E latest\s*$/m.test(md)) problems.push('not full-run evidence (heading is not "# Real-stack E2E latest")');
const pwArgs = field("Playwright args");
if (!pwArgs || !pwArgs.startsWith("(none")) problems.push(`narrowed run (Playwright args: ${pwArgs ?? "missing"})`);
const stack = field("Stack");
if (stack !== "taken down") problems.push(`stack not taken down (Stack: ${stack ?? "missing"})`);

const tests = field("Tests")?.match(/^(\d+) passed, (\d+) failed, (\d+) flaky, (\d+) skipped$/);
const passed = tests ? Number(tests[1]) : 0;
if (!tests) problems.push(`no test counts (Tests: ${field("Tests") ?? "missing"})`);
else {
  const [, , failed, flaky, skipped] = tests.map(Number);
  if (passed === 0) problems.push("0 tests passed");
  if (failed || flaky || skipped) problems.push(`${failed} failed, ${flaky} flaky, ${skipped} skipped (all must be 0)`);
}

const resultLine = field("Result");
const result = resultLine?.match(/^(PASS|FAIL|NOT-EARNED)\b/)?.[1] ?? null;
if (result !== "PASS") problems.push(`recorded result is ${resultLine ?? "missing"}`);

// Freshness: the recorded frontend commit must still describe HEAD's code.
const commitField = field("Frontend commit");
const sha = commitField?.match(/^([0-9a-f]{7,40})\b/)?.[1] ?? null;
let staleBy = [];
if (!sha) problems.push(`no recorded frontend commit (Frontend commit: ${commitField ?? "missing"})`);
else {
  if (/dirty/.test(commitField)) problems.push(`run was on a dirty working tree (${commitField})`);
  const head = git("rev-parse", "--short", "HEAD").stdout.trim();
  if (git("cat-file", "-e", `${sha}^{commit}`).status !== 0) problems.push(`recorded commit ${sha} does not exist in this repo`);
  else if (git("merge-base", "--is-ancestor", sha, "HEAD").status !== 0) problems.push(`recorded commit ${sha} is not an ancestor of HEAD ${head}`);
  else {
    const diff = git("diff", "--name-only", sha, "HEAD");
    if (diff.status !== 0) problems.push(`git diff ${sha} HEAD failed`);
    staleBy = diff.stdout.split("\n").map((s) => s.trim()).filter(Boolean).filter((p) => !FRESH_PATHS.test(p));
    if (staleBy.length) {
      problems.push(`stale: ${staleBy.length} path(s) outside docs/qa/ and trace/ changed between ${sha} and HEAD ${head}:`);
      for (const p of staleBy.slice(0, 20)) problems.push(`    ${p}`);
      if (staleBy.length > 20) problems.push(`    … ${staleBy.length - 20} more`);
    } else console.log(`fresh: ${sha} → HEAD ${head} touches only docs/qa/ and trace/`);
  }
}

if (!problems.length) finish("PASS", passed, [`${passed} passed, 0 failed, 0 flaky, 0 skipped at ${sha}`]);
if (result === "FAIL") finish("FAIL", passed, problems);
finish("NOT-EARNED", passed, problems);
