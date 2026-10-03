// REFERENCE IMPLEMENTATION — accessibility / contrast gate (axe-core).
//
// Runs axe-core (WCAG 2 A/AA, incl. color-contrast) headless against the app, in BOTH light and
// dark color schemes, over the app's routes. Fails on serious/critical violations.
//
// IMPORTANT: axe is necessary but NOT sufficient. In a real run axe passed an app
// a human (and the vision-judge) judged poorly contrasted. ALWAYS pair this with
// the vision-verify workflow — structural a11y here, eyes-on-pixels there.
//
// PD-11 (Doučko): writes the artifact check-acceptance-methods reads —
// docs/qa/a11y-report.json { status: passed|failed, routes, schemes, failures } — and finds its own
// inputs:
//   - routes: env A11Y_ROUTES="/,/admin", else the string literals of ROUTE_PATHS in
//     src/app/route-paths.ts (the frontend's route registry);
//   - app: env BASE_URL (a running stack), else it serves the built dist/ with `vite preview`
//     itself (run `npm run build` first).
//
// Requires `@playwright/test` + `@axe-core/playwright`.
// Run: `npm run check:a11y`  (env: BASE_URL, A11Y_ROUTES).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const REPORT = "docs/qa/a11y-report.json";
const PREVIEW_PORT = 4174;
const SCHEMES = ["light", "dark"];

function routes() {
  if (process.env.A11Y_ROUTES) return process.env.A11Y_ROUTES.split(",").map((s) => s.trim()).filter(Boolean);
  const registry = "src/app/route-paths.ts";
  if (existsSync(registry)) {
    const block = readFileSync(registry, "utf8").match(/ROUTE_PATHS\s*=\s*\[([^\]]*)\]/);
    const found = block ? [...block[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((m) => m[1]) : [];
    if (found.length) return found;
  }
  return ["/"];
}

async function reachable(url) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

const failures = [];
let preview = null;
// Stop the preview server and its children (on Windows, kill() would only end the shell).
function stopPreview() {
  if (!preview) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(preview.pid), "/T", "/F"], { stdio: "ignore" });
  else preview.kill();
}
async function main() {
  let baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    if (!existsSync("dist/index.html")) throw new Error("no BASE_URL and no dist/ build — run `npm run build` first, or set BASE_URL");
    baseUrl = `http://localhost:${PREVIEW_PORT}`;
    preview = spawn("npx", ["vite", "preview", "--port", String(PREVIEW_PORT), "--strictPort"], { stdio: "ignore", shell: true });
  }
  if (!(await reachable(baseUrl))) throw new Error(`app not reachable at ${baseUrl}`);
  const ROUTES = routes();

  const browser = await chromium.launch();
  for (const colorScheme of SCHEMES) {
    const ctx = await browser.newContext({ colorScheme, viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    for (const route of ROUTES) {
      try {
        await page.goto(baseUrl + route, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
        for (const v of violations) {
          if (v.impact === "serious" || v.impact === "critical") {
            failures.push(`[${colorScheme}] ${route} — ${v.id} (${v.impact}, ${v.nodes.length} node(s)): ${v.help}`);
          }
        }
      } catch (e) {
        failures.push(`[${colorScheme}] ${route} — could not analyze: ${e.message}`);
      }
    }
    await ctx.close();
  }
  await browser.close();

  mkdirSync("docs/qa", { recursive: true });
  const report = { generatedBy: "scripts/check-a11y.mjs", status: failures.length ? "failed" : "passed", baseUrl, routes: ROUTES, schemes: SCHEMES, failures };
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);

  for (const f of failures) console.error(`FAIL  ${f}`);
  console.log(`\na11y: ${ROUTES.length} route(s) × ${SCHEMES.length} scheme(s) — ${failures.length} serious/critical violation(s). Wrote ${REPORT}`);
  console.log(failures.length ? "Fix the violations, then re-run. (Also run vision-verify — axe misses perceived contrast.)" : "axe clean. Still run vision-verify for eyes-on-pixels.");
  console.log(`Result: ${failures.length ? "FAIL" : "PASS"}`);
  return failures.length ? 1 : 0;
}

main()
  .then((code) => {
    stopPreview();
    process.exit(code);
  })
  .catch((e) => {
    stopPreview();
    console.error(e.message);
    console.log("Result: FAIL");
    process.exit(1);
  });
