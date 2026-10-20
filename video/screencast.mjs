// Sharp screen capture for Playwright pages via the DevTools screencast.
//
// Playwright's recordVideo encodes low-bitrate VP8, which is what made the first
// cut blurry. The screencast hands over every repainted frame as a high-quality
// JPEG with a wall-clock timestamp, so the clip can be rebuilt at constant
// 30 fps afterwards with nothing re-compressed twice.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const FF = "/opt/anaconda3/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1";

export async function startScreencast(page, dir, { width = 1920, height = 1080, quality = 88, nth = 2 } = {}) {
  const QUALITY = quality, NTH = nth;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const file = path.join(dir, `f${String(frames.length).padStart(6, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, ts: metadata.timestamp });
    try { await cdp.send("Page.screencastFrameAck", { sessionId }); } catch {}
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: QUALITY, maxWidth: width, maxHeight: height, everyNthFrame: NTH });
  return {
    frames,
    async stop() { try { await cdp.send("Page.stopScreencast"); } catch {} },
  };
}

// Rebuild constant-frame-rate video. Returns the wall-clock time (seconds since
// epoch) of the first frame, which is t=0 of the output clip.
export function encode(frames, outFile, endTs) {
  const list = path.join(path.dirname(outFile), path.basename(outFile) + ".ffconcat");
  const lines = ["ffconcat version 1.0"];
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].ts : endTs;
    lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - f.ts).toFixed(4)}`);
  });
  lines.push(`file '${frames[frames.length - 1].file}'`);
  fs.writeFileSync(list, lines.join("\n") + "\n");
  execFileSync(FF, ["-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list,
    "-vf", "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "14", outFile]);
  return frames[0].ts;
}
