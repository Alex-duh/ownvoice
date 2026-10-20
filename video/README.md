# Demo video pipeline

Produces the 2-minute demo (`OwnVoice-demo.mp4`, 1080p30, about 1:57) with no screen recorder
and no video editor. First rendered on 2026-10-19 from commit `0d78d12`.

## What is real and what is staged

| Part | Status |
|---|---|
| Extension side panel, segmentation, WAV encoding, HTTP call | **Real**: the shipped `extension/` code, loaded unpacked into Chromium |
| Captions | **Real**: fine-tuned `anonymous6623/ownvoice-asr` on a laptop CPU, recorded live, not edited |
| "Standard speech recognition" lines | **Real** stock whisper-small output on the same clips (`call_clip_results.json`) |
| Speaker audio | **Synthetic**: macOS `say` (Grandpa, zh_TW), then the repo's own `/simulate` at **severe**. Labeled on screen |
| Audio input | Chrome's fake capture device (`--use-file-for-fake-audio-capture`) plays the clip as the microphone. Labeled on screen |
| Video-call window | **Mock** HTML (`stage.html`), not Google Meet |
| 買/賣 contours | Textbook tone shapes (Chao letters), flattened to 20% of range. Labeled "illustration" |
| Music and clicks | Synthesized in `assemble.py`. There are no third-party assets |

The recording copy of the extension adds one manifest key, `web_accessible_resources`, so the
stage page can iframe the side panel. The captioning code itself is unchanged.

Clip scores (all six kept, none cherry-picked): mean CER is 0.079 for OwnVoice and 0.159 for
stock. OwnVoice is better on 2, tied on 3, and worse on 1 (`call_clip_results.json`).

## Re-render

```bash
S=/some/scratch/dir                       # everything writes under here
python3 backend/app.py                    # model server on :7860, runs/asr_v1 present
python3 video/make_call_clips.py $S/call  # clips + stock-vs-ours scores
python3 video/build_call_audio.py $S/call # demo_call.wav + demo_call.json
# copy extension/ to $S/ext-demo and add web_accessible_resources to its manifest
# serve $S/stage (stage.html, cards.html, demo_call.json) on 127.0.0.1:8800
node video/record_call.mjs $S             # hero shot; check captions, retake if needed
node video/record_rest.mjs $S             # cards + live site
python3 video/assemble.py $S $S/final/OwnVoice-demo.mp4
```

`assemble.py` uses the ffmpeg binary from `imageio-ffmpeg` (path at the top of the file).
The Node scripts need `playwright@1.58.2` and `npx playwright install chromium`.
