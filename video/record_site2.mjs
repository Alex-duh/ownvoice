// Website walkthrough on the LIVE product site (ownvoice.vercel.app), captured
// sharply with the DevTools screencast. Every click is a real click at the
// centre of the real element; the drawn cursor is moved to the same point.
//
// usage: node record_site2.mjs <out_dir> [url]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { startScreencast, encode } from "./screencast.mjs";

const [OUT, URL = "https://ownvoice.vercel.app/"] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
// 1440x810 CSS px at 4/3 scale = 1920x1080 device px: the site's own desktop
// layout, rendered sharp at 1080p.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3, acceptDownloads: true });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
// The page's audio is left unmuted (so its player looks normal); headless
// capture records no sound, and the soundtrack adds the clip in sync.
await page.addStyleTag({ content: `
  #ovcursor{position:fixed;left:0;top:0;width:24px;height:24px;z-index:99999;pointer-events:none;
    transform:translate(var(--x,700px),var(--y,520px));transition:transform var(--d,0s) cubic-bezier(.35,.1,.25,1);
    filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.45))}
  #ovripple{position:fixed;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;
    background:rgba(62,107,224,.35);z-index:99998;pointer-events:none;opacity:0}
  #ovripple.go{animation:ovr .45s ease-out}
  @keyframes ovr{from{opacity:1;transform:scale(.2)}to{opacity:0;transform:scale(1.25)}}` });
await page.evaluate(() => {
  document.body.insertAdjacentHTML("beforeend",
    `<div id="ovripple"></div><svg id="ovcursor" viewBox="0 0 28 28"><path d="M6 3 L6 23 L11 18.4 L14.4 25.6 L17.6 24.2 L14.3 17.2 L21 17.2 Z" fill="#000" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`);
  window.moveCursor = (x, y, ms) => { const c = document.getElementById("ovcursor");
    c.style.setProperty("--d", (ms || 0) + "ms"); c.style.setProperty("--x", (x - 5) + "px"); c.style.setProperty("--y", (y - 2.5) + "px"); };
  window.ripple = (x, y) => { const r = document.getElementById("ovripple"); r.style.left = x + "px"; r.style.top = y + "px";
    r.classList.remove("go"); void r.offsetWidth; r.classList.add("go"); };
});

const events = [];
const now = () => Date.now() / 1000;
const wait = (ms) => page.waitForTimeout(ms);
async function glide(x, y, ms = 900) {
  await page.evaluate(([x, y, ms]) => moveCursor(x, y, ms), [x, y, ms]);
  await page.mouse.move(x, y, { steps: Math.max(2, Math.round(ms / 40)) });
  await wait(Math.max(0, ms - 100));
}
async function clickEl(locator, label, extra = {}) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  const x = Math.round(b.x + b.width / 2), y = Math.round(b.y + b.height / 2);
  await glide(x, y, extra.ms || 900); await wait(220);
  await page.evaluate(([x, y]) => ripple(x, y), [x, y]);
  events.push({ t: now(), kind: "click", label, x, y });
  await locator.click();
}
async function smoothScrollTo(selector, offset, ms = 1600) {
  await page.evaluate(async ([sel, off, T]) => {
    const el = document.querySelector(sel);
    const y0 = scrollY, y1 = el.getBoundingClientRect().top + scrollY - off, t0 = performance.now();
    await new Promise((r) => (function f(n) { const k = Math.min(1, (n - t0) / T);
      const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      scrollTo(0, y0 + (y1 - y0) * e); k < 1 ? requestAnimationFrame(f) : r(); })(t0));
  }, [selector, offset, ms]);
}

await page.evaluate(() => moveCursor(760, 560, 0));
await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
const cast = await startScreencast(page, path.join(OUT, "frames"), { quality: 92, nth: 1 });
await wait(2200);

// Hero -> "Hear the difference"
events.push({ t: now(), kind: "mark", label: "hero" });
await clickEl(page.locator('.hero a[href="#hear"]').first(), "hear-cta");
await smoothScrollTo("#hear", 70, 1400);
await wait(700);

// Pick "Severe" and play it.
await clickEl(page.locator('.chip[data-src="samples/sample-zh-severe.wav"]'), "chip-severe");
await wait(300);
const pb = await page.locator("#player").boundingBox();
await glide(Math.round(pb.x + 22), Math.round(pb.y + pb.height / 2), 700); await wait(200);
await page.evaluate(([x, y]) => ripple(x, y), [Math.round(pb.x + 22), Math.round(pb.y + pb.height / 2)]);
await page.evaluate(() => document.getElementById("player").play());
events.push({ t: now(), kind: "audio", label: "sample-zh-severe" });
// Let the clip play while the cursor drifts to the two transcripts.
const bad = await page.locator(".result--bad").boundingBox();
await glide(Math.round(bad.x + bad.width * 0.75), Math.round(bad.y + bad.height * 0.55), 1600);
events.push({ t: now(), kind: "mark", label: "results" });
await wait(2600);
const good = await page.locator(".result--good").boundingBox();
await glide(Math.round(good.x + good.width * 0.75), Math.round(good.y + good.height * 0.55), 1000);
await wait(2400);

// Switch the whole site to Chinese, then back.
await clickEl(page.locator("#langBtn"), "lang-zh", { ms: 1100 });
events.push({ t: now(), kind: "mark", label: "zh" });
await wait(2400);
await clickEl(page.locator("#langBtn"), "lang-en", { ms: 500 });
await wait(600);

// Extension section -> Download.
await smoothScrollTo('a[href="/downloads/ownvoice-extension.zip"]', 810 * 0.6, 1800);
await wait(500);
const dl = page.waitForEvent("download").catch(() => null);
await clickEl(page.locator('a[href="/downloads/ownvoice-extension.zip"]'), "download");
events.push({ t: now(), kind: "mark", label: "download" });
await dl;
await wait(2200);
const tEnd = now();
await cast.stop();
await browser.close();

const t0 = encode(cast.frames, path.join(OUT, "site.mp4"), tEnd);
const rel = events.map((e) => ({ ...e, t: +(e.t - t0).toFixed(3) }));
fs.writeFileSync(path.join(OUT, "site.json"), JSON.stringify({ duration: +(tEnd - t0).toFixed(3), events: rel }, null, 1));
console.log(JSON.stringify({ duration: +(tEnd - t0).toFixed(2), events: rel.map((e) => [e.label || e.kind, e.t]) }));
