"""Real human voices for the demo: Common Voice zh-TW TEST split + our simulator.

The model only ever trained on the Common Voice *train* split, and Common Voice
splits are speaker-disjoint, so every speaker here is unseen. Clips are CC0.

For each chosen speaker: decode every clip, apply /simulate at the requested
severity, and score stock whisper-small vs the fine-tuned model on identical
audio. Everything is reported; selection happens afterwards, in the open.

usage: make_cv_clips.py <cv_dir with data/test-*.parquet> <out_dir> <severity> <client_id_prefix>...
"""
import io
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
import requests
import soundfile as sf

FF = "/opt/anaconda3/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1"
API = "http://127.0.0.1:7860"

cv, out, severity, prefixes = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], sys.argv[4:]
out.mkdir(parents=True, exist_ok=True)

rows = []
for p in sorted((cv / "data").glob("test-*.parquet")):
    t = pq.read_table(p, columns=["client_id", "sentence", "audio", "age", "gender"])
    for r in t.to_pylist():
        if any(r["client_id"].startswith(x) for x in prefixes):
            rows.append(r)

results = []
for r in rows:
    spk = r["client_id"][:10]
    stem = f"{spk}_{len([x for x in results if x['speaker'] == spk]) + 1}"
    raw = out / f"{stem}_src"
    raw.write_bytes(r["audio"]["bytes"])
    clean = out / f"{stem}_clean.wav"
    # Trim leading/trailing silence and normalise loudness; CV clips vary a lot.
    subprocess.run([FF, "-loglevel", "error", "-y", "-i", str(raw), "-ac", "1", "-ar", "16000",
                    "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,"
                           "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.25,areverse,"
                           "loudnorm=I=-20:TP=-2",
                    str(clean)], check=True)
    raw.unlink()
    dys = out / f"{stem}_{severity}.wav"
    res = requests.post(f"{API}/simulate", files={"file": clean.open("rb")}, data={"severity": severity})
    res.raise_for_status()
    dys.write_bytes(res.content)
    j = requests.post(f"{API}/transcribe", files={"file": dys.open("rb")},
                      data={"reference": r["sentence"], "baseline": "true"}, timeout=600).json()
    y, sr = sf.read(clean)
    # Crude noise check: energy of the quietest 10% of 20 ms frames, in dB.
    fr = int(0.02 * sr)
    e = np.array([np.sqrt(np.mean(y[k:k + fr] ** 2)) + 1e-9 for k in range(0, len(y) - fr, fr)])
    noise_db = float(20 * np.log10(np.percentile(e, 10)))
    row = dict(speaker=spk, stem=stem, age=r["age"], gender=r["gender"], ref=r["sentence"],
               ours=j["transcript"], ours_cer=j["scores"]["cer"],
               stock=j["baseline_transcript"], stock_cer=j["baseline_scores"]["cer"],
               dur=j["duration_s"], noise_db=round(noise_db, 1))
    results.append(row)
    print(json.dumps(row, ensure_ascii=False), flush=True)

(out / f"results_{severity}.json").write_text(json.dumps(results, ensure_ascii=False, indent=1))
