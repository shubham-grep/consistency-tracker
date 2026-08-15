import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders Steady without starter metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Steady — Consistency Tracker<\/title>/i);
  assert.match(html, /Opening your rhythm/i);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview|react-loading-skeleton/i);
});

test("keeps all progress in the browser and supports portable backups", async () => {
  const [page, trackerData, styles, layout, nextConfig, packageJson, workflow, vercel] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/tracker-data.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("next.config.ts", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL(".github/workflows/deploy-pages.yml", root), "utf8"),
    readFile(new URL("vercel.json", root), "utf8"),
  ]);

  assert.match(page, /window\.localStorage\.setItem/);
  assert.match(page, /Export JSON/);
  assert.match(page, /Import/);
  assert.match(page, /Contribution activity over the last 12 months/);
  assert.match(page, /Goal calendars/);
  assert.match(page, /logsByGoalAndDate/);
  assert.match(page, /contribution activity over the last 12 months/);
  assert.match(page, /P1 · Highest/);
  assert.match(page, /P1=4, P2=3, P3=2, and P4=1/);
  assert.match(page, /Build the habit/);
  assert.match(page, /steady\.config/);
  assert.match(styles, /Developer workspace theme/);
  assert.match(styles, /--parchment:\s*#070a12/);
  assert.match(styles, /SFMono-Regular/);
  assert.match(layout, /themeColor:\s*"#070a12"/);
  assert.match(layout, /colorScheme:\s*"dark"/);
  assert.match(trackerData, /steady-consistency-tracker-v1/);
  assert.match(trackerData, /priorityFromWorkload/);
  assert.doesNotMatch(page, /Workload share|% workload|workload is currently allocated/);
  assert.doesNotMatch(page, /\bfetch\s*\(/);
  assert.match(nextConfig, /output:\s*["']export["']/);
  assert.match(packageJson, /"build:static":\s*"next build"/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(vercel, /"outputDirectory":\s*"out"/);
  await assert.rejects(access(new URL("app/_sites-preview", root)));
});
