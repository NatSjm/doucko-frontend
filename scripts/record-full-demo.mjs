// One continuous demo take (≤ 2 min) for the course capstone: the product first, then how it was
// built. Drives a HEADED Chromium at human pace and records docs/qa/full-demo/full-demo.webm.
//
// Story: the admin (mum) uploads a workbook-page PDF, types a fraction task with a hint and a
// Ukrainian translation, publishes it and puts it into a mission -> the child opens HQ, starts the
// mission, shows the Ukrainian translation, sends an unreadable answer (no attempt used), a wrong
// one, opens the hint and solves it -> mission summary -> admin stats -> the public GitHub repos
// (Project Factory, OpenSpec stores beta, slice archive, review findings, process defects, e2e).
//
// Captions are Ukrainian and drawn ON the page (a fixed bar fed through an exposed binding), so they
// are part of the video itself; full-demo.srt is written as well for YouTube.
//
// Target: ONLY the isolated e2e stack (backend: node tools/e2e-stack.mjs up && ... seed), which uses
// committed fake test values — never the owner's stack or the child's data (NFR-3). All task content
// is self-authored (NFR-4); the PDF "page" is generated here.
//
// Run:  node scripts/record-full-demo.mjs
// Env:  BASE_URL (default http://127.0.0.1:18082), E2E_STACK_ADMIN_PASSWORD (default: the e2e
//       stack's committed fake value), PACE (hold multiplier, default 0.85), HEADLESS=1 to hide the window.
import { chromium } from "@playwright/test";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:18082";
const ADMIN_PASSWORD = process.env.E2E_STACK_ADMIN_PASSWORD ?? "e2e-admin-password-not-secret";
const PACE = Number(process.env.PACE ?? 0.85);
const OUT_DIR = join("docs", "qa", "full-demo");
const SIZE = { width: 1600, height: 900 };
const GH = "https://github.com/NatSjm";

if (!/^http:\/\/(127\.0\.0\.1|localhost):18082\/?$/.test(BASE_URL)) {
  console.error(`record-full-demo: refusing ${BASE_URL} — only the isolated e2e stack (:18082) may be recorded.`);
  process.exit(2);
}

const started = Date.now();
const log = (msg) => console.log(`[${String(Math.round((Date.now() - started) / 1000)).padStart(3)}s] ${msg}`);

// ------------------------------------------------------------------ captions + SRT ----

let current = "";
let videoT0 = 0;
const captions = [];
let snapPending = false;
function caption(text) {
  current = text;
  snapPending = process.env.SNAP === "1";
  captions.push({ t: (Date.now() - videoT0) / 1000, text });
  log(`▶ ${text}`);
}

// Runs in every document (app, about:blank, GitHub): a bottom bar that mirrors `current`.
const CAPTION_BAR = () => {
  const mount = () => {
    if (document.getElementById("__demo_caption")) return;
    const bar = document.createElement("div");
    bar.id = "__demo_caption";
    Object.assign(bar.style, {
      position: "fixed", left: "50%", bottom: "28px", transform: "translateX(-50%)", zIndex: "2147483647",
      maxWidth: "86vw", padding: "12px 22px", borderRadius: "12px", background: "rgba(17,17,34,.86)",
      color: "#fff", font: "600 24px/1.35 system-ui, 'Segoe UI', sans-serif", textAlign: "center",
      boxShadow: "0 6px 24px rgba(0,0,0,.35)", pointerEvents: "none", transition: "opacity .25s",
    });
    document.documentElement.appendChild(bar);
    const tick = async () => {
      try {
        const text = await window.__demoCaption();
        bar.textContent = text;
        bar.style.opacity = text ? "1" : "0";
      } catch {}
    };
    tick();
    setInterval(tick, 150);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
};

const srtTime = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor((ms % 3600000) / 60000))}:${p(Math.floor((ms % 60000) / 1000))},${p(ms % 1000, 3)}`;
};
const buildSrt = (end) =>
  captions
    .map((c, i) => `${i + 1}\n${srtTime(c.t)} --> ${srtTime(i + 1 < captions.length ? captions[i + 1].t - 0.05 : end)}\n${c.text}\n`)
    .join("\n");

// ----------------------------------------------------------------------- helpers ----

let snapNo = 0;
const hold = async (page, ms) => {
  if (snapPending) {
    snapPending = false;
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(OUT_DIR, "snaps", `${String(++snapNo).padStart(2, "0")}.png`) }).catch(() => {});
    ms = Math.max(0, ms - 700 / PACE);
  }
  await page.waitForTimeout(ms * PACE);
};
const settle = (page, ms = 1500) => page.waitForLoadState("networkidle").catch(() => {}).then(() => hold(page, ms));
const typeInto = (locator, text) => locator.pressSequentially(text, { delay: 35 });

async function scroll(page, px, steps = 5) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, px / steps);
    await page.waitForTimeout(160 * PACE);
  }
}

async function xsrf(page) {
  const cookie = (await page.context().cookies()).find((c) => c.name === "XSRF-TOKEN");
  return cookie ? decodeURIComponent(cookie.value) : "";
}
async function api(page, method, path, data) {
  const response = await page.request[method](BASE_URL + path, data === undefined ? {} : { data, headers: { "X-XSRF-TOKEN": await xsrf(page) } });
  if (!response.ok()) throw new Error(`${method.toUpperCase()} ${path}: HTTP ${response.status()} ${await response.text()}`);
  return response.status() === 204 ? undefined : response.json();
}

// A self-authored one-page "workbook page" (no real workbook content, NFR-4).
function demoPdf() {
  const lines = ["Ukazkova stranka - Zlomky", "", "1. Vypocitej: 3/4 + 1/2 =", "2. Vypocitej: 2/3 + 1/6 =", "3. Porovnej: 5/8 a 3/4"];
  const [heading, ...rest] = lines;
  const text = `BT /F1 30 Tf 72 760 Td (${heading}) Tj ET\nBT /F1 22 Tf 34 TL 72 700 Td ${rest.map((l) => `(${l}) Tj T*`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [4 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const TITLE_CARD = (title, subtitle) => `<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;display:grid;place-items:center;
  background:radial-gradient(circle at 30% 20%,#3b2a7a,#141230 70%);color:#fff;font-family:system-ui,'Segoe UI',sans-serif">
  <div style="text-align:center;max-width:1100px;padding:0 40px">
    <div style="font-size:84px;font-weight:800;letter-spacing:-1px">${title}</div>
    <div style="font-size:30px;opacity:.85;margin-top:18px;line-height:1.4">${subtitle}</div>
  </div></body>`;

// ------------------------------------------------------------------------ the take ----

async function product(page) {
  const run = Date.now().toString(36).slice(-4);
  const prompt = "Vypočítej: 3/4 + 1/2";
  const sourceTitle = `Ukázkový sešit 6 · Zlomky (${run})`;

  // Title card
  await page.setContent(TITLE_CARD("Doučko", "домашній репетитор з математики"));
  caption("Doučko — домашній репетитор з математики для доньки, 6 клас чеської школи");
  await hold(page, 4500);

  // Admin sign-in
  caption("Мама — адмін: вносить задачі із зошита, з яким донька працює в школі");
  await page.goto(BASE_URL + "/admin");
  await typeInto(page.getByLabel("Password", { exact: true }), ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await settle(page, 1200);

  // FR-1: upload the page as a PDF source
  caption("Сторінка зошита — PDF-джерело. Сам зошит у репозиторій не потрапляє");
  await page.goto(BASE_URL + "/admin/sources");
  await settle(page, 600);
  await page.getByLabel("PDF file").setInputFiles({ name: "ukazkova-stranka.pdf", mimeType: "application/pdf", buffer: demoPdf() });
  await typeInto(page.getByLabel("Title", { exact: true }), sourceTitle);
  await page.getByRole("button", { name: "Upload source" }).click();
  await page.getByRole("status").filter({ hasText: "Source uploaded." }).waitFor();
  await hold(page, 1500);

  const source = (await api(page, "get", "/api/admin/sources")).find((s) => s.title === sourceTitle);
  const reference = await api(page, "get", "/api/admin/reference");
  const topics = reference.topics.filter((t) => t.grade === source.grade);
  const topic = topics.find((t) => /zlom/i.test(t.name)) ?? topics[0];

  // FR-3, FR-8: the task beside the PDF, a hint and the Ukrainian translation
  caption("Задача вводиться з клавіатури поруч із PDF: чеський текст і правильна відповідь");
  await page.goto(`${BASE_URL}/admin/tasks/edit?sourceId=${source.sourceId}&page=1`);
  await settle(page, 1200);
  await page.getByLabel("Task number", { exact: true }).fill("1");
  await typeInto(page.getByLabel("Prompt (Czech)", { exact: true }), prompt);
  await page.getByLabel("Topic", { exact: true }).selectOption({ label: topic.name });
  await page.getByLabel("Answer type").first().selectOption({ label: "Fraction" });
  await typeInto(page.getByLabel("Accepted answer 1"), "5/4");
  await hold(page, 800);

  caption("Підказка й український переклад — для тата, який займається з України");
  await page.getByRole("button", { name: "Add hint" }).click();
  await typeInto(page.getByLabel("Hint 1", { exact: true }), "Převeď oba zlomky na čtvrtiny: 1/2 = 2/4.");
  await typeInto(page.getByLabel("Prompt (uk)"), "Обчисли: 3/4 + 1/2");
  await typeInto(page.getByLabel("Hint 1 (uk)"), "Зведи обидва дроби до четвертин: 1/2 = 2/4.");
  await hold(page, 800);

  caption("Зберегти, опублікувати — задача доступна дитині");
  await page.getByRole("button", { name: "Save task" }).click();
  await page.getByRole("status").filter({ hasText: "Task saved as draft." }).waitFor();
  const task = (await api(page, "get", `/api/admin/tasks?sourceId=${source.sourceId}`))[0];
  await page.goto(`${BASE_URL}/admin/tasks/edit?taskId=${task.taskId}`);
  await settle(page, 600);
  const publishTask = page.getByRole("button", { name: "Publish task" });
  await publishTask.scrollIntoViewIfNeeded();
  await hold(page, 600);
  await publishTask.click();
  await page.getByText("Task published.").waitFor();
  await hold(page, 1400);

  // FR-9: a mission of the topic, holding the task, published
  caption("Задачі збираються в місію за темою");
  const missions = await api(page, "get", "/api/admin/missions");
  const position = Math.max(0, ...missions.filter((x) => x.topicId === topic.topicId).map((x) => x.position)) + 1;
  await page.goto(BASE_URL + "/admin/missions/edit");
  await settle(page, 600);
  await page.getByLabel("Topic", { exact: true }).selectOption({ label: topic.name });
  await page.getByLabel("Position", { exact: true }).fill(String(position));
  await typeInto(page.getByLabel("Search the topic’s tasks"), "3/4 + 1/2");
  await page.getByRole("region", { name: "Add tasks" }).getByRole("button", { name: `Add ${prompt}` }).last().click();
  await page.getByRole("button", { name: "Save mission" }).click();
  await page.waitForURL(/missionId=[0-9a-f-]{36}$/);
  const missionId = new URL(page.url()).searchParams.get("missionId");
  await hold(page, 500);
  await page.getByRole("button", { name: "Publish mission" }).click();
  await page.getByText("Mission published.").waitFor();
  await hold(page, 1400);

  // An earlier run's rank-up must not cover HQ
  const before = await api(page, "get", "/api/child/hq");
  if (before.pendingRankUp) await api(page, "post", "/api/child/hq/rank-up-ack", { rankIndex: before.pendingRankUp.index });

  // FR-24, FR-25: the child's HQ (no login)
  caption("Дитина бачить свій штаб: місії, ранг і досвід. Інтерфейс чеською, як у школі");
  await page.goto(BASE_URL + "/");
  await settle(page, 2600);
  const card = page.locator(`a[href="/mission?missionId=${missionId}"]`);
  await card.scrollIntoViewIfNeeded();
  await hold(page, 1200);

  caption("Почати місію");
  await card.click();
  await settle(page, 1300);
  await page.getByRole("link", { name: "Začít misi" }).click();
  await settle(page, 1200);

  // FR-28: the Ukrainian translation next to the Czech original
  caption("Тато вмикає український переклад поруч із чеським оригіналом");
  // The toggle is stored in the child profile: a previous run may have left it on.
  const hide = page.getByRole("button", { name: "Skrýt ukrajinštinu" });
  if (await hide.isVisible().catch(() => false)) await hide.click();
  await page.getByRole("button", { name: "Zobrazit ukrajinsky" }).click();
  await hold(page, 3000);

  const box = page.locator("[data-part]").first().getByRole("textbox");
  // FR-27: an unreadable answer does not cost an attempt
  caption("Незрозумілий ввід не забирає спробу — дитина бачить підказку формату");
  await typeInto(box, "pět čtvrtin");
  await box.press("Enter");
  await page.getByText("Tohle neumím přečíst").first().waitFor();
  await hold(page, 3200);

  caption("Помилка — «Майже!», але правильну відповідь система не видає");
  await box.fill("");
  await typeInto(box, "3/4");
  await box.press("Enter");
  await page.getByText("Skoro! Zkus to znovu.").waitFor();
  await hold(page, 2800);

  caption("Підказка, друга спроба — правильно. 1,25 і 5/4 система вважає однією відповіддю");
  await page.getByRole("button", { name: /Nápověda/ }).first().click();
  await hold(page, 2200);
  await box.fill("");
  await typeInto(box, "1,25");
  await box.press("Enter");
  await page.getByText("Výborně!").first().waitFor();
  await hold(page, 2400);

  // FR-35..37: summary, XP, maybe a rank-up
  caption("Місію виконано: досвід і, можливо, новий ранг");
  await page.locator("[data-next]").first().click();
  await settle(page, 1500);
  const rankUp = page.getByRole("button", { name: "Super!" });
  if (await rankUp.isVisible().catch(() => false)) {
    await hold(page, 1800);
    await rankUp.click();
  }
  await hold(page, 2000);

  // FR-38..41: the admin sees the practice
  caption("Мама бачить статистику: скільки задач і з якої спроби розв'язано");
  await page.goto(BASE_URL + "/admin/stats");
  await settle(page, 3200);
}

async function howItWasBuilt(page) {
  const visit = async (url, text, ms, scrollPx = 0) => {
    caption(text);
    // GitHub never goes network-idle: wait for `load` only, so every scene costs the same time.
    await page.goto(url, { waitUntil: "load" }).catch(() => page.goto(url, { waitUntil: "load" }));
    await hold(page, 900);
    if (scrollPx) await scroll(page, scrollPx);
    await hold(page, ms);
  };
  await visit(`${GH}/doucko-docs`, "Як будувалося: три репозиторії — специфікації, бекенд на Kotlin, фронтенд на React", 2400, 650);
  await visit(`${GH}/doucko-docs/blob/main/factory/UPSTREAM.md`, "Основа — Project Factory з курсу, адаптована під мультирепо", 2600, 350);
  await visit(`${GH}/doucko-docs/tree/main/openspec/specs`, "OpenSpec у бета-режимі stores: специфікації живуть у docs, а код підключає їх як контракт", 3600);
  await visit(`${GH}/doucko-backend/tree/main/openspec/changes/archive`, "Кожен слайс — окрема OpenSpec-зміна: спершу червоні тести, потім код, рев'ю, архів", 3600);
  await visit(
    `${GH}/doucko-backend/blob/main/docs/qa/evidence/release-red-run.md`,
    "Рев'ю робить окремий агент: знайшов, що символ NUL давав помилку 500 — спершу червоний тест, потім фікс",
    4000,
    250,
  );
  await visit(
    `${GH}/doucko-docs/blob/main/docs/qa/evidence/pd-16-e2e-stack-gate-proof.md`,
    "Коли помилялась сама фабрика — лагодила харнес: 16 дефектів процесу, ось PD-16",
    3600,
    250,
  );
  await visit(`${GH}/doucko-frontend/blob/main/docs/qa/e2e-stack-latest.md`, "Перевірка: понад 1600 автотестів і 21 наскрізний сценарій на реальному стеку", 3200);

  await page.setContent(
    TITLE_CARD("Я ↔ агенти", "Я: продукт, стек, чекпоінти й критерії «готово».<br>Агенти: специфікації, код, тести й рев'ю."),
  );
  caption("Я вирішувала продукт, стек і критерії «готово». Агенти писали специфікації, код, тести й рев'ю");
  await hold(page, 4500);
}

// --------------------------------------------------------------------------- main ----

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(join(OUT_DIR, "snaps"), { recursive: true });

const browser = await chromium.launch({ headless: process.env.HEADLESS === "1", slowMo: 40, args: [`--window-size=${SIZE.width},${SIZE.height + 120}`] });
const context = await browser.newContext({ viewport: SIZE, locale: "cs-CZ", recordVideo: { dir: OUT_DIR, size: SIZE } });
await context.exposeFunction("__demoCaption", () => current);
await context.addInitScript(CAPTION_BAR);
const page = await context.newPage();
videoT0 = Date.now();
page.setDefaultTimeout(15_000);

let failed = null;
try {
  await product(page);
  await howItWasBuilt(page);
} catch (error) {
  failed = error;
  console.error(`record-full-demo: the take stopped — ${error.message.split("\n")[0]}`);
  await page.screenshot({ path: join(OUT_DIR, "failure.png") }).catch(() => {});
}
const end = (Date.now() - videoT0) / 1000;
const video = page.video();
await context.close();
await browser.close();

const raw = await video.path();
await rename(raw, join(OUT_DIR, "full-demo.webm"));
for (const f of await readdir(OUT_DIR)) if (f.endsWith(".webm") && f !== "full-demo.webm") await rm(join(OUT_DIR, f));
await writeFile(join(OUT_DIR, "full-demo.srt"), buildSrt(end), "utf8");

log(`video: ${join(OUT_DIR, "full-demo.webm")} (${end.toFixed(1)} s), captions: ${join(OUT_DIR, "full-demo.srt")}`);
if (end > 120) console.warn(`record-full-demo: ${end.toFixed(1)} s is over 2:00 — lower PACE (e.g. PACE=0.8).`);
if (failed) process.exit(1);
