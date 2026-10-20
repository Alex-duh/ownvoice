# OwnVoice — project guide for Claude

Last updated 2026-10-19. The code wins over this file. If they disagree, fix this file.

## What this is

OwnVoice captions Mandarin speech from people with **dysarthria** (speech made unclear by stroke,
Parkinson's or mouth-cancer surgery). It is a fine-tuned Whisper-small model plus a website and a
Chrome extension that put it in front of users. It is the team's entry for the **2026 Presidential
Hackathon, International Track** ("Digital Inclusion in the AI Era").

The pitch hook is Mandarin tone: 買 mǎi (buy) and 賣 mài (sell) differ only in pitch shape, and
illness flattens pitch first.

Team: Andrew Shih (presenter, owns the upstream repo), Luis Cruz Mondragon, Srihari Kumaresan,
Alexander Du.

## Where everything lives

| Thing | Location | Notes |
|---|---|---|
| Canonical repo | https://github.com/andrewshih0407/ownvoice (`upstream`) | Alex's fork is `origin` (Alex-duh/ownvoice) |
| **Product site (canonical URL)** | **https://ownvoice.vercel.app** | Static `product-site/`. It's Alex's Vercel project `ownvoice` (team alex-dudu-projects1). Since 2026-10-19 it's deployed from the CLI: `cd product-site && npx vercel deploy --prod`. `product-site/vercel.json` overrides the project's Vite preset to plain static. It is not git-connected, so pushes do not deploy |
| Andrew's copy of the product site | https://ownvoice-three.vercel.app | Same `product-site/` code, deployed by Andrew. It lacks the download button until he redeploys |
| Older research site | `site/` (Vite + React) | Lost the ownvoice.vercel.app URL on 2026-10-19. Not currently deployed anywhere by Alex; `vercel rollback` restores it |
| Older HF static site | https://anonymous6623-ownvoice.static.hf.space | Still linked from README.md |
| Streamlit demo (model runs here) | https://appapppy-m7fpkveuhxbkxapu2bbkdg.streamlit.app | Kept awake by `.github/workflows/keep-awake.yml` |
| Fine-tuned model | https://huggingface.co/anonymous6623/ownvoice-asr | Used by `streamlit_app.py` |
| Pitch deck (long version, 12 slides) | `~/Downloads/OwnVoice-Final-Deck.pptx` (not in repo) | Script is about 7.5 minutes |
| Chrome extension | `extension/` (merged from upstream branch `product-site-and-extension`) | MV3 side panel with mic or tab capture (`tabCapture`) and an EN/中文 UI. It defaults to `http://localhost:7860`. **The mic path was verified end to end on 2026-10-19** (see `video/`). Tab capture is still untested |
| Extension download | `product-site/downloads/ownvoice-extension.zip`, built by `scripts/pack-extension.sh` | Built from the *committed* `extension/` via `git archive`. Re-run and commit after every extension change |
| 5-minute presentation script | `docs/presentation-script.md` (same branch) | Matches the 6-slide deck OwnVoice-Presentation-Final.pptx |
| Demo video plan | `docs/demo-video-plan.md` | v2: the 2-minute product-demo video, the tooling (Remotion skills), and the overlay verdict |
| **Rendered demo video** | `~/Downloads/OwnVoice-demo.mp4` (not in git, 14 MB) | 1:57, 1080p. Built by `video/` (Playwright plus ffmpeg, fully scripted). `video/README.md` lists what's real and what's staged |
| Hackathon rules | `docs/handbook-2026.pdf` | Finals weights: Feasibility 30, Innovation 20, Social impact 20, Implementation and verification 30. The final review is "late October" 2026 |

## Architecture

- `src/dysarthria_sim.py` uses the WORLD vocoder (pyworld) to split speech into F0, spectral
  envelope and aperiodicity, then damages each one to match a symptom: monopitch, blurred formants,
  breathiness, jitter, slower rate. Severity presets are mild, moderate and severe. At severe, speech
  runs at 60% rate and keeps 20% of pitch range.
- `src/train_asr.py` fine-tunes `openai/whisper-small` on 1,000 utterances × 3 severities = 3,000
  pairs from 91 speakers (Common Voice zh-TW and AISHELL-3). The split is **speaker-disjoint**, with
  one fifth of speakers held out. All text is normalised to Traditional Chinese.
- `src/metrics.py` computes CER, TER and **STER** (tone error rate on syllables whose segment was
  right, aligned by edit distance). Tests are in `src/test_metrics.py`.
- `backend/app.py` is FastAPI with `/health`, `/simulate`, `/transcribe` (tuned vs stock, scored)
  and `/transcribe_chunk` (one live segment, `mode=tuned|fast`). Models load lazily. It runs on
  CUDA or CPU only (no MPS path). Set `OWNVOICE_MODEL` to the fine-tuned checkpoint; if you don't,
  the server compares stock Whisper against itself and prints a warning.
- **Live captions need a running backend.** Both Vercel sites are static. On ownvoice-three the
  live section stays hidden unless a model answers. Point it at a backend with
  `?api=https://<tunnel>.ngrok-free.app` (saved in localStorage; `?api=` clears it). Browser
  clients capture raw PCM, cut segments at pauses with an RMS gate, encode WAV, and post each
  segment to `/transcribe_chunk`.
- `extension/` captures the mic or the current tab's audio (the stream id is created in the
  side panel, and capture needs a real toolbar-icon click to grant `activeTab`). It cuts 0.6–2.5 s
  segments, drops the oldest segment when more than 2 are queued, and warms the model on open
  (cold start is about 45 s, warm about 1.3 s). It needs the same backend.

## Headline numbers (from docs/results.md; all on SIMULATED dysarthria)

| | stock Whisper CER | OwnVoice CER | relative cut |
|---|---|---|---|
| mild | 0.1605 | 0.1370 | 15% |
| moderate | 0.2074 | 0.1311 | 37% |
| severe | 0.2877 | 0.1683 | **41%** |
| overall | 0.1908 (80.9% correct) | 0.1380 (86.2% correct) | 28% |

- Baseline collapse: stock Whisper goes from 89.3% to 52.6% intelligibility, clean to severe.
- **Tone (STER):** improved 43% relative on severe (0.0947 → 0.0536) but **barely moved overall**
  (0.0529 → 0.0488), because clean, mild and moderate got slightly worse. Do not say "the model
  fixes tones" without the severe-only qualifier.
- Latency: the deck says "0.5 s to caption 1 s of speech". I could not find the source of this
  number in the repo. It was probably measured on the RTX 5060 training laptop
  `[ASSUMPTION until run]`. On a Mac CPU it will be slower; measure it before claiming it.
- Voice restoration (stage 2) was attempted and failed. It is documented and is **not** part of
  the product. The readback feature speaks recognised text in a generic system voice and must not
  be presented as the user's own voice.
- No real patient speech has been used yet. Every claim is on speech we damaged ourselves.

## Honesty constraints for any pitch, video or site copy

1. Say "simulated dysarthria" whenever you show numbers.
2. "Nothing leaves your device" is true only when the backend runs on the user's own machine. An
   ngrok tunnel to a teammate's laptop sends audio over the internet.
3. Demo clips must come from **held-out speakers**. The model overfits, and training clips score
   CER 0.000, which shows memorisation, not the model working. `site/src/sections/Demo.tsx`
   records the chosen clip: 與地主做良性的溝通, CER 0.444 → 0.111.
4. Don't have a teammate imitate dysarthria and present it as patient speech.

## Running locally

```bash
pip install -r requirements.txt
# _get_pipe("tuned") requires OWNVOICE_MODEL to be a LOCAL directory (it checks
# Path(...).exists() and returns 503 otherwise), so download the HF checkpoint first.
huggingface-cli download anonymous6623/ownvoice-asr --local-dir runs/asr_v1
python backend/app.py            # default OWNVOICE_MODEL is runs/asr_v1; serves 127.0.0.1:7860
# then open https://ownvoice-three.vercel.app/?api=http://127.0.0.1:7860
```

`[ASSUMPTION until run]` A page served over https can call `http://127.0.0.1` because Chrome
treats localhost as a secure origin. The backend's CORS allow-list only contains localhost:5173
and :4173, so calls from ownvoice-three.vercel.app will probably be blocked unless that origin is
added. The team may already handle this in the unpublished site/extension code. Verify before
recording.

Older React site: `cd site && npm install && npm run dev` (port 5173, API at localhost:7860).

## Extension fixes made 2026-10-19 (found by running the real panel on severe clips)

- `MAX_SEGMENT_S` went from 2.5 to 6 and `SILENCE_MS` from 320 to 500. At 2.5 s every severe
  sentence (3.5–6 s) was cut in two and misrecognised.
- Segments with no speech are now discarded. Before, silence produced "HTTP 400" captions.
- Backlog shedding no longer sends shed segments to the server and never drops the one in
  flight. Before, the first sentence of a call was lost.
- Measured on a Mac CPU: about 1.4–2.4 s from the end of a phrase to its caption.

## Open items (2026-10-19, late)

- Local `master` holds the upstream merge, the download button, the extension fixes and
  `video/`. It is **not pushed**: the push was blocked by the permission prompt. Run
  `git push origin master`, then open a PR to andrewshih0407/ownvoice so Andrew's copy gets
  the fixes.
- A downloaded extension still needs the model server on localhost, so a judge who installs it
  sees "Cannot reach the model server." The fixes are a hosted backend or the Chrome Web Store.
  Not decided.
- The "View the source" link points at `tree/master/extension`, which 404s until upstream
  master has the extension.
- Tab capture (`This tab's audio`) has not been exercised. Only the mic path was recorded.
- The local Python env (anaconda base) gained fastapi, uvicorn, soundfile, pyworld, librosa,
  zhconv, pypinyin and imageio-ffmpeg. `huggingface-hub` was pinned back to 1.x for
  transformers 5.10.
