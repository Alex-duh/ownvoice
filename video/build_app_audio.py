"""Build the soundtrack for the app scene: real MDSC clips placed at fixed times.

The app scene is animated in Remotion (the app is a design, not yet a build),
so there is no live capture. The captions it shows are what our model output
for these exact clips (scan_speaker.py), not made-up text.

Writes <out>.wav (48 kHz stereo, peak-normalised like the call audio) and
<out>.json with the start/end of each clip in seconds.

usage: build_app_audio.py <out_stem> <start_s>:<wav> [<start_s>:<wav> ...]
"""
import json
import sys

import librosa
import numpy as np
import soundfile as sf

out, specs = sys.argv[1], sys.argv[2:]
sr = 48000
clips = []
for spec in specs:
    t, path = spec.split(":", 1)
    y, _ = librosa.load(path, sr=sr, mono=True)
    clips.append((float(t), (y / np.abs(y).max() * 0.8).astype(np.float32)))
end = max(t + len(y) / sr for t, y in clips) + 0.5
a = np.zeros(int(end * sr), np.float32)
marks = []
for t, y in clips:
    i = int(t * sr)
    a[i:i + len(y)] += y
    marks.append([round(t, 2), round(t + len(y) / sr, 2)])
sf.write(out + ".wav", np.stack([a, a], 1), sr, subtype="PCM_16")
json.dump({"marks": marks, "dur": round(end, 2)}, open(out + ".json", "w"))
print(marks)
