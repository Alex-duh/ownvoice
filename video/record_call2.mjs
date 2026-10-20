// Hero shot v2: the REAL extension (loaded unpacked) inside a faithful Chrome
// window, captioning a real human voice with simulated severe dysarthria that
// Chrome's fake capture device plays as the microphone.
//
// Every click is a real mouse event at the centre of the real element's box,
// and the drawn cursor is moved to the same point, so the two cannot drift.
//
// usage: node record_call2.mjs <scratch> <stage_url> <ext_dir> <call_wav> <out_dir>
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { startScreencast, encode } from "./screencast.mjs";

const [S, STAGE, EXT, WAV, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext(path.join(S, "profile-" + Date.now()), {
  channel: "chromium",
  headless: true,
  viewport: { width: 1920, height: 1080 },
  args: [
    `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`,
    "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${WAV}%noloop`,
    "--autoplay-policy=no-user-gesture-required",
  ],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent("serviceworker");
const extId = new URL(sw.url()).host;
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto(`${STAGE}/call.html?ext=${extId}`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);

const events = [];
const now = () => Date.now() / 1000;
const wait = (ms) => page.waitForTimeout(ms);
let cur = { x: 1180, y: 640 };
await page.evaluate(([x, y]) => moveCursor(x, y, 0), [cur.x, cur.y]);

async function glide(x, y, ms = 900) {
  // Move the real mouse in steps alongside the drawn cursor, so hover states
  // on real elements fire as the cursor passes over them.
  await page.evaluate(([x, y, ms]) => moveCursor(x, y, ms), [x, y, ms]);
  await page.mouse.move(x, y, { steps: Math.max(2, Math.round(ms / 40)) });
  await wait(Math.max(0, ms - 100));
  cur = { x, y };
}
async function clickAt(x, y, label) {
  await page.evaluate(([x, y]) => ripple(x, y), [x, y]);
  events.push({ t: now(), kind: "click", label, x, y });
  await page.mouse.click(x, y);
}
const centre = (b) => ({ x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) });

const cast = await startScreencast(page, path.join(OUT, "frames"));
await wait(1500);

// 1. Click the pinned OwnVoice icon in the toolbar.
let p = centre(await page.locator("#ovIcon").boundingBox());
await glide(p.x, p.y, 1100); await wait(250);
await clickAt(p.x, p.y, "toolbar-icon");
const frame = page.frameLocator("#ext");
await frame.locator("#rec").waitFor();
events.push({ t: now(), kind: "panel-open" });
// Observe (never modify) the real panel: when its level meter first moves, and
// when each caption lands. The edit syncs audio and overlays to these times.
const extFrame = page.frames().find((f) => f.url().startsWith("chrome-extension://"));
await extFrame.evaluate(() => {
  window.__ov = { level: [], caps: [] };
  const lv = document.getElementById("level");
  new MutationObserver(() => {
    const w = parseFloat(lv.style.width) || 0;
    if (w > 2) window.__ov.level.push(Date.now() / 1000);
  }).observe(lv, { attributes: true, attributeFilter: ["style"] });
  new MutationObserver(() => {
    document.querySelectorAll("#out li.seg").forEach((li) => {
      if (!li.classList.contains("is-pending") && !li.dataset.ovSeen) {
        li.dataset.ovSeen = "1";
        window.__ov.caps.push({ t: Date.now() / 1000, text: li.querySelector(".seg__text").textContent });
      }
    });
  }).observe(document.getElementById("out"), { subtree: true, childList: true, attributes: true, characterData: true });
});
await wait(1800);

// 2. Microphone source (already the default; clicked so the viewer sees it chosen).
p = centre(await frame.locator("#srcMic").boundingBox());
await glide(p.x, p.y, 1000); await wait(200);
await clickAt(p.x, p.y, "source-mic");
await wait(900);

// 3. Start captions. The fake device starts playing the call when capture opens.
p = centre(await frame.locator("#rec").boundingBox());
await glide(p.x, p.y, 900); await wait(250);
await clickAt(p.x, p.y, "start");
events.push({ t: now(), kind: "audio-start" });
await page.evaluate(() => startCall());
await wait(600);
await glide(1240, 720, 1400); // park the cursor over the call, away from the captions

const data = JSON.parse(fs.readFileSync(path.join(path.dirname(WAV), "demo_call.json"), "utf8"));
await wait((data.dur + 5.5) * 1000);

// 4. Switch the panel to Chinese.
p = centre(await frame.locator('button.lang[data-lang="zh"]').boundingBox());
await glide(p.x, p.y, 1100); await wait(250);
await clickAt(p.x, p.y, "lang-zh");
await wait(3200);
const tEnd = now();

const captions = await frame.locator("#out li .seg__text").allTextContents();
const metas = await frame.locator("#out li .seg__meta").allTextContents();
const observed = await extFrame.evaluate(() => window.__ov);
await cast.stop();
await ctx.close();

const t0 = encode(cast.frames, path.join(OUT, "call.mp4"), tEnd);
const rel = events.map((e) => ({ ...e, t: +(e.t - t0).toFixed(3) }));
// The call audio opens with data.marks[0][0] seconds of silence, so the meter's
// first movement after Start marks that point in the file.
const tStart = events.find((e) => e.kind === "audio-start").t;
const firstLevel = observed.level.find((x) => x > tStart);
const audioZero = firstLevel ? +(firstLevel - data.marks[0][0] - t0).toFixed(3) : null;
const capArrivals = observed.caps.map((c) => ({ t: +(c.t - t0).toFixed(3), text: c.text }));
fs.writeFileSync(path.join(OUT, "call.json"), JSON.stringify({ extId, duration: +(tEnd - t0).toFixed(3), events: rel, captions, metas, marks: data.marks, audioZero, capArrivals }, null, 1));
console.error("audioZero (footage s):", audioZero, " start event:", +(tStart - t0).toFixed(3), " captions at:", capArrivals.map((c) => c.t));
console.log(JSON.stringify({ captions, metas, events: rel, frames: cast.frames.length }, null, 1));
