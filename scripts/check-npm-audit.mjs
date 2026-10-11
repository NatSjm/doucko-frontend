// Dependency audit with an owner-approved advisory waiver list.
//
//   node scripts/check-npm-audit.mjs [--level=high]
//
// Runs `npm audit --json` over ALL dependencies (dev included) and fails on any
// vulnerability at or above --level (default high) unless EVERY advisory behind
// it is listed in docs/qa/waivers/npm-audit.json:
//
//   { "advisories": [ { "id": "GHSA-…", "package": "braces", "reason": "…",
//                       "approvedBy": "…", "approved": "YYYY-MM-DD", "reviewBy": "YYYY-MM-DD" } ] }
//
// A waiver past its reviewBy date no longer counts (the audit fails again), so a
// waiver can never silently become permanent. Waivers that match nothing are
// reported as stale so they get removed once upstream ships a fix.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const level = (process.argv.find((a) => a.startsWith("--level=")) ?? "--level=high").slice(8);
if (!(level in RANK)) {
  console.error(`check-npm-audit: unknown --level=${level}`);
  process.exit(2);
}

const WAIVERS = "docs/qa/waivers/npm-audit.json";
const today = new Date().toISOString().slice(0, 10);
const waivers = existsSync(WAIVERS) ? JSON.parse(readFileSync(WAIVERS, "utf8")).advisories ?? [] : [];
const active = new Map();
for (const w of waivers) {
  if (!w.id || !w.reason || !w.approvedBy || !w.reviewBy) {
    console.error(`FAIL  ${WAIVERS}: entry ${JSON.stringify(w)} needs id, reason, approvedBy and reviewBy`);
    process.exit(1);
  }
  if (w.reviewBy < today) console.log(`EXPIRED waiver ${w.id} (reviewBy ${w.reviewBy}) — no longer counts`);
  else active.set(w.id, w);
}

const r = spawnSync("npm", ["audit", "--json"], { encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024 });
let report;
try {
  report = JSON.parse(r.stdout);
} catch {
  console.error(`FAIL  npm audit produced no JSON (exit ${r.status}): ${(r.stderr || "").trim().split("\n")[0]}`);
  process.exit(1);
}
if (report.error) {
  console.error(`FAIL  npm audit error: ${report.error.summary ?? JSON.stringify(report.error)}`);
  process.exit(1);
}

const vulns = Object.values(report.vulnerabilities ?? {});
// The advisories (GHSA ids) a package's finding rests on, following `via` through other packages.
const byName = Object.fromEntries(vulns.map((v) => [v.name, v]));
function advisories(v, seen = new Set()) {
  if (seen.has(v.name)) return [];
  seen.add(v.name);
  return v.via.flatMap((x) => {
    if (typeof x === "string") return byName[x] ? advisories(byName[x], seen) : [];
    return [(x.url ?? "").split("/").pop() || String(x.source)];
  });
}

const used = new Set();
const failures = [];
const waived = [];
for (const v of vulns) {
  if (RANK[v.severity] < RANK[level]) continue;
  const ids = [...new Set(advisories(v))];
  const open = ids.filter((id) => !active.has(id));
  ids.filter((id) => active.has(id)).forEach((id) => used.add(id));
  (open.length || ids.length === 0 ? failures : waived).push(`${v.name} (${v.severity}): ${ids.join(", ") || "no advisory id"}`);
}

for (const w of waived) console.log(`WAIVED ${w}`);
for (const f of failures) console.log(`FAIL  ${f}`);
for (const id of active.keys()) if (!used.has(id)) console.log(`STALE waiver ${id}: matches nothing now — remove it from ${WAIVERS}`);

console.log(`\nScope: ${vulns.length} audited finding(s) at any severity; level ${level}; ${active.size} active waiver(s)`);
console.log(`Result: ${failures.length ? "FAIL" : waived.length ? "PASS (with waivers)" : "PASS"}`);
process.exit(failures.length ? 1 : 0);
