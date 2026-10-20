// Records the hero shot: the REAL OwnVoice extension side panel (loaded unpacked
// into Chromium) captioning a simulated-dysarthria call. Chrome's fake capture
// device plays demo_call.wav as the microphone, so capture, segmentation, WAV
// encoding, the HTTP call and the fine-tuned model are all the shipped code path.
// Writes the video plus timing.json so the audio can be muxed back in sync.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const S = process.argv[2];
const ext = path.join(S, "ext-demo");
const wav = path.join(S, "call", "demo_call.wav");
const outDir = path.join(S, "out", "call");
const results = JSON.parse(fs.readFileSync(path.join(S, "call", "results.json"), "utf8"));
const stock = results.map((r) => r.stock);
fs.mkdirSync(outDir, { recursive: true });

const ctx = await chromium.launchPersistentContext(path.join(S, "profile-" + Date.now()), {
  channel: "chromium",
  headless: true,
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: outDir, size: { width: 1920, height: 1080 } },
  args: [
    `--disable-extensions-except=${ext}`,
    `--load-extension=${ext}`,
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${wav}%noloop`,
    "--autoplay-policy=no-user-gesture-required",
  ],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent("serviceworker");
const extId = new URL(sw.url()).host;

const page = ctx.pages()[0] || (await ctx.newPage());
const tVideo = Date.now();
await page.goto(`http://127.0.0.1:8800/stage.html?ext=${extId}&stock=${encodeURIComponent(JSON.stringify(stock))}`);
const wait = (ms) => page.waitForTimeout(ms);
const mark = {};

await wait(1500);
// Click the toolbar icon (the panel opens).
await page.evaluate(() => moveCursor(1781, 98)); await wait(1000);
await page.evaluate(() => { clickFx(); pulseIcon(); openPanel(); }); mark.panel = Date.now();
const frame = page.frameLocator("#ext");
await frame.locator("#rec").waitFor();
await wait(4500); // health check + model warm-up
// Choose the source and start.
await page.evaluate(() => moveCursor(1640, 222)); await wait(1000);
await page.evaluate(() => clickFx());
await page.evaluate(() => moveCursor(1640, 335)); await wait(1000);
await page.evaluate(() => { clickFx(); callout("Captions every phrase as it ends", 1050, 150); });
await frame.locator("#rec").click();
mark.start = Date.now();
await page.evaluate(() => startCall());
await page.evaluate(() => moveCursor(1500, 900));
await wait(5000);
await page.evaluate(() => { callout(""); zoom(1.2, "100%", "50%"); });
await wait(26000);
await page.evaluate(() => zoom(1, "100%", "50%"));
await wait(12000);
// Language switch, to show the 中文 interface.
await page.evaluate(() => moveCursor(1838, 140)); await wait(1100);
await page.evaluate(() => clickFx());
await frame.locator('button.lang[data-lang="zh"]').click();
mark.zh = Date.now();
await wait(3500);
const captions = await frame.locator("#out li .seg__text").allTextContents();
const metas = await frame.locator("#out li .seg__meta").allTextContents();
mark.end = Date.now();
await page.close();
const video = await page.video().path();
await ctx.close();
// Put the extension back in English for the next run.
fs.writeFileSync(path.join(outDir, "timing.json"), JSON.stringify({
  video, extId, offsets: Object.fromEntries(Object.entries(mark).map(([k, v]) => [k, (v - tVideo) / 1000])),
  captions, metas,
}, null, 1));
console.log(JSON.stringify({ video, captions, metas }, null, 1));
