"""Score every numeral-free, non-wake-word recording of one MDSC speaker.

Used to find demo sentences OwnVoice really gets right. Sentences with numbers
are skipped because stock Whisper writes Arabic numerals ("25" for 二十五),
which counts as an error but reads as correct, and would flatter OwnVoice.

usage: scan_speaker.py <Uncontrol dir> <speaker> <out.jsonl>
"""
import json
import re
import sys
from pathlib import Path

import requests

root, spk, out = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
labels = {}
for p in root.rglob("label.txt"):
    for line in p.read_text(encoding="utf-8").splitlines():
        x = line.split(maxsplit=1)
        if len(x) == 2 and x[0].startswith(spk + "_"):
            labels[x[0]] = x[1].replace("<p>", "").strip()
wavs = {p.stem: p for p in root.rglob(f"{spk}_*.wav")}
done = {json.loads(l)["uid"] for l in out.open()} if out.exists() else set()
todo = [u for u in sorted(labels) if u in wavs and u not in done and int(u.rsplit("_", 1)[1]) > 50
        and not re.search(r"[零一二三四五六七八九十百幺两0-9]", labels[u]) and not labels[u].startswith("你好米雅")
        and len(labels[u]) >= 3]
print(len(todo), "to score", flush=True)
with out.open("a", encoding="utf-8") as fh:
    for i, u in enumerate(todo, 1):
        j = requests.post("http://127.0.0.1:7860/transcribe", files={"file": wavs[u].open("rb")},
                          data={"reference": labels[u], "baseline": "true"}, timeout=600).json()
        row = dict(uid=u, speaker=spk, ref=labels[u], ours=j["transcript"], stock=j["baseline_transcript"],
                   ours_cer=j["scores"]["cer"], stock_cer=j["baseline_scores"]["cer"], dur=j["duration_s"], path=str(wavs[u]))
        fh.write(json.dumps(row, ensure_ascii=False) + "\n"); fh.flush()
        if i % 25 == 0:
            print(i, "done", flush=True)
