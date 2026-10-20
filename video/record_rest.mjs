// Records the motion-graphics cards (one video per scene) and the live product
// site, logging when each scene actually starts so the editor can trim the
// page-load frames off the front.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const S = process.argv[2];
const only = process.argv[3];
const outRoot = path.join(S, "out");
const timing = {};
const browser = await chromium.launch({ channel: "chromium", headless: true });

async function rec(name, fn) {
  const dir = path.join(outRoot, name);
  fs.rmSync(dir, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: name === "site" ? { width: 1280, height: 720 } : { width: 1920, height: 1080 },
    recordVideo: { dir, size: name === "site" ? { width: 1280, height: 720 } : { width: 1920, height: 1080 } },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const res = await fn(page);
  await page.close();
  timing[name] = { video: await page.video().path(), start: (res.start - t0) / 1000, dur: res.dur };
  await ctx.close();
  console.log(name, JSON.stringify(timing[name]));
}

const CARDS = ["hook", "problem", "logo", "install", "results", "privacy", "end"];
for (const name of CARDS) {
  if (only && only !== name) continue;
  await rec(name, async (page) => {
    await page.goto("http://127.0.0.1:8800/cards.html");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(700);
    const start = Date.now();
    const dur = await page.evaluate((n) => play(n), name);
    await page.waitForTimeout(dur * 1000 + 300);
    return { start, dur };
  });
}

if (!only || only === "site") {
  await rec("site", async (page) => {
    await page.goto("https://ownvoice.vercel.app/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: `
      html{scroll-behavior:auto!important}
      #fakecursor{position:fixed;width:30px;height:30px;z-index:99999;pointer-events:none;
        transition:left 1s cubic-bezier(.3,.7,.2,1),top 1s cubic-bezier(.3,.7,.2,1);
        background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M3 2l7 19 2.5-7.5L20 11z' fill='white' stroke='black' stroke-width='1.5'/></svg>") no-repeat;background-size:contain}
      #fakecursor.click::after{content:"";position:absolute;left:-16px;top:-16px;width:50px;height:50px;border-radius:50%;
        background:rgba(62,107,224,.35);animation:ck .6s ease-out}
      @keyframes ck{from{transform:scale(.3)}to{transform:scale(1.5);opacity:0}}
      .ov-ring{outline:4px solid #ee6c34!important;outline-offset:6px;transition:outline-offset .3s}` });
    await page.evaluate(() => {
      const c = document.createElement("div"); c.id = "fakecursor";
      c.style.left = "860px"; c.style.top = "520px"; document.body.appendChild(c);
    });
    await page.waitForTimeout(400);
    const start = Date.now();
    await page.waitForTimeout(2600);
    // Smooth scroll to the extension section, eased over ~1.8 s.
    await page.evaluate(async () => {
      const el = document.querySelector('a[href="/downloads/ownvoice-extension.zip"]');
      // Land with the download button in the lower-middle of the screen.
      const y0 = scrollY, y1 = el.getBoundingClientRect().top + scrollY - innerHeight * 0.62, T = 1800, t0 = performance.now();
      await new Promise((r) => { (function f(now) { const k = Math.min(1, (now - t0) / T);
        const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        scrollTo(0, y0 + (y1 - y0) * e); k < 1 ? requestAnimationFrame(f) : r(); })(t0); });
    });
    await page.waitForTimeout(900);
    const btn = page.locator('a[href="/downloads/ownvoice-extension.zip"]');
    const box = await btn.boundingBox();
    await page.evaluate(([x, y]) => { const c = document.getElementById("fakecursor"); c.style.left = x + "px"; c.style.top = y + "px"; },
      [box.x + box.width * 0.6, box.y + box.height * 0.55]);
    await page.waitForTimeout(1200);
    await btn.evaluate((el) => el.classList.add("ov-ring"));
    await page.evaluate(() => { const c = document.getElementById("fakecursor"); c.classList.remove("click"); void c.offsetWidth; c.classList.add("click"); });
    const dl = page.waitForEvent("download").catch(() => null);
    await btn.click();
    await dl;
    await page.waitForTimeout(2000);
    return { start, dur: (Date.now() - start) / 1000 };
  });
}

fs.writeFileSync(path.join(outRoot, only ? `timing_${only}.json` : "timing_rest.json"), JSON.stringify(timing, null, 1));
await browser.close();
