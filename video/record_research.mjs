// The research demo page (site/, route #/research) against a REAL local model
// server, captured sharply with the DevTools screencast. Every click is a real
// click; simulate and transcribe are real server calls. The simulated audio the
// server returns is saved so the soundtrack plays exactly what was on screen.
//
// usage: node record_research.mjs <out_dir> <clear_clip.wav> <reference text> [url]
// The server must host the site and the API on one origin:
//   OWNVOICE_WEB=<built site> OWNVOICE_MODEL=runs.nosync/asr_v1 python backend/app.py
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { startScreencast, encode } from "./screencast.mjs";

const [OUT, WAV, REF, URL = "http://127.0.0.1:7860/#/research"] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 });
const page = await ctx.newPage();
const events = [];
const now = () => Date.now() / 1000;
page.on("response", async (r) => {
  if (r.url().endsWith("/simulate") && r.request().method() === "POST" && r.status() === 200) {
    fs.writeFileSync(path.join(OUT, "simulated.wav"), await r.body());
    events.push({ t: now(), kind: "mark", label: "sim-done" });
  }
  if (r.url().endsWith("/transcribe") && r.request().method() === "POST" && r.status() === 200) {
    fs.writeFileSync(path.join(OUT, "transcribe.json"), JSON.stringify(await r.json(), null, 1));
    events.push({ t: now(), kind: "mark", label: "tr-done" });
  }
});
await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);
await page.addStyleTag({ content: `
  #ovcursor{position:fixed;left:0;top:0;width:24px;height:24px;z-index:99999;pointer-events:none;
    transform:translate(var(--x,700px),var(--y,520px));transition:transform var(--d,0s) cubic-bezier(.35,.1,.25,1);
    filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.45))}
  #ovripple{position:fixed;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;
    background:rgba(62,107,224,.35);z-index:99998;pointer-events:none;opacity:0}
  #ovripple.go{animation:ovr .45s ease-out}
  @keyframes ovr{from{opacity:1;transform:scale(.2)}to{opacity:0;transform:scale(1.25)}}
  html{scroll-behavior:auto!important}` });
await page.evaluate(() => {
  document.body.insertAdjacentHTML("beforeend",
    `<div id="ovripple"></div><svg id="ovcursor" viewBox="0 0 28 28"><path d="M6 3 L6 23 L11 18.4 L14.4 25.6 L17.6 24.2 L14.3 17.2 L21 17.2 Z" fill="#000" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`);
  window.moveCursor = (x, y, ms) => { const c = document.getElementById("ovcursor");
    c.style.setProperty("--d", (ms || 0) + "ms"); c.style.setProperty("--x", (x - 5) + "px"); c.style.setProperty("--y", (y - 2.5) + "px"); };
  window.ripple = (x, y) => { const r = document.getElementById("ovripple"); r.style.left = x + "px"; r.style.top = y + "px";
    r.classList.remove("go"); void r.offsetWidth; r.classList.add("go"); };
});

const wait = (ms) => page.waitForTimeout(ms);
async function glide(x, y, ms = 900) {
  await page.evaluate(([x, y, ms]) => moveCursor(x, y, ms), [x, y, ms]);
  await page.mouse.move(x, y, { steps: Math.max(2, Math.round(ms / 40)) });
  await wait(Math.max(0, ms - 100));
}
async function pointAt(locator, label, extra = {}) {
  const b = await locator.boundingBox();
  const x = Math.round(b.x + (extra.fx ?? 0.5) * b.width), y = Math.round(b.y + b.height / 2);
  await glide(x, y, extra.ms || 900); await wait(200);
  await page.evaluate(([x, y]) => ripple(x, y), [x, y]);
  events.push({ t: now(), kind: "click", label, x, y });
  return { x, y };
}
async function smoothScrollTo(locator, offset, ms = 1600) {
  await locator.evaluate(async (el, [off, T]) => {
    const y0 = scrollY, y1 = el.getBoundingClientRect().top + scrollY - off, t0 = performance.now();
    await new Promise((r) => (function f(n) { const k = Math.min(1, (n - t0) / T);
      const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      scrollTo(0, y0 + (y1 - y0) * e); k < 1 ? requestAnimationFrame(f) : r(); })(t0));
  }, [offset, ms]);
}

const demo = page.locator("section#demo");
const chips = demo.locator(".ev__sev");
// Start framed on the severity player and the two transcripts.
await chips.first().evaluate((el) => scrollTo(0, el.getBoundingClientRect().top + scrollY - 330));
await page.fill("#ref", REF);
await page.evaluate(() => moveCursor(700, 640, 0));
const cast = await startScreencast(page, path.join(OUT, "frames"), { quality: 92, nth: 1 });
await wait(1800);
events.push({ t: now(), kind: "mark", label: "start" });

// 1. Severity player: Severe, play, read both transcripts.
await pointAt(chips.filter({ hasText: "Severe" }), "chip-severe");
await chips.filter({ hasText: "Severe" }).click();
await wait(300);
await demo.locator(".ev__audio").first().evaluate((a) => { a.currentTime = 0; a.play(); });
events.push({ t: now(), kind: "audio", label: "sample-zh-severe" });
const stock = demo.getByText("STOCK WHISPER", { exact: false }).first();
const sb = await stock.boundingBox();
await glide(Math.round(sb.x + 260), Math.round(sb.y + 40), 1500);
events.push({ t: now(), kind: "mark", label: "stock" });
await wait(2400);
const ours = demo.getByText("OUR ADAPTED MODEL", { exact: false }).first();
const ob = await ours.boundingBox();
await glide(Math.round(ob.x + 260), Math.round(ob.y + 40), 900);
events.push({ t: now(), kind: "mark", label: "ours" });
await wait(2600);

// 2. Your own recording: upload, simulate, listen.
const file = demo.locator('input[type="file"]');
const drop = file.locator("xpath=..");
await smoothScrollTo(demo.getByText("1 · Hear it").first(), 110, 1600);
await wait(400);
await pointAt(drop, "upload");
await file.setInputFiles(WAV);
events.push({ t: now(), kind: "mark", label: "uploaded" });
await wait(900);
await pointAt(page.locator("#sev"), "severity", { ms: 700 });
await page.selectOption("#sev", "severe");
await wait(600);
const simBtn = demo.getByRole("button", { name: /Simulate dysarthria/ });
await pointAt(simBtn, "simulate", { ms: 700 });
await simBtn.click();
await page.waitForResponse((r) => r.url().endsWith("/simulate") && r.request().method() === "POST", { timeout: 120000 });
await wait(700);
const simAudio = demo.locator("audio").last();
const ab = await simAudio.boundingBox();
await glide(Math.round(ab.x + 28), Math.round(ab.y + ab.height / 2), 700); await wait(150);
await page.evaluate(([x, y]) => ripple(x, y), [Math.round(ab.x + 28), Math.round(ab.y + ab.height / 2)]);
await simAudio.evaluate((a) => { a.currentTime = 0; a.play(); });
events.push({ t: now(), kind: "audio", label: "simulated" });
const simDur = await simAudio.evaluate((a) => a.duration || 4);
await wait(Math.round(simDur * 1000) + 600);

// 3. Transcribe the simulated audio with our model.
const trBtn = demo.getByRole("button", { name: /^Transcribe$/ });
await pointAt(trBtn, "transcribe", { ms: 900 });
await trBtn.click();
await page.waitForResponse((r) => r.url().endsWith("/transcribe") && r.request().method() === "POST", { timeout: 180000 });
await wait(600);
const res = demo.getByText("TRANSCRIBED THE SIMULATED AUDIO", { exact: false }).first();
await smoothScrollTo(res, 330, 1100);
await wait(300);
const rb = await res.boundingBox();
await glide(Math.round(rb.x + 230), Math.round(rb.y + 62), 900);
events.push({ t: now(), kind: "mark", label: "result" });
await wait(3200);
const tEnd = now();
await cast.stop();
await browser.close();

const t0 = encode(cast.frames, path.join(OUT, "research.mp4"), tEnd);
const rel = events.map((e) => ({ ...e, t: +(e.t - t0).toFixed(3) }));
fs.writeFileSync(path.join(OUT, "research.json"), JSON.stringify({ duration: +(tEnd - t0).toFixed(3), simDur, events: rel }, null, 1));
console.log(JSON.stringify({ duration: +(tEnd - t0).toFixed(2), events: rel.map((e) => [e.label || e.kind, e.t]) }));
