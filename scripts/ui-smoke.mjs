#!/usr/bin/env node
/**
 * Lightweight UI smoke: fetch page, assert key DOM markers, check platform-viz visibility CSS.
 */
const BASE = process.env.BASE_URL || "http://127.0.0.1:8787";

const checks = [];

function ok(name, pass, detail = "") {
  checks.push({ name, pass, detail });
}

async function main() {
  const res = await fetch(BASE + "/");
  ok("GET /", res.ok, String(res.status));
  const html = await res.text();

  ok("mesh-canvas in HTML", html.includes('id="mesh-canvas"'));
  ok("hero-photo in HTML", html.includes('id="hero-photo"'));
  ok("resume-photo removed", !html.includes('id="resume-photo"'));
  ok("platform-viz without reveal", html.includes('class="platform-viz"') && !html.includes('platform-viz reveal'));

  const cssRes = await fetch(BASE + "/assets/styles.css");
  const css = await cssRes.text();
  ok("resume-layout removed from CSS", !css.includes(".resume-layout"));

  const jsRes = await fetch(BASE + "/assets/app.js");
  const js = await jsRes.text();
  ok("loadPhoto hero only", js.includes("#hero-photo") && !js.includes("#resume-photo"));

  const photoMeta = await fetch(BASE + "/api/photo/meta");
  ok("/api/photo/meta", photoMeta.ok);

  let failed = 0;
  for (const c of checks) {
    const mark = c.pass ? "✓" : "✗";
    console.log(`${mark} ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
    if (!c.pass) failed++;
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
