/**
 * OwnVoice live captions — side panel.
 *
 * Two audio sources, which is the reason this exists as an extension rather
 * than only as a website:
 *
 *   mic  — the speaker's own voice, same as the web demo.
 *   tab  — the audio of the current tab, via chrome.tabCapture. This is what a
 *          page cannot do. It means any call, video or stream in the browser
 *          can be captioned, which is the Google Meet case.
 *
 * Capture is raw Web Audio and WAV is encoded here, because the server decodes
 * with soundfile and cannot read MediaRecorder's webm/opus. Audio is cut at
 * pauses and each segment transcribed whole: on CPU the model runs near real
 * time, so bounded per-segment latency beats a stream that drifts further
 * behind the longer someone talks.
 *
 * No audio is stored. Each segment is encoded, posted, and dropped.
 */

const TARGET_SR = 16000;
const SILENCE_RMS = 0.012;
const SILENCE_MS = 420;
const MIN_SEGMENT_S = 0.8;
// Dominates perceived lag: total delay is roughly this plus inference.
// Continuous speech or singing never triggers the pause gate, so this cap
// is what actually closes a segment, and 8 s felt unusable.
const MAX_SEGMENT_S = 4;

const DEFAULTS = { apiBase: "http://localhost:7860", mode: "tuned", lang: "en" };

const STR = {
  en: {
    mic: "Microphone", tab: "This tab's audio",
    start: "Start captions", stop: "Stop",
    waiting: "Captions appear here.", listening: "Listening…",
    transcribing: "transcribing…", silence: "(silence)",
    tuned: "Adapted model", fast: "Fast mode",
    settings: "Settings", clear: "Clear",
    noApi: "Cannot reach the model server. Open Settings and check the address.",
    micDenied: "Microphone permission denied. Allow it and try again.",
    tabDenied: "Could not capture this tab. Open the tab you want captioned, then click the OwnVoice toolbar icon on it before pressing Start.",
    tabUnsupported: "Chrome does not allow capture on chrome:// pages or the Web Store. Switch to an ordinary page.",
    fastWarn: "Fast mode is stock Whisper, not the adapted model.",
  },
  zh: {
    mic: "麥克風", tab: "此分頁的聲音",
    start: "開始字幕", stop: "停止",
    waiting: "字幕會顯示在這裡。", listening: "聆聽中…",
    transcribing: "辨識中…", silence: "（無語音）",
    tuned: "微調模型", fast: "快速模式",
    settings: "設定", clear: "清除",
    noApi: "無法連線至模型伺服器。請開啟設定並檢查位址。",
    micDenied: "麥克風權限遭拒。請允許後再試一次。",
    tabDenied: "無法擷取此分頁。請先開啟要加字幕的分頁，在該分頁上點擊 OwnVoice 工具列圖示，然後再按開始。",
    tabUnsupported: "Chrome 不允許擷取 chrome:// 頁面或線上應用程式商店。請切換到一般網頁。",
    fastWarn: "快速模式使用原版 Whisper，並非微調後的模型。",
  },
};

let cfg = { ...DEFAULTS };
let source = "mic";
let recording = false;
let ctx = null, stream = null, node = null, passthrough = null;
let buf = [], silentMs = 0, voiced = false, segId = 0, pending = 0;
let queue = Promise.resolve();

const $ = (id) => document.getElementById(id);
const t = () => STR[cfg.lang];

/* ---------------------------------------------------------------- audio */

function downsample(input, inRate) {
  if (inRate === TARGET_SR) return input;
  const ratio = inRate / TARGET_SR;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio, lo = Math.floor(pos);
    const hi = Math.min(lo + 1, input.length - 1);
    out[i] = input[lo] + (input[hi] - input[lo]) * (pos - lo);
  }
  return out;
}

function encodeWav(pcm, rate) {
  const b = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(b);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVEfmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([v], { type: "audio/wav" });
}

/* ------------------------------------------------------------ captions */

function addSegment(id) {
  const li = document.createElement("li");
  li.className = "seg is-pending";
  li.id = "seg" + id;
  li.innerHTML = `<span class="seg__text">${t().transcribing}</span><span class="seg__meta"></span>`;
  $("out").appendChild(li);
  $("out").scrollTop = $("out").scrollHeight;
}

function fillSegment(id, text, meta, failed) {
  const li = $("seg" + id);
  if (!li) return;
  li.className = "seg" + (failed ? " is-error" : "");
  li.querySelector(".seg__text").textContent = text || t().silence;
  li.querySelector(".seg__meta").textContent = meta || "";
  $("out").scrollTop = $("out").scrollHeight;
}

function send(pcm, rate) {
  const id = ++segId;
  const durationS = pcm.length / rate;
  addSegment(id);
  pending++; renderStatus();

  const wav = encodeWav(downsample(pcm, rate), TARGET_SR);
  const fd = new FormData();
  fd.append("file", wav, "chunk.wav");
  fd.append("mode", cfg.mode);

  queue = queue
    .then(() => fetch(cfg.apiBase.replace(/\/+$/, "") + "/transcribe_chunk", {
      method: "POST", body: fd,
    }))
    .then(async (r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      fillSegment(id, j.transcript,
        `${durationS.toFixed(1)}s · ${(j.elapsed_ms / 1000).toFixed(1)}s`, false);
    })
    .catch((e) => fillSegment(id, String(e.message || e), "", true))
    .finally(() => { pending--; renderStatus(); });
}

function flush(rate) {
  const chunks = buf; buf = []; voiced = false; silentMs = 0;
  const total = chunks.reduce((n, c) => n + c.length, 0);
  if (total / rate < MIN_SEGMENT_S) return;
  const merged = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }
  send(merged, rate);
}

/* -------------------------------------------------------------- capture */

async function getStream() {
  if (source === "mic") {
    return navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  }

  // Ask the worker which tab is in front, then mint the stream id HERE. The id
  // is only valid in the context that requested it, and this panel is the
  // context that calls getUserMedia.
  const res = await chrome.runtime.sendMessage({ type: "getActiveTab" });
  if (res?.error) throw new Error(res.error);
  if (!res?.tabId) throw new Error("no-active-tab");

  const streamId = await new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: res.tabId }, (id) => {
      const err = chrome.runtime.lastError;
      if (err || !id) reject(new Error(err?.message || "no-stream"));
      else resolve(id);
    });
  });

  return navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
    },
  });
}

async function start() {
  setError("");
  try {
    stream = await getStream();
  } catch (e) {
    const m = String(e?.message || e);
    if (source === "tab") {
      setError(m === "unsupported-tab" ? t().tabUnsupported
             : t().tabDenied + " [" + m + "]");
    } else {
      setError(t().micDenied);
    }
    return;
  }

  ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  node = ctx.createScriptProcessor(4096, 1, 1);
  const frameMs = (4096 / ctx.sampleRate) * 1000;

  node.onaudioprocess = (e) => {
    const copy = new Float32Array(e.inputBuffer.getChannelData(0));
    let sum = 0;
    for (let i = 0; i < copy.length; i++) sum += copy[i] * copy[i];
    const rms = Math.sqrt(sum / copy.length);
    $("level").style.width = Math.min(100, rms * 1200) + "%";

    buf.push(copy);
    const held = buf.reduce((n, c) => n + c.length, 0) / ctx.sampleRate;
    if (rms > SILENCE_RMS) { voiced = true; silentMs = 0; }
    else if (voiced) silentMs += frameMs;

    if ((voiced && silentMs >= SILENCE_MS && held >= MIN_SEGMENT_S) || held >= MAX_SEGMENT_S) {
      flush(ctx.sampleRate);
    }
  };

  src.connect(node);
  const sink = ctx.createGain();
  sink.gain.value = 0;              // never echo the mic back to the speakers
  node.connect(sink);
  sink.connect(ctx.destination);

  // Capturing a tab silences it for the user unless the audio is routed back
  // out. Without this the meeting the user is captioning goes mute on them.
  if (source === "tab") {
    passthrough = ctx.createGain();
    passthrough.gain.value = 1;
    src.connect(passthrough);
    passthrough.connect(ctx.destination);
  }

  recording = true;
  renderStatus();
}

function stop() {
  if (buf.length && ctx) flush(ctx.sampleRate);
  if (node) { node.disconnect(); node = null; }
  if (passthrough) { passthrough.disconnect(); passthrough = null; }
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  if (ctx) { ctx.close().catch(() => {}); ctx = null; }
  recording = false;
  $("level").style.width = "0%";
  renderStatus();
}

/* ------------------------------------------------------------------- ui */

function setError(msg) {
  $("err").textContent = msg || "";
  $("err").style.display = msg ? "block" : "none";
}

function renderStatus() {
  $("rec").textContent = recording ? t().stop : t().start;
  $("rec").classList.toggle("is-rec", recording);
  $("pending").textContent = pending > 0 ? String(pending) : "";
  $("dot").classList.toggle("is-live", recording);
}

function renderLabels() {
  $("srcMic").textContent = t().mic;
  $("srcTab").textContent = t().tab;
  $("modeTuned").textContent = t().tuned;
  $("modeFast").textContent = t().fast;
  $("settings").textContent = t().settings;
  $("clear").textContent = t().clear;
  $("empty").textContent = recording ? t().listening : t().waiting;
  $("fastWarn").textContent = t().fastWarn;
  $("fastWarn").style.display = cfg.mode === "fast" ? "block" : "none";
  document.documentElement.lang = cfg.lang === "zh" ? "zh-TW" : "en";
  renderStatus();
}

function selectGroup(groupSel, value, attr) {
  document.querySelectorAll(groupSel).forEach((b) =>
    b.classList.toggle("is-on", b.dataset[attr] === value));
}

/**
 * Push one throwaway second of audio through the model so its weights are
 * resident before the first real segment arrives. Cold start measured 45 s
 * against 1.3 s warm, and that 45 s would otherwise land on the opening line
 * of a demo.
 */
async function warmUp() {
  const n = TARGET_SR;
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i++) pcm[i] = Math.sin(i * 0.02) * 0.05;
  const fd = new FormData();
  fd.append("file", encodeWav(pcm, TARGET_SR), "warm.wav");
  fd.append("mode", cfg.mode);
  try {
    await fetch(cfg.apiBase.replace(/\/+$/, "") + "/transcribe_chunk",
      { method: "POST", body: fd });
  } catch (e) { /* warm-up is best effort */ }
}

async function init() {
  cfg = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  selectGroup(".src", source, "src");
  selectGroup(".mode", cfg.mode, "mode");
  selectGroup(".lang", cfg.lang, "lang");
  renderLabels();

  document.querySelectorAll(".src").forEach((b) => b.onclick = () => {
    if (recording) return;
    source = b.dataset.src;
    selectGroup(".src", source, "src");
  });
  document.querySelectorAll(".mode").forEach((b) => b.onclick = async () => {
    cfg.mode = b.dataset.mode;
    await chrome.storage.sync.set({ mode: cfg.mode });
    selectGroup(".mode", cfg.mode, "mode");
    renderLabels();
  });
  document.querySelectorAll(".lang").forEach((b) => b.onclick = async () => {
    cfg.lang = b.dataset.lang;
    await chrome.storage.sync.set({ lang: cfg.lang });
    selectGroup(".lang", cfg.lang, "lang");
    renderLabels();
  });

  $("rec").onclick = () => (recording ? stop() : start());
  $("clear").onclick = () => { $("out").innerHTML = ""; segId = 0; };
  $("settings").onclick = () => chrome.runtime.openOptionsPage();

  // Surface an unreachable backend before the user talks into a void.
  fetch(cfg.apiBase.replace(/\/+$/, "") + "/health")
    .then((r) => { if (!r.ok) throw new Error(); })
    .then(warmUp)
    .catch(() => setError(t().noApi));
}

init();
