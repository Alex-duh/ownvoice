/**
 * Live captioning for the product site.
 *
 * The site is static and has no backend of its own, so the model address is
 * supplied at runtime:
 *
 *   ?api=https://something.ngrok-free.app   sets it and remembers it
 *   ?api=                                    clears it
 *
 * The chosen address is kept in localStorage so a visitor does not have to
 * paste it again. If nothing is set, or the address does not answer, the whole
 * section hides itself rather than offering a button that cannot work.
 *
 * Capture is raw Web Audio and the WAV is built here, because the server
 * decodes with soundfile, which cannot read MediaRecorder's webm/opus. Audio is
 * cut at pauses and each phrase is sent whole, so the delay is one phrase plus
 * one inference rather than a lag that grows the longer someone talks.
 */

const TARGET_SR = 16000;
const SILENCE_RMS = 0.012;
const SILENCE_MS = 420;
const MIN_SEGMENT_S = 0.8;
const MAX_SEGMENT_S = 4;
const KEY = "ownvoice.api";

/* ngrok's free tier answers browser-looking requests with an HTML warning page
   instead of the API. This header opts out of it. Harmless on any other host. */
const HDRS = { "ngrok-skip-browser-warning": "true" };

/* ------------------------------------------------------------ api address */

function resolveApi() {
  const q = new URLSearchParams(location.search);
  if (q.has("api")) {
    const v = (q.get("api") || "").trim().replace(/\/+$/, "");
    try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {}
    return v || null;
  }
  try { return localStorage.getItem(KEY); } catch (e) { return null; }
}

const API = resolveApi();

/* ------------------------------------------------------------------ audio */

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

/* ------------------------------------------------------------------- live */

let ctx = null, stream = null, node = null;
let buf = [], silentMs = 0, voiced = false, recording = false;
let queue = Promise.resolve();

const $ = (id) => document.getElementById(id);

function addLine(text, pending) {
  const out = $("liveOut");
  const p = document.createElement("p");
  p.className = "live__line" + (pending ? " is-pending" : "");
  p.textContent = text;
  out.appendChild(p);
  out.scrollTop = out.scrollHeight;
  return p;
}

function send(pcm, rate) {
  const el = addLine(T("live.listening"), true);
  const wav = encodeWav(downsample(pcm, rate), TARGET_SR);
  const fd = new FormData();
  fd.append("file", wav, "chunk.wav");
  fd.append("mode", "tuned");

  queue = queue
    .then(() => fetch(API + "/transcribe_chunk",
      { method: "POST", body: fd, headers: HDRS }))
    .then(async (r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      el.className = "live__line";
      el.textContent = j.transcript || T("live.nothing");
    })
    .catch(() => {
      el.className = "live__line is-err";
      el.textContent = T("live.unreachable");
    });
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

async function start() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch (e) {
    $("liveErr").textContent = T("live.micDenied");
    $("liveErr").style.display = "block";
    return;
  }
  $("liveErr").style.display = "none";
  ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  node = ctx.createScriptProcessor(4096, 1, 1);
  const frameMs = (4096 / ctx.sampleRate) * 1000;

  node.onaudioprocess = (e) => {
    const copy = new Float32Array(e.inputBuffer.getChannelData(0));
    let sum = 0;
    for (let i = 0; i < copy.length; i++) sum += copy[i] * copy[i];
    const rms = Math.sqrt(sum / copy.length);
    $("liveLevel").style.width = Math.min(100, rms * 1200) + "%";

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
  sink.gain.value = 0;           // never echo the microphone back to the room
  node.connect(sink);
  sink.connect(ctx.destination);

  recording = true;
  $("liveBtn").dataset.i18n = "live.stop";
  applyI18n();
  $("liveBtn").classList.add("is-rec");
}

function stop() {
  if (buf.length && ctx) flush(ctx.sampleRate);
  if (node) { node.disconnect(); node = null; }
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  if (ctx) { ctx.close().catch(() => {}); ctx = null; }
  recording = false;
  $("liveLevel").style.width = "0%";
  $("liveBtn").dataset.i18n = "live.btn";
  applyI18n();
  $("liveBtn").classList.remove("is-rec");
}

/* Only reveal the section if a model is actually answering. A dead button is
   worse than no button on a page people are deciding whether to trust. */
async function init() {
  const section = $("live");
  if (!API) return;
  try {
    const r = await fetch(API + "/health", { cache: "no-store", headers: HDRS });
    if (!(r.headers.get("content-type") || "").includes("json")) return;
    if (!r.ok) return;
  } catch (e) { return; }

  section.hidden = false;
  $("liveBtn").addEventListener("click", () => (recording ? stop() : start()));
  window.addEventListener("beforeunload", () => { if (recording) stop(); });
}

init();
