# OwnVoice — Live Captions (Chrome extension)

Live captions for dysarthric Mandarin speech, in a Chrome side panel.

## Why this exists alongside the website

The website can only hear your own microphone. An extension can also capture
**a tab's audio**, so any call, video or stream in the browser can be captioned.
That is the Google Meet case, and a web page fundamentally cannot do it.

It also sidesteps a constraint the website has. A page served over HTTPS may not
call a plain `http://` API — browsers block mixed content — so the hosted site
cannot talk to a local model server. Extension pages run on `chrome-extension://`
and may call `http://localhost` directly with host permissions. **So this works
today against a backend on your own machine, with no hosting, no domain and no
TLS.**

## Run it

1. Start the model server:

   ```bash
   python -m uvicorn backend.app:app --port 7860
   ```

2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
   select this `extension/` folder.
3. Click the toolbar icon. The side panel opens.
4. Pick **Microphone** or **This tab's audio**, then **Start captions**.

Default server address is `http://localhost:7860`. Change it in **Settings**;
a non-local address asks for permission the first time.

## What the controls do

| control | effect |
|---|---|
| Microphone / This tab's audio | capture source |
| Adapted model / Fast mode | the fine-tuned whisper-small, or stock whisper-base |
| EN / 中文 | interface language (Traditional Chinese) |

**Fast mode is stock Whisper, not the adapted model.** It is there to show the
latency and accuracy trade, and the panel says so whenever it is selected.

## How it captures

Audio is cut at pauses by an energy gate (650 ms of silence, segments 1–8 s) and
each segment is transcribed whole. On CPU the model runs near real time, so
bounded per-segment latency beats a stream that drifts further behind the longer
someone talks.

Capture is raw Web Audio and WAV is encoded in the panel, because the server
decodes with `soundfile`, which cannot read MediaRecorder's webm/opus.

When capturing a tab, the audio is routed back to the speakers — otherwise
Chrome silences the tab for the user while it is being captured.

**No audio is stored.** Each segment is encoded, posted, and dropped. Nothing is
written to disk by the extension.

## Publishing

`chrome://extensions` → **Pack extension**, or upload the folder as a ZIP to the
Chrome Web Store dashboard. The store charges a **one-time 5 USD developer
registration fee**; loading unpacked is free and is enough for a demo.

Before submitting, be ready to justify the permissions — reviewers ask:

| permission | why |
|---|---|
| `sidePanel` | the UI surface |
| `tabCapture` | captioning a tab's audio, the core feature |
| `activeTab` | identifying which tab to capture, granted only on user action |
| `storage` | remembering server address, model and language |
| `host_permissions: localhost` | reaching a model server on the user's machine |
| `optional_host_permissions: https://*` | a user-supplied remote server, requested only when one is entered |

A privacy policy is required because the extension handles microphone input.
The honest statement is short: audio is sent to the server address the user
configures, is not retained by the extension, and no analytics are collected.

## Limits

- **Untested against a real microphone and real tab capture.** The layout, the
  language switching, the error paths and the request shape were verified; live
  capture was not. Chrome extensions cannot be driven from the authoring
  environment used to build this.
- Chrome blocks capture on `chrome://` pages and the Web Store; the panel
  reports that rather than failing silently.
- `ScriptProcessorNode` is deprecated in favour of `AudioWorklet`. It is used
  here because it needs no separate module file, and it works in current Chrome.
- The model is not bundled. The extension is a client; it needs a reachable
  server. Running the model fully in-browser via ONNX is a possible future
  direction and would remove the server entirely.
