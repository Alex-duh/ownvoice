"""
Stock Whisper vs OwnVoice on REAL Mandarin dysarthric speech (MDSC / AISHELL-6B).

First test of the model on patients rather than on our own simulator. None of
these speakers, nor any MDSC audio, was used in training, so every speaker is
held out by construction.

Pre-registered (2026-10-20, written before any result was seen):
  headline   CER, stock vs tuned, on non-wake-word utterances from all 21
             dysarthric speakers; paired Wilcoxon signed-rank on per-utterance CER.
  breakdown  by the corpus's expert intelligibility score (Intelligibility.xlsx):
             mild >= 80, moderate 60-80, severe < 60.
  secondary  STER (tone errors on segmentally-correct syllables); a healthy-control
             sample as a sanity check. Everything else is exploratory.

Scoring goes through the running backend's /transcribe, so normalisation
(Traditional Chinese, punctuation stripped) is byte-identical to the published
numbers. MDSC labels are Simplified; normalize() converts both sides.

usage:
  python src/eval_mdsc.py --root ".../extracted" --per-speaker 20 --out runs/mdsc_eval.jsonl
"""
from __future__ import annotations

import argparse
import json
import random
import re
import time
from pathlib import Path

import requests

API = "http://127.0.0.1:7860"
# Per the corpus README, recordings 0001-0050 of every speaker are the ten
# wake-up words x 5. They are product names, not speech, so they are excluded.
WAKE_LAST_INDEX = 50


def load_labels(root: Path) -> dict[str, str]:
    """Every label.txt under root -> {utterance_id: text}."""
    labels = {}
    for p in root.rglob("label.txt"):
        for line in p.read_text(encoding="utf-8").splitlines():
            parts = line.strip().split(maxsplit=1)
            if len(parts) == 2:
                labels[parts[0]] = parts[1]
    return labels


def clean(text: str) -> str:
    return re.sub(r"<p>", "", text).strip()


def usable(uid: str, text: str) -> bool:
    # Sentences and commands only: no wake words, no placeholder labels such as
    # "T", and at least four Chinese characters so CER is not dominated by one slip.
    if int(uid.rsplit("_", 1)[1]) <= WAKE_LAST_INDEX:
        return False
    return len(re.findall(r"[一-鿿]", clean(text))) >= 4


def intelligibility(xlsx: Path) -> dict[str, float]:
    import openpyxl

    ws = openpyxl.load_workbook(xlsx, read_only=True).worksheets[0]
    out = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[0] and row[1] is not None:
            out[str(row[0]).strip()] = float(row[1])
    return out


def band(score: float | None) -> str:
    if score is None:
        return "control"
    return "mild" if score >= 80 else "moderate" if score >= 60 else "severe"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, help="folder holding Uncontrol/ and Control/")
    ap.add_argument("--xlsx", default=None)
    ap.add_argument("--per-speaker", type=int, default=20)
    ap.add_argument("--controls", type=int, default=5, help="healthy speakers to sample")
    ap.add_argument("--limit", type=int, default=0, help="stop after N clips (smoke test)")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", default="runs/mdsc_eval.jsonl")
    a = ap.parse_args()

    root = Path(a.root)
    intel = intelligibility(Path(a.xlsx) if a.xlsx else root.parent / "Intelligibility.xlsx")
    rng = random.Random(a.seed)

    jobs = []
    for group in ("Uncontrol", "Control"):
        labels = load_labels(root / group)
        wavs = {p.stem: p for p in (root / group).rglob("*.wav")}
        by_spk: dict[str, list[str]] = {}
        for uid, text in labels.items():
            if uid in wavs and usable(uid, text):
                by_spk.setdefault(uid.split("_")[0], []).append(uid)
        speakers = sorted(by_spk)
        if group == "Control":
            speakers = rng.sample(speakers, min(a.controls, len(speakers)))
        for spk in speakers:
            for uid in rng.sample(sorted(by_spk[spk]), min(a.per_speaker, len(by_spk[spk]))):
                jobs.append((group, spk, uid, wavs[uid], clean(labels[uid])))
    print(f"{len(jobs)} clips queued "
          f"({sum(j[0] == 'Uncontrol' for j in jobs)} dysarthric, {sum(j[0] == 'Control' for j in jobs)} control)")

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    done = {json.loads(l)["uid"] for l in out.open()} if out.exists() else set()
    t0 = time.time()
    with out.open("a", encoding="utf-8") as fh:
        for n, (group, spk, uid, wav, ref) in enumerate(jobs, 1):
            if a.limit and n > a.limit:
                break
            if uid in done:
                continue
            j = requests.post(f"{API}/transcribe", files={"file": wav.open("rb")},
                              data={"reference": ref, "baseline": "true"}, timeout=600).json()
            row = {
                "uid": uid, "speaker": spk, "group": group,
                "intelligibility": intel.get(spk), "band": band(intel.get(spk)),
                "ref": ref, "ours": j["transcript"], "stock": j["baseline_transcript"],
                "ours_cer": j["scores"]["cer"], "stock_cer": j["baseline_scores"]["cer"],
                "ours_ster": j["scores"]["ster"], "stock_ster": j["baseline_scores"]["ster"],
                "duration_s": j["duration_s"],
            }
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            fh.flush()
            if n % 20 == 0 or a.limit:
                rate = (time.time() - t0) / n
                print(f"{n}/{len(jobs)}  {rate:.1f}s/clip  eta {rate * (len(jobs) - n) / 60:.0f} min  | {ref} | ours {row['ours']} | stock {row['stock']}", flush=True)


if __name__ == "__main__":
    main()
