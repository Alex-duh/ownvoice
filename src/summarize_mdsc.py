"""Summarise runs/mdsc_eval.jsonl: the pre-registered analysis in eval_mdsc.py.

Prints a markdown table (for docs/results.md) and writes a small JSON summary
the demo video reads.

usage: python src/summarize_mdsc.py runs/mdsc_eval.jsonl [out.json]
"""
import json
import sys
from collections import defaultdict

import numpy as np
from scipy.stats import wilcoxon

rows = [json.loads(l) for l in open(sys.argv[1], encoding="utf-8")]
out_path = sys.argv[2] if len(sys.argv) > 2 else None


def summary(rs):
    s = np.array([r["stock_cer"] for r in rs]); o = np.array([r["ours_cer"] for r in rs])
    st = np.array([r["stock_ster"] for r in rs]); ot = np.array([r["ours_ster"] for r in rs])
    d = {"n": len(rs), "speakers": len({r["speaker"] for r in rs}),
         "stock_cer": float(s.mean()), "ours_cer": float(o.mean()),
         "stock_ster": float(st.mean()), "ours_ster": float(ot.mean()),
         "rel_cer_cut": float((s.mean() - o.mean()) / s.mean()) if s.mean() else 0.0,
         "ours_better": int((o < s).sum()), "ours_worse": int((o > s).sum()), "ties": int((o == s).sum())}
    per_spk = defaultdict(list)
    for r in rs:
        per_spk[r["speaker"]].append(r["stock_cer"] - r["ours_cer"])
    d["speakers_improved"] = int(sum(np.mean(v) > 0 for v in per_spk.values()))
    d["speakers_worse"] = int(sum(np.mean(v) < 0 for v in per_spk.values()))
    diff = s - o
    d["wilcoxon_p"] = float(wilcoxon(s, o).pvalue) if np.any(diff != 0) and len(rs) >= 10 else None
    return d


groups = defaultdict(list)
for r in rows:
    groups["control" if r["group"] == "Control" else "dysarthric (all)"].append(r)
    if r["group"] != "Control":
        groups[r["band"]].append(r)

res = {k: summary(v) for k, v in groups.items()}
print("| group | clips | speakers | stock CER | OwnVoice CER | relative cut | better / worse / tie | Wilcoxon p | stock STER | OwnVoice STER |")
print("|---|---|---|---|---|---|---|---|---|---|")
for k in ["dysarthric (all)", "mild", "moderate", "severe", "control"]:
    if k in res:
        d = res[k]
        p = f"{d['wilcoxon_p']:.3g}" if d["wilcoxon_p"] is not None else "n/a"
        print(f"| {k} | {d['n']} | {d['speakers']} | {d['stock_cer']:.3f} | {d['ours_cer']:.3f} | {d['rel_cer_cut']*100:+.0f}% | "
              f"{d['ours_better']} / {d['ours_worse']} / {d['ties']} | {p} | {d['stock_ster']:.3f} | {d['ours_ster']:.3f} |")
if out_path:
    json.dump({"ready": True, **res}, open(out_path, "w"), indent=1)
