"""Concatenate the severe clips into the call audio the fake microphone plays.

Writes demo_call.wav (48 kHz stereo, the safest input for Chrome's fake capture
device) and demo_call.json (sentence start/end marks and a 30 fps loudness
envelope, which stage.html uses for the speaking ring and the English gloss).
"""
import json
import sys

import librosa
import numpy as np
import soundfile as sf

d = sys.argv[1]  # directory holding severe1.wav, severe2.wav, ...
n = int(sys.argv[2]) if len(sys.argv) > 2 else 6
sr, lead, gap = 16000, 1.0, 1.6
parts, marks, t = [np.zeros(int(lead * sr), np.float32)], [], lead
for i in range(1, n + 1):
    y, _ = sf.read(f"{d}/severe{i}.wav", dtype="float32")
    y = y / np.abs(y).max() * 0.8
    marks.append([round(t, 2), round(t + len(y) / sr, 2)])
    t += len(y) / sr + gap
    parts += [y, np.zeros(int(gap * sr), np.float32)]
a = np.concatenate(parts)
a48 = librosa.resample(a, orig_sr=sr, target_sr=48000)
sf.write(f"{d}/demo_call.wav", np.stack([a48, a48], 1), 48000, subtype="PCM_16")
hop = sr // 30
env = [float(np.sqrt(np.mean(a[k:k + hop] ** 2))) for k in range(0, len(a), hop)]
json.dump({"marks": marks, "env": env, "dur": len(a) / sr}, open(f"{d}/demo_call.json", "w"))
print(f"{len(a) / sr:.1f}s", marks)
