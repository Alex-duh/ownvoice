"""
Loader for MDSC / AISHELL-6B (Mandarin Dysarthria Speech Corpus), from local disk.

This is the corpus the project actually needs: real Mandarin dysarthric speech,
so the tone claim can be tested on patients rather than on perturbations we
designed and therefore already know how to invert. EasyCall can show the
approach survives real pathology, but it is Italian and says nothing about tone.

Licence: CC BY-NC 4.0. Open, non-commercial, no signed legal agreement -- but
the download at https://opendata.aishelltech.com/aishell-6b requires a
Speechhome member ID and accepting terms, which a human has to do. Nothing here
downloads anything; point --root at the folder you unpacked.

Expected layout (the LRDWWS challenge distribution, per the official baseline
at https://github.com/greeeenmouth/LRDWWS):

    <root>/
      train/
        Control/     { wav/, transcript/ }    healthy speakers
        Uncontrol/   { wav/, transcript/ }    dysarthric speakers
      dev/
        enrollment/  { wav/, transcript/ }    speaker adaptation
        eval/        { wav/, transcript/ }    evaluation

Speaker ids look like DF0016 / DM0005 (dysarthric female/male) and the control
set uses its own prefixes.

IMPORTANT, read before trusting the output
------------------------------------------
This module was written WITHOUT the corpus in hand -- it is gated behind a
registration step that only the data owner can complete. The directory layout
above is documented by the official baseline, but the transcript FILE FORMAT is
not, and the LRDWWS README notes the distribution has been revised at least
once. So this does not assume a format: it discovers one.

Run `--inspect` FIRST. It reports what it actually found -- how transcripts are
stored, how many pair up, and a sample of parsed lines -- without writing
anything. Only run the build once that output looks right. If pairing fails the
build raises rather than silently emitting an empty or mislabelled manifest,
because a corpus that quietly half-loads is worse than one that refuses to.

Manifest schema matches data.py and data_real.py, so every downstream script
(train_asr, evaluate, metrics) works unchanged:

    simulated   = False
    clean_path  = None          no paired clean audio exists for a patient
    severity    = "control" | "dysarthric"
                  MDSC's public layout separates Control from Uncontrol but
                  does not publish a graded severity per speaker, so this is a
                  binary label, NOT the mild/moderate/severe scale that the
                  simulator produces. Do not plot them on one axis.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import soundfile as sf

TARGET_SR = 16_000
AUDIO_EXT = {".wav", ".flac", ".WAV", ".FLAC"}

# Folder -> (split, severity label). Control is healthy speech recorded under
# the same protocol, which is why it is kept rather than discarded: it is the
# matched comparison group.
SECTIONS = {
    ("train", "Control"): ("train", "control"),
    ("train", "Uncontrol"): ("train", "dysarthric"),
    ("dev", "enrollment"): ("enrollment", "dysarthric"),
    ("dev", "eval"): ("eval", "dysarthric"),
}


def _find_sections(root: Path) -> list[tuple[str, str, Path]]:
    """Locate the wav/transcript section folders that actually exist."""
    found = []
    for (top, sub), (split, severity) in SECTIONS.items():
        d = root / top / sub
        if d.is_dir():
            found.append((split, severity, d))
    return found


def _read_transcripts(tdir: Path, stems: set[str]) -> dict[str, str]:
    """Map utterance id -> text, tolerating both storage conventions.

    Two patterns exist in corpora shaped like this and the docs do not say
    which MDSC uses, so handle both:
      1. one small file per utterance, named after the wav stem
      2. one index file holding "<utt_id><sep><text>" per line

    A one-line index file is ambiguous with a one-line per-utterance file, so
    the known wav stems decide it: if a line's first token names a wav we have,
    the file is an index. Counting lines cannot disambiguate and getting this
    wrong silently mislabels the whole corpus.
    """
    out: dict[str, str] = {}
    if not tdir.is_dir():
        return out

    for p in sorted(x for x in tdir.rglob("*") if x.is_file()):
        try:
            raw = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
        if not lines:
            continue

        def split_entry(ln: str) -> tuple[str, str] | None:
            for sep in ("	", " "):
                if sep in ln:
                    uid, text = ln.split(sep, 1)
                    uid, text = Path(uid.strip()).stem, text.strip()
                    if uid and text:
                        return uid, text
            return None

        entries = [e for e in (split_entry(ln) for ln in lines) if e]
        looks_like_index = any(uid in stems for uid, _ in entries)

        if looks_like_index:
            for uid, text in entries:
                if uid in stems:
                    out.setdefault(uid, text)
        elif len(lines) == 1 and p.stem in stems:
            out.setdefault(p.stem, lines[0])

    return out


def _speaker_of(stem: str, wav: Path) -> str:
    """Speaker id. MDSC encodes it in the filename (DF0016_...) or the folder."""
    head = stem.split("_")[0].split("-")[0]
    if len(head) >= 4 and head[:1].isalpha():
        return head
    return wav.parent.name


def inspect(root: Path) -> int:
    sections = _find_sections(root)
    print(f"root: {root}")
    if not sections:
        print("\nNo expected section folders found. Looked for:")
        for top, sub in SECTIONS:
            print(f"  {root / top / sub}")
        print("\nWhat is actually there:")
        for p in sorted(root.glob("*"))[:20]:
            print("  ", p.name + ("/" if p.is_dir() else ""))
        return 1

    total_pairs = 0
    for split, severity, d in sections:
        wavs = [p for p in (d / "wav").rglob("*") if p.suffix in AUDIO_EXT]
        texts = _read_transcripts(d / "transcript", {w.stem for w in wavs})
        paired = [w for w in wavs if w.stem in texts]
        total_pairs += len(paired)
        spk = Counter(_speaker_of(w.stem, w) for w in wavs)
        print(f"\n[{split} / {severity}]  {d}")
        print(f"  audio files     : {len(wavs)}")
        print(f"  transcripts     : {len(texts)}")
        print(f"  paired by stem  : {len(paired)}")
        print(f"  speakers        : {len(spk)}  e.g. {list(spk)[:6]}")
        for w in paired[:3]:
            print(f"    {w.name}  ->  {texts[w.stem][:40]}")
        if wavs and not paired:
            print("  !! nothing paired. Transcript naming does not match wav stems.")
            print(f"     sample wav stems : {[w.stem for w in wavs[:3]]}")
            print(f"     sample txt keys  : {list(texts)[:3]}")

    print(f"\ntotal paired utterances: {total_pairs}")
    print("\nIf these counts look right, run without --inspect to build.")
    return 0 if total_pairs else 1


def build(root: Path, out_dir: Path, limit: int = 0,
          min_dur: float = 0.2, max_dur: float = 12.0) -> Path:
    sections = _find_sections(root)
    if not sections:
        raise SystemExit(
            f"No MDSC section folders under {root}. Run with --inspect to see "
            "what is there."
        )

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "dys").mkdir(exist_ok=True)
    fh = (out_dir / "manifest.jsonl").open("w", encoding="utf-8")

    kept = skipped = 0
    try:
        for split, severity, d in sections:
            wavs = sorted(p for p in (d / "wav").rglob("*") if p.suffix in AUDIO_EXT)
            texts = _read_transcripts(d / "transcript", {w.stem for w in wavs})
            if wavs and not texts:
                raise SystemExit(
                    f"{d}: found {len(wavs)} audio files but no readable "
                    "transcripts. Refusing to build an unlabelled manifest. "
                    "Run --inspect."
                )

            for w in wavs:
                if limit and kept >= limit:
                    break
                text = texts.get(w.stem)
                if not text:
                    skipped += 1
                    continue
                try:
                    y, sr = sf.read(w, dtype="float64")
                except Exception:
                    skipped += 1
                    continue
                if getattr(y, "ndim", 1) > 1:
                    y = y.mean(axis=1)
                if sr != TARGET_SR:
                    import librosa
                    y = librosa.resample(y, orig_sr=sr, target_sr=TARGET_SR)
                dur = len(y) / TARGET_SR
                if not (min_dur <= dur <= max_dur):
                    skipped += 1
                    continue
                peak = float(np.abs(y).max()) if y.size else 0.0
                if peak < 1e-5:
                    skipped += 1
                    continue
                y = (y / peak * 0.95).astype(np.float32)

                uid = f"mdsc_{split}_{w.stem}"
                rel = Path("dys") / f"{uid}.wav"
                sf.write(out_dir / rel, y, TARGET_SR, subtype="PCM_16")
                fh.write(json.dumps({
                    "id": uid,
                    "text": text,
                    "clean_path": None,
                    "dys_path": str(rel),
                    "severity": severity,
                    "split": split,
                    "speaker": _speaker_of(w.stem, w),
                    "duration": round(dur, 2),
                    "simulated": False,
                }, ensure_ascii=False) + "\n")
                kept += 1
    finally:
        fh.close()

    if kept == 0:
        raise SystemExit(
            "Wrote 0 utterances. Transcripts likely did not pair with audio; "
            "run --inspect."
        )
    print(f"wrote {kept} utterances ({skipped} skipped) -> {out_dir}")
    print("NOTE: severity here is control/dysarthric, NOT the simulator's "
          "mild/moderate/severe scale. Do not pool them.")
    return out_dir / "manifest.jsonl"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--root", required=True,
                    help="folder containing train/ and dev/")
    ap.add_argument("--out", default="data/real_mdsc")
    ap.add_argument("--limit", type=int, default=0, help="0 = all")
    ap.add_argument("--inspect", action="store_true",
                    help="report what was found and exit without writing")
    a = ap.parse_args()

    root = Path(a.root).expanduser().resolve()
    if not root.is_dir():
        print(f"not a directory: {root}", file=sys.stderr)
        return 1
    if a.inspect:
        return inspect(root)
    build(root, Path(a.out), limit=a.limit)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
