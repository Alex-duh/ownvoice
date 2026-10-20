# Demo video pipeline (v2, 2026-10-20)

Builds the ~2-minute demo with no screen recorder and no video editor. The footage is recorded
by Playwright, the motion graphics are rendered by Remotion, and everything is scripted.
(v1, 2026-10-19, used macOS text-to-speech voices and an ffmpeg-only edit; it is superseded.)

## What is real and what is staged

| Part | Status |
|---|---|
| Extension side panel, segmentation, WAV encoding, HTTP call | **Real**: the shipped `extension/` code loaded unpacked into Chromium. The recording copy only adds `web_accessible_resources` to the manifest so the stage page can iframe the panel |
| Captions in the call | **Real**: fine-tuned `anonymous6623/ownvoice-asr` on a laptop CPU, recorded live, unedited |
| "Standard recognition" comparisons | **Real** stock whisper-small output on the same audio (`make_cv_clips.py`) |
| Voices | **Real people**: Mozilla Common Voice zh-TW **test** split (CC0). The model trained only on the train split, and CV splits are speaker-disjoint, so these speakers are unseen. Dysarthria is **simulated** by the repo's own `/simulate` at severe. Labeled on screen |
| Audio input | Chrome's fake capture device plays the call audio as the microphone. Labeled on screen |
| Chrome window and video call | **Mock** HTML (`stage/call.html`), built to look like light-theme Chrome. Not Google Meet. Mr. Lin's tile is camera-off, so no stranger's face is used as a "patient" |
| Website footage | **Real** live site, ownvoice.vercel.app |
| 買/賣 tone curves | Textbook tone shapes, labeled "illustration" |
| Music | "Carefree" by Kevin MacLeod (incompetech.com), CC BY 4.0, credited on the end card |
| Sound effects | Synthesized by `make_sfx.py` |

Speaker selection for the call: three older-male CV test speakers were scored (19 clips). Mean
CER was 0.19 for OwnVoice and 0.40 for stock. The video uses all five clips of one speaker
(forties, clean recording); the model got all five right and stock got three wrong.

## Re-render

```bash
S=/some/scratch/dir
python3 backend/app.py                                   # fresh model server on :7860
# 1. voices: CV test parquet shards in $S/cv/data, then simulate and score
python3 video/make_cv_clips.py $S/cv $S/cvclips severe 6413c4ea38 05cfa2a1d9 f5de637cd0
#    copy the five 6413c4ea38 clips (order 5,4,3,1,2) to $S/call2/severe1..5.wav
python3 video/build_call_audio.py $S/call2 5
# 2. footage (Chromium with the extension; serve video/stage on :8801 first)
cp $S/call2/demo_call.json video/stage/demo_call2.json
node video/record_call2.mjs $S http://127.0.0.1:8801 <extension copy with WAR> $S/call2/demo_call.wav $S/out2/call
node video/record_site2.mjs $S/out2/site
# 3. assets into video/remotion/public (footage/, audio/, sfx/ via make_sfx.py), then:
cd video/remotion && npx remotion render src/index.ts Demo out/OwnVoice-demo.mp4 \
  --browser-executable ~/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell
```

Check the captions each take prints. A take can differ slightly from run to run, because
segmentation depends on timing.
