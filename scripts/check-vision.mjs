// Doučko factory — vision-verify gate (PD-9). NEW: no upstream equivalent.
//
// The vision-verify WORKFLOW (.claude/workflows/vision-verify.js) is the
// producer: a fresh vision-judge looks at each recorded still and writes its
// verdict into the clip's entry in docs/qa/**/manifest.json:
//   "vision": { "met": <bool>, "readable": <bool>, "notes": "..." }
// This script is the deterministic GATE over those verdicts. It is the
// `vision-verify` mechanism that check-acceptance-methods resolves
// (npm script `check:vision`), and it writes the artifact that artifact mode
// validates: docs/qa/vision-report.json with `met: true` only when every
// requirement this repo owns that declares vision-verify is shown by at least
// one recorded clip whose screenshot exists and whose verdict is met AND
// readable.
//
// Three-valued, never a vacuous PASS (lesson vacuous-pass-not-earned):
//   - no owned requirement declares vision-verify  -> SKIP-pending (exit 0)
//   - verdicts missing, no product code, no --strict -> SKIP-pending (exit 0)
//   - verdicts missing while product code exists    -> NOT-EARNED (exit 1)
//   - any judged clip not met/readable, or a screenshot missing -> FAIL (exit 1)
//   - every required id covered by a met+readable clip -> PASS (exit 0)
//
// Usage:
//   node scripts/check-vision.mjs            # gate the committed verdicts
//   node scripts/check-vision.mjs --run      # run the vision-verify workflow first (billed), then gate
//   node scripts/check-vision.mjs --strict   # missing verdicts are NOT-EARNED even before product code
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { hasProductCode, loadConfig, ownership } from "./lib/factory-config.mjs";

const root = process.cwd();
const flags = new Set(process.argv.slice(2));
const CFG = loadConfig(root);
const QA = "docs/qa";
const REPORT = "docs/qa/vision-report.json";
const ID_RE = /\b(?:FR|NFR)-(?:[A-Z0-9]+-)?\d+\b/g;

const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : null);

if (flags.has("--run")) {
  const r = spawnSync(process.execPath, ["scripts/run-workflow.mjs", "vision-verify"], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) console.error(`WARN  [run] vision-verify workflow exited ${r.status} — gating whatever verdicts exist`);
}

// ---------- 1. required ids: owned MVP rows that declare vision-verify ----------
const reqText = read(CFG.paths.requirements);
if (reqText === null) {
  console.error(`FAIL  [requirements] ${CFG.paths.requirements} not found (${CFG.contractNote ?? "no contract"})`);
  console.log("Result: FAIL");
  process.exit(1);
}
const own = ownership(root);
const required = [];
for (const line of reqText.split("\n")) {
  const m = line.match(/^\|\s*((?:FR|NFR)-(?:[A-Z0-9]+-)?\d+)\s*\|/);
  if (!m || /\|\s*Future\s*\|/i.test(line)) continue;
  const cells = line.split("|").slice(1, -1).map((c) => c.trim().replace(/`/g, ""));
  const tags = (cells.at(-1) ?? "").toLowerCase().split(/[\s,;/+]+/);
  if (tags.includes("vision-verify") && own.owns(m[1])) required.push(m[1]);
}

// ---------- 2. clips with verdicts ----------
function* manifests(rel) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return;
  for (const e of readdirSync(abs)) {
    const r = `${rel}/${e}`;
    const st = statSync(join(root, r));
    if (st.isDirectory()) yield* manifests(r);
    else if (e === "manifest.json") yield r;
  }
}
const clips = [];
const failures = [];
const warnings = [];
for (const mf of manifests(QA)) {
  let data;
  try {
    data = JSON.parse(read(mf));
  } catch {
    failures.push(`${mf} is not valid JSON`);
    continue;
  }
  for (const c of data?.results ?? []) {
    const ids = [...new Set(String(c.proof ?? "").match(ID_RE) ?? [])];
    const shot = typeof c.screenshot === "string" && existsSync(join(root, c.screenshot));
    clips.push({ manifest: mf, id: c.id ?? "?", ids, screenshot: c.screenshot ?? null, shot, vision: c.vision ?? null });
  }
}

// ---------- 3. join ----------
const rows = required.map((id) => {
  const proving = clips.filter((c) => c.ids.includes(id));
  const judged = proving.filter((c) => c.vision && typeof c.vision.met === "boolean");
  const bad = judged.filter((c) => !(c.vision.met === true && c.vision.readable === true) || !c.shot);
  const good = judged.filter((c) => c.vision.met === true && c.vision.readable === true && c.shot);
  for (const c of bad)
    failures.push(`${id}: clip "${c.id}" (${c.manifest}) ${!c.shot ? `screenshot missing: ${c.screenshot}` : `vision met=${c.vision.met} readable=${c.vision.readable}`} — fix the UI, re-record, re-run vision-verify`);
  const status = bad.length ? "fail" : good.length ? "met" : proving.length ? "unjudged" : "no-clip";
  return { id, clips: proving.map((c) => c.id), met: status === "met", status };
});
const missing = rows.filter((r) => r.status === "no-clip" || r.status === "unjudged");

let result;
if (required.length === 0) result = "SKIP-pending";
else if (failures.length) result = "FAIL";
else if (missing.length) result = flags.has("--strict") || hasProductCode(root) ? "NOT-EARNED" : "SKIP-pending";
else result = "PASS";
for (const r of missing)
  (result === "NOT-EARNED" ? failures : warnings).push(`${r.id}: ${r.status === "no-clip" ? "no recorded clip proves it" : "its clip(s) have no vision verdict"} — record it (qa:record-demos) and run vision-verify`);

// ---------- 4. artifact (deterministic, no timestamps) ----------
const report = {
  generatedBy: "scripts/check-vision.mjs",
  result,
  met: result === "PASS",
  readable: result === "PASS",
  scope: required.length,
  requirements: rows,
  failures,
};
if (required.length) {
  mkdirSync(join(root, QA), { recursive: true });
  writeFileSync(join(root, REPORT), `${JSON.stringify(report, null, 2)}\n`);
}

for (const w of warnings) console.warn(`WARN  [vision] ${w}`);
for (const f of failures) console.error(`FAIL  [vision] ${f}`);
console.log(`\nScope: ${required.length} requirement(s) declaring vision-verify owned by ${CFG.repo}; ${clips.length} recorded clip(s)`);
if (required.length) console.log(`wrote ${REPORT}`);
console.log(`Result: ${result}`);
process.exit(result === "FAIL" || result === "NOT-EARNED" ? 1 : 0);
