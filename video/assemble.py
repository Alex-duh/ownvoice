"""Cut the recorded scenes into the 2-minute demo and build its soundtrack.

Video: each segment is trimmed out of its Playwright recording, given short
fades, encoded to H.264 1080p30, then concatenated.
Audio: built sample-accurately in numpy at 48 kHz on the SAME timeline:
  - a synthesized ambient pad (no licensing questions), ducked under speech,
  - soft synthesized clicks where the on-screen cursor clicks,
  - the real 買/賣 clips in the hook,
  - the real call audio, aligned to the moment Start was pressed.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import librosa

S = Path(sys.argv[1])
OUT = Path(sys.argv[2])
FF = "/opt/anaconda3/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1"
SR = 48000
FADE = 0.25

t = json.load(open(S / "out/timing_rest.json"))
t.update(json.load(open(S / "out/timing_results.json")))
t.update(json.load(open(S / "out/timing_site.json")))
call = json.load(open(S / "out/call/timing.json"))
co = call["offsets"]

# (name, video, in, out, events) — events are (seconds into the SEGMENT, kind)
segs = []
def card(name, dur, events=()):
    segs.append((name, t[name]["video"], t[name]["start"], t[name]["start"] + dur, list(events)))

card("hook", 11.0, [(1.4, "hook:mai3"), (3.2, "hook:mai4"), (6.5, "hook:mai3_sev"), (7.8, "hook:mai4_sev")])
card("problem", 10.5)
card("logo", 4.5, [(0.25, "chime")])
card("site", 8.6, [(6.55, "click")])
card("install", 5.5)
# Call: panel opening, then real-time captioning, then the 中文 switch.
segs.append(("call_open", call["video"], 1.6, 5.4, [(co["panel"] - 1.6, "click")]))
c2_in = co["start"] - 2.0
segs.append(("call_live", call["video"], c2_in, co["start"] + 42.0,
             [(co["start"] - c2_in - 1.1, "click"), (co["start"] - c2_in, "click"),
              (co["start"] - c2_in + 0.15, "callaudio")]))
segs.append(("call_zh", call["video"], co["zh"] - 1.4, co["zh"] + 3.2, [(1.4, "click")]))
card("results", 11.5)
card("privacy", 7.0)
card("end", 6.5)

work = OUT.parent / "segments"
work.mkdir(parents=True, exist_ok=True)
listfile = work / "list.txt"
lines, timeline, cursor = [], [], 0.0
for i, (name, video, a, b, ev) in enumerate(segs):
    dur = b - a
    out = work / f"{i:02d}_{name}.mp4"
    vf = (f"fps=30,scale=1920:1080:flags=lanczos,format=yuv420p,"
          f"fade=t=in:st=0:d={FADE},fade=t=out:st={dur - FADE:.3f}:d={FADE}")
    subprocess.run([FF, "-loglevel", "error", "-y", "-ss", f"{a:.3f}", "-i", video, "-t", f"{dur:.3f}",
                    "-vf", vf, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", str(out)], check=True)
    lines.append(f"file '{out}'")
    timeline.append((name, cursor, dur, ev))
    cursor += dur
listfile.write_text("\n".join(lines) + "\n")
total = cursor
print(f"total {total:.1f}s")

# ------------------------------------------------------------------ audio
n = int(total * SR) + SR
mix = np.zeros(n, np.float32)
speech = np.zeros(n, np.float32)  # where speech plays, for ducking

def load(p, gain=1.0):
    y, sr = sf.read(p, dtype="float32", always_2d=False)
    if y.ndim > 1:
        y = y.mean(1)
    if sr != SR:
        y = librosa.resample(y, orig_sr=sr, target_sr=SR)
    return y / (np.abs(y).max() + 1e-9) * gain

def place(y, at, track=mix, mark=True):
    k = int(at * SR)
    y = y[: max(0, n - k)]
    track[k:k + len(y)] += y
    if mark:
        speech[k:k + len(y)] = 1

def tone_click():
    d = int(0.06 * SR); tt = np.arange(d) / SR
    return (np.sin(2 * np.pi * 1800 * tt) * np.exp(-tt * 90) * 0.18).astype(np.float32)

def chime():
    d = int(1.6 * SR); tt = np.arange(d) / SR; y = np.zeros(d, np.float32)
    for f, g in [(784, .12), (1175, .08), (1568, .05)]:
        y += (np.sin(2 * np.pi * f * tt) * np.exp(-tt * 2.8) * g).astype(np.float32)
    return y

for name, start, dur, ev in timeline:
    for dt, kind in ev:
        at = start + dt
        if kind == "click":
            place(tone_click(), at, mark=False)
        elif kind == "chime":
            place(chime(), at, mark=False)
        elif kind.startswith("hook:"):
            place(load(S / "hook" / f"{kind[5:]}.wav", 0.9), at)
        elif kind == "callaudio":
            y = load(S / "call" / "demo_call.wav", 0.85)
            # Never let call audio spill past the end of the live segment.
            y = y[: int((start + dur - at) * SR)]
            place(y, at)

# Ambient pad: slow Cmaj7 - Am7 - Fmaj7 - G6, soft sines with gentle motion.
chords = [[261.6, 329.6, 392.0, 493.9], [220.0, 261.6, 329.6, 392.0],
          [174.6, 220.0, 261.6, 329.6], [196.0, 246.9, 293.7, 329.6]]
tt = np.arange(n) / SR
pad = np.zeros(n, np.float32)
bar = 4.0
for k in range(int(total / bar) + 2):
    a0, a1 = k * bar, (k + 1) * bar + 1.0
    i0, i1 = int(a0 * SR), min(n, int(a1 * SR))
    if i0 >= n:
        break
    seg_t = tt[i0:i1] - a0
    env = np.minimum(1, seg_t / 1.2) * np.minimum(1, np.maximum(0, (a1 - a0 - seg_t)) / 1.2)
    for f in chords[k % 4]:
        for det in (0.0, 0.7):
            pad[i0:i1] += (np.sin(2 * np.pi * (f / 2 + det) * seg_t) * env * 0.022).astype(np.float32)
# Duck the pad under speech, with smooth attack and release.
duck = np.convolve(speech, np.ones(int(0.4 * SR)) / int(0.4 * SR), mode="same")
pad *= (1 - 0.85 * np.clip(duck * 2, 0, 1)).astype(np.float32)
# Fade the pad in at the top and out at the very end.
pad *= np.clip(tt / 2.0, 0, 1).astype(np.float32)
pad *= np.clip((total - tt) / 2.5, 0, 1).astype(np.float32)
mix += pad
mix = np.clip(mix / max(1.0, np.abs(mix).max() / 0.95), -1, 1)
sf.write(work / "audio.wav", np.stack([mix, mix], 1)[: int(total * SR)], SR, subtype="PCM_16")

subprocess.run([FF, "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(listfile),
                "-i", str(work / "audio.wav"), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-shortest", "-movflags", "+faststart", str(OUT)], check=True)
print("wrote", OUT)
for name, start, dur, _ in timeline:
    print(f"  {start:6.1f}s  {name} ({dur:.1f}s)")
