"""Make single-voice severe-dysarthria clips for the demo call and score both models.

Clean speech: macOS `say` (Grandpa, zh_TW). Damage: the repo's own /simulate at
severe. Scoring: /transcribe with baseline=true, so every clip gets stock
whisper-small and the fine-tuned model on identical audio. All clips are kept
and reported, not just the good ones.
"""
import json
import subprocess
import sys
from pathlib import Path

import requests

FF = "/opt/anaconda3/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1"
API = "http://127.0.0.1:7860"
VOICE = "Grandpa (Chinese (Taiwan))"
OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

SENTENCES = [
    "你好，醫生，謝謝你今天看我",
    "我的喉嚨很痛，已經三天了",
    "晚上睡覺的時候會咳嗽",
    "請問我要吃什麼藥",
    "我想要賣掉我的股票",
    "麻煩你幫我叫計程車",
]

rows = []
for i, text in enumerate(SENTENCES, 1):
    aiff, clean, severe = OUT / f"g{i}.aiff", OUT / f"clean{i}.wav", OUT / f"severe{i}.wav"
    subprocess.run(["say", "-v", VOICE, "-r", "160", "-o", str(aiff), text], check=True)
    subprocess.run([FF, "-loglevel", "error", "-y", "-i", str(aiff), "-ac", "1", "-ar", "16000", str(clean)], check=True)
    r = requests.post(f"{API}/simulate", files={"file": clean.open("rb")}, data={"severity": "severe"})
    r.raise_for_status()
    severe.write_bytes(r.content)
    j = requests.post(
        f"{API}/transcribe",
        files={"file": severe.open("rb")},
        data={"reference": text, "baseline": "true"},
        timeout=600,
    ).json()
    row = {
        "i": i, "ref": text,
        "ours": j["transcript"], "ours_cer": j["scores"]["cer"],
        "stock": j["baseline_transcript"], "stock_cer": j["baseline_scores"]["cer"],
        "duration_s": j["duration_s"],
    }
    rows.append(row)
    print(json.dumps(row, ensure_ascii=False), flush=True)

(OUT / "results.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1))
n = len(rows)
print("mean CER ours", round(sum(r["ours_cer"] for r in rows) / n, 3),
      "stock", round(sum(r["stock_cer"] for r in rows) / n, 3))
