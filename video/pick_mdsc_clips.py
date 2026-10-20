"""Score candidate MDSC sentences for the demo call, stock vs OwnVoice.

Real dysarthric speakers (MDSC / AISHELL-6B, CC BY-NC 4.0). The demo uses a
SELECTED speaker and sentences, and says so on screen; the unselected
aggregate is src/eval_mdsc.py.

usage: pick_mdsc_clips.py <Uncontrol dir> <out.jsonl> <speaker>...
"""
import json
import sys
from pathlib import Path

import requests

API = "http://127.0.0.1:7860"
WANTED = [
    "音量太小了", "请帮我把温度提高到二十七度", "麻烦帮我把温度设置成二十六", "帮我换一首歌曲",
    "拉开窗帘", "打开空调", "我需要把温度调到二十五", "帮我音量稍微增加一点", "开灯",
    "请给我把温度切换到十八", "全部打开", "播放下一首",
]

root, out, speakers = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3:]
LONGEST = 8
labels = {}
for p in root.rglob("label.txt"):
    for line in p.read_text(encoding="utf-8").splitlines():
        x = line.split(maxsplit=1)
        if len(x) == 2:
            labels[x[0]] = x[1].replace("<p>", "").strip()
wavs = {p.stem: p for p in root.rglob("*.wav")}

with out.open("a", encoding="utf-8") as fh:
    for spk in speakers:
        mine = {u: t for u, t in labels.items() if u.startswith(spk + "_") and u in wavs
                and int(u.rsplit("_", 1)[1]) > 50 and not t.startswith("你好米雅")
                and not any(ch in t for ch in "零一二三四五六七八九幺") or (u.startswith(spk + "_") and labels[u] in WANTED)}
        # The WANTED everyday requests first, then this speaker's longest other sentences.
        picks = [u for u, t in mine.items() if t in WANTED] + sorted(
            (u for u, t in mine.items() if t not in WANTED), key=lambda u: -len(mine[u]))[:LONGEST]
        seen = set()
        for uid in picks:
            text = labels[uid]
            if text in seen:
                continue
            seen.add(text)
            j = requests.post(f"{API}/transcribe", files={"file": wavs[uid].open("rb")},
                              data={"reference": text, "baseline": "true"}, timeout=600).json()
            row = dict(uid=uid, speaker=spk, ref=text, ours=j["transcript"], stock=j["baseline_transcript"],
                       ours_cer=j["scores"]["cer"], stock_cer=j["baseline_scores"]["cer"], dur=j["duration_s"],
                       path=str(wavs[uid]))
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            print(f"{uid} {row['dur']:4.1f}s | {text} | ours {row['ours']} {row['ours_cer']:.2f} | stock {row['stock']} {row['stock_cer']:.2f}", flush=True)
