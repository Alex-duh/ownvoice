import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { transcribeChunk, type LiveMode } from "../lib/api";
import {
  cancelSpeech,
  loadVoices,
  pickZhVoice,
  speak,
  speechSupported,
} from "../lib/speech";
import { T, LANG_LABEL, type Lang } from "../lib/i18n";

/**
 * Live microphone transcription.
 *
 * Why this is chunked rather than streaming: on the free CPU tier whisper-small
 * runs SLOWER than real time (DEPLOY.md measures tens of seconds per clip), so
 * a true streaming transcript would fall further behind the speaker the longer
 * they talked. Instead we cut the input at natural pauses and transcribe each
 * segment whole. Latency is then one segment plus one inference, bounded rather
 * than growing, and the UI reports it honestly instead of implying real time.
 *
 * Capture is raw Web Audio rather than MediaRecorder because MediaRecorder
 * emits webm/opus, which the server's soundfile decoder cannot read. Taking
 * Float32 PCM and encoding WAV in the browser keeps the existing upload
 * contract and adds no server dependency.
 */

const TARGET_SR = 16_000;

// Energy gate. Tuned by ear on laptop mics in a quiet room; it is a crude VAD
// and will cut mid-word in a noisy hall. Segments are capped regardless, so the
// failure mode is a clumsy split, never a lost recording.
const SILENCE_RMS = 0.012;
const SILENCE_MS = 650;
const MIN_SEGMENT_S = 1.0;
const MAX_SEGMENT_S = 8;

type Segment = {
  id: number;
  text: string;
  elapsedMs: number;
  durationS: number;
  rtf: number | null;
  state: "pending" | "done" | "error";
};

/** Linear-interpolation resample to 16 kHz, which is what Whisper expects. */
function downsample(input: Float32Array, inRate: number): Float32Array {
  if (inRate === TARGET_SR) return input;
  const ratio = inRate / TARGET_SR;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, input.length - 1);
    out[i] = input[lo] + (input[hi] - input[lo]) * (pos - lo);
  }
  return out;
}

/** 16-bit PCM WAV. The server reads this with soundfile unchanged. */
function encodeWav(pcm: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buf);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}

export function LiveTranscribe() {
  const [recording, setRecording] = useState(false);
  const [mode, setMode] = useState<LiveMode>("tuned");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [level, setLevel] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  // Readback of the recognised text. Generic voice, not the speaker's own --
  // see the framing note in lib/speech.ts.
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [noVoice, setNoVoice] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  // Stage mode: full-screen transcript for a projector or a room display.
  const [stage, setStage] = useState(false);
  // Interface language. The device is for Mandarin speakers; the surrounding
  // page is English for the research audience, so this defaults to match the
  // page and switches on demand.
  const [lang, setLang] = useState<Lang>("en");
  const langRef = useRef<Lang>(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const bufRef = useRef<Float32Array[]>([]);
  const silentMsRef = useRef(0);
  const voicedRef = useRef(false);
  const idRef = useRef(0);
  // The audio callback is installed once, so anything it reads must be a ref.
  const modeRef = useRef<LiveMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  // Serialises inference. Two overlapping requests on a 2-vCPU box make both
  // slower than running them back to back.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const autoSpeakRef = useRef(autoSpeak);
  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
    if (!autoSpeak) cancelSpeech();
  }, [autoSpeak]);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  // Voices arrive asynchronously; resolve once and remember whether this
  // machine has any Mandarin voice at all.
  useEffect(() => {
    if (!speechSupported()) {
      setNoVoice(true);
      return;
    }
    loadVoices().then((vs) => {
      const v = pickZhVoice(vs);
      setVoice(v);
      setNoVoice(!v);
    });
  }, []);

  const send = useCallback((pcm: Float32Array, rate: number) => {
    const id = ++idRef.current;
    const durationS = pcm.length / rate;
    setSegments((s) => [
      ...s,
      { id, text: "", elapsedMs: 0, durationS, rtf: null, state: "pending" },
    ]);
    setPending((n) => n + 1);

    const wav = encodeWav(downsample(pcm, rate), TARGET_SR);
    const chosen = modeRef.current;

    queueRef.current = queueRef.current
      .then(() => transcribeChunk(wav, chosen))
      .then((r) => {
        setSegments((s) =>
          s.map((seg) =>
            seg.id === id
              ? {
                  ...seg,
                  text: r.transcript,
                  elapsedMs: r.elapsed_ms,
                  rtf: r.realtime_factor,
                  state: "done" as const,
                }
              : seg
          )
        );
        if (autoSpeakRef.current && r.transcript.trim()) {
          speak(r.transcript, voiceRef.current, {
            onStart: () => setSpeakingId(id),
          }).then(() => setSpeakingId((cur) => (cur === id ? null : cur)));
        }
      })
      .catch((e: any) => {
        setSegments((s) =>
          s.map((seg) =>
            seg.id === id
              ? { ...seg, text: String(e?.message || e), state: "error" as const }
              : seg
          )
        );
      })
      .finally(() => setPending((n) => n - 1));
  }, []);

  const flush = useCallback(
    (rate: number) => {
      const chunks = bufRef.current;
      bufRef.current = [];
      voicedRef.current = false;
      silentMsRef.current = 0;
      const total = chunks.reduce((n, c) => n + c.length, 0);
      if (total / rate < MIN_SEGMENT_S) return;
      const merged = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        merged.set(c, off);
        off += c.length;
      }
      send(merged, rate);
    },
    [send]
  );

  const stop = useCallback(() => {
    const rate = ctxRef.current?.sampleRate ?? 48_000;
    if (bufRef.current.length) flush(rate);
    nodeRef.current?.disconnect();
    nodeRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setRecording(false);
    setLevel(0);
    cancelSpeech();
    setSpeakingId(null);
  }, [flush]);

  const start = useCallback(async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      // ScriptProcessorNode is deprecated in favour of AudioWorklet, which
      // needs a separate module file and bundler wiring. For a single mono
      // capture at demo scale the simpler node is the right trade.
      const node = ctx.createScriptProcessor(4096, 1, 1);
      nodeRef.current = node;

      const frameMs = (4096 / ctx.sampleRate) * 1000;

      node.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input);

        let sum = 0;
        for (let i = 0; i < copy.length; i++) sum += copy[i] * copy[i];
        const rms = Math.sqrt(sum / copy.length);
        setLevel(Math.min(1, rms * 12));

        bufRef.current.push(copy);
        const heldS =
          bufRef.current.reduce((n, c) => n + c.length, 0) / ctx.sampleRate;

        if (rms > SILENCE_RMS) {
          voicedRef.current = true;
          silentMsRef.current = 0;
        } else if (voicedRef.current) {
          silentMsRef.current += frameMs;
        }

        const pauseEnded =
          voicedRef.current &&
          silentMsRef.current >= SILENCE_MS &&
          heldS >= MIN_SEGMENT_S;

        if (pauseEnded || heldS >= MAX_SEGMENT_S) flush(ctx.sampleRate);
      };

      src.connect(node);
      // Zero-gain sink: ScriptProcessorNode does not fire unless it reaches the
      // destination, but routing the mic to the speakers would howl.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      node.connect(mute);
      mute.connect(ctx.destination);

      setRecording(true);
    } catch (e: any) {
      setErr(
        e?.name === "NotAllowedError"
          ? T[langRef.current].micDenied
          : String(e?.message || e)
      );
    }
  }, [flush]);

  // Release the mic if the page unmounts mid-recording.
  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!stage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStage(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage]);

  const speakOne = useCallback(
    (id: number, text: string) => {
      cancelSpeech();
      speak(text, voice, { onStart: () => setSpeakingId(id) }).then(() =>
        setSpeakingId((cur) => (cur === id ? null : cur))
      );
    },
    [voice]
  );

  const t = T[lang];

  const done = segments.filter((s) => s.state === "done");
  const transcript = done.map((s) => s.text).join("");
  const avgRtf =
    done.length && done.every((s) => s.rtf != null)
      ? done.reduce((n, s) => n + (s.rtf as number), 0) / done.length
      : null;

  const MODES: [LiveMode, string, string][] = [
    ["tuned", t.modeTuned, t.modeTunedNote],
    ["fast", t.modeFast, t.modeFastNote],
  ];

  return (
    <div className="tile tile--cobalt live-card">
      <div className="live-head">
        <h3>{t.title}</h3>
        <div className="live-langs" role="group" aria-label="Interface language">
          {(["en", "zh"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              className={`live-lang ${lang === l ? "is-on" : ""}`}
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
      </div>
      <p className="live-sub" lang={lang === "zh" ? "zh-TW" : "en"}>
        {t.sub}
      </p>

      <div className="live-modes">
        {MODES.map(([m, label, note]) => (
          <button
            key={m}
            type="button"
            className={`live-mode ${mode === m ? "is-on" : ""}`}
            onClick={() => setMode(m)}
            disabled={recording}
          >
            <span className="live-mode__label">{label}</span>
            <span className="live-mode__note">{note}</span>
          </button>
        ))}
      </div>
      {mode === "fast" && (
        <p className="live-warn">{t.fastWarn}</p>
      )}

      <div className="live-controls">
        <button
          className="demo-btn live-rec"
          onClick={recording ? stop : start}
          type="button"
        >
          {recording ? t.stop : t.start}
        </button>
        <div className="live-meter" aria-hidden="true">
          <div
            className="live-meter__fill"
            style={{ width: `${level * 100}%` }}
          />
        </div>
        {pending > 0 && (
          <span className="live-pending">{t.inFlight(pending)}</span>
        )}
      </div>

      <div className="live-extras">
        <label className={`live-check ${noVoice ? "is-off" : ""}`}>
          <input
            type="checkbox"
            checked={autoSpeak}
            disabled={noVoice}
            onChange={(e) => setAutoSpeak(e.target.checked)}
          />
          <span>
            {t.readAloud}
            {voice ? ` (${voice.lang})` : ""}
          </span>
        </label>
        <button
          type="button"
          className="live-stage-btn"
          onClick={() => setStage(true)}
        >
          {t.stageMode}
        </button>
      </div>
      {noVoice && (
        <p className="live-warn">{t.noVoice}</p>
      )}

      {err && <p className="live-err">{err}</p>}

      <div className="live-out">
        {segments.length === 0 ? (
          <span className="live-out__empty">
            {recording ? t.listeningHint : t.empty}
          </span>
        ) : (
          <>
            <p className="live-out__text">{transcript || "…"}</p>
            <ul className="live-segs">
              {segments.map((s) => (
                <li key={s.id} className={`live-seg live-seg--${s.state}`}>
                  <span className="live-seg__text">
                    {s.state === "pending"
                      ? t.transcribing
                      : s.text || t.silence}
                  </span>
                  {s.state === "done" && s.text && !noVoice && (
                    <button
                      type="button"
                      className="live-seg__speak"
                      onClick={() => speakOne(s.id, s.text)}
                      title={t.speakTitle}
                    >
                      {speakingId === s.id ? "▶" : "♪"}
                    </button>
                  )}
                  {s.state === "done" && (
                    <span className="live-seg__meta">
                      {s.durationS.toFixed(1)}{t.secAudio} {"·"}{" "}
                      {(s.elapsedMs / 1000).toFixed(1)}s
                      {s.rtf != null && ` · ${s.rtf.toFixed(2)}x`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {avgRtf != null && (
        <p className="live-rtf">
          {t.avgRtf(avgRtf.toFixed(2))}{" "}
          {avgRtf > 1 ? t.rtfSlow : t.rtfFast}
        </p>
      )}

      {stage &&
        createPortal(
          <div
            className="stage"
            role="dialog"
            aria-label="Stage transcript"
            lang={lang === "zh" ? "zh-TW" : "en"}
          >
          <div className="stage__bar">
            <span className={`stage__dot ${recording ? "is-live" : ""}`} />
            <span className="stage__label">
              {recording ? t.stageListening : t.stagePaused}
              {" · "}
              {mode === "tuned" ? t.stageTuned : t.stageFast}
            </span>
            <div className="stage__meter" aria-hidden="true">
              <div
                className="stage__meter-fill"
                style={{ width: `${level * 100}%` }}
              />
            </div>
            <button
              type="button"
              className="stage__btn"
              onClick={recording ? stop : start}
            >
              {recording ? t.stageStop : t.stageStart}
            </button>
            <button
              type="button"
              className="stage__btn"
              onClick={() => setStage(false)}
            >
              {t.stageExit}
            </button>
          </div>

          <div className="stage__body">
            {done.length === 0 ? (
              <p className="stage__wait">
                {recording ? t.listeningHint : t.stageWait}
              </p>
            ) : (
              <p className="stage__text">
                {done.slice(0, -1).map((seg) => (
                  <span key={seg.id} className="stage__past">
                    {seg.text}
                  </span>
                ))}
                <span className="stage__now">{done[done.length - 1].text}</span>
              </p>
            )}
            {pending > 0 && <p className="stage__pending">…</p>}
            </div>
          </div>,
          document.body
        )}

      <style>{`
        .live-card{padding:26px 24px}
        .live-head{display:flex;align-items:center;justify-content:space-between;
          gap:12px}
        .live-head h3{margin:0}
        .live-langs{display:flex;gap:4px;flex:0 0 auto}
        .live-lang{padding:5px 11px;border-radius:99px;font:inherit;font-size:12px;
          font-weight:700;cursor:pointer;color:inherit;
          background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.45)}
        .live-lang.is-on{background:#fff;color:var(--ink);border-color:#fff}
        .live-sub{margin:6px 0 16px;font-size:14px;line-height:1.5;opacity:.95}
        .live-modes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
        .live-mode{display:flex;flex-direction:column;gap:2px;text-align:left;
          padding:10px 12px;border-radius:12px;cursor:pointer;
          background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.45);
          color:inherit;font:inherit}
        .live-mode.is-on{background:#fff;color:var(--ink);border-color:#fff}
        .live-mode:disabled{opacity:.6;cursor:default}
        .live-mode__label{font-weight:700;font-size:14px}
        .live-mode__note{font-size:11.5px;opacity:.92}
        .live-warn{margin:0 0 12px;font-size:12.5px;line-height:1.45;
          padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.18)}
        .live-controls{display:flex;align-items:center;gap:12px;margin:14px 0 10px}
        .live-rec{flex:0 0 auto;margin:0}
        .live-meter{flex:1;height:8px;border-radius:99px;overflow:hidden;
          background:rgba(255,255,255,.22)}
        .live-meter__fill{height:100%;background:#fff;transition:width .08s linear}
        .live-pending{font-size:12px;opacity:.8;white-space:nowrap}
        .live-err{margin:4px 0 0;font-size:13px;padding:8px 10px;border-radius:10px;
          background:rgba(0,0,0,.25)}
        .live-out{margin-top:12px;padding:14px;border-radius:14px;
          background:rgba(255,255,255,.12);min-height:92px}
        .live-out__empty{font-size:13.5px;opacity:.85}
        .live-out__text{margin:0 0 10px;font-size:19px;line-height:1.6;font-weight:600}
        .live-segs{list-style:none;margin:0;padding:0;display:flex;
          flex-direction:column;gap:6px}
        .live-seg{display:flex;justify-content:space-between;gap:10px;
          font-size:12.5px;padding-top:6px;border-top:1px solid rgba(255,255,255,.18)}
        .live-seg--pending{opacity:.65;font-style:italic}
        .live-seg--error{color:#ffd9d9}
        .live-seg__meta{opacity:.75;white-space:nowrap;font-variant-numeric:tabular-nums}
        .live-rtf{margin:10px 0 0;font-size:12.5px;opacity:.85;line-height:1.45}
        .live-extras{display:flex;align-items:center;justify-content:space-between;
          gap:12px;margin:2px 0 0;flex-wrap:wrap}
        .live-check{display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer}
        .live-check input{width:15px;height:15px;accent-color:#fff;cursor:pointer}
        .live-check.is-off{opacity:.5;cursor:default}
        .live-check.is-off input{cursor:default}
        .live-stage-btn{padding:7px 14px;border-radius:99px;font:inherit;font-size:13px;
          font-weight:700;cursor:pointer;color:inherit;
          background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.45)}
        .live-stage-btn:hover:not(:disabled){background:#fff;color:var(--ink)}
        .live-stage-btn:disabled{opacity:.45;cursor:default}
        .live-seg__speak{margin-left:auto;flex:0 0 auto;width:24px;height:24px;
          border-radius:50%;cursor:pointer;font-size:12px;line-height:1;
          background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);
          color:inherit;padding:0}
        .live-seg__speak:hover{background:#fff;color:var(--ink)}

        /* Stage mode: a projector view. Fixed, so it escapes the card. */
        .stage{position:fixed;inset:0;z-index:9999;background:#0d0b14;
          color:#fff;display:flex;flex-direction:column}
        .stage__bar{display:flex;align-items:center;gap:14px;padding:16px 24px;
          border-bottom:1px solid rgba(255,255,255,.16);flex-wrap:wrap}
        .stage__dot{width:11px;height:11px;border-radius:50%;background:#666;flex:0 0 auto}
        .stage__dot.is-live{background:#ff4d4d;animation:stagePulse 1.4s infinite}
        @keyframes stagePulse{0%,100%{opacity:1}50%{opacity:.25}}
        .stage__label{font-size:14px;letter-spacing:.04em;text-transform:uppercase;
          opacity:.85;white-space:nowrap}
        .stage__meter{flex:1;min-width:80px;height:6px;border-radius:99px;
          background:rgba(255,255,255,.18);overflow:hidden}
        .stage__meter-fill{height:100%;background:#fff;transition:width .08s linear}
        .stage__btn{padding:8px 16px;border-radius:99px;font:inherit;font-size:13px;
          font-weight:700;cursor:pointer;background:rgba(255,255,255,.14);
          border:1px solid rgba(255,255,255,.4);color:#fff}
        .stage__btn:hover{background:#fff;color:#0d0b14}
        .stage__body{flex:1;overflow-y:auto;display:flex;align-items:center;
          padding:5vh 6vw}
        .stage__text{margin:0;font-weight:700;line-height:1.35;
          font-size:clamp(30px,5.2vw,86px)}
        .stage__past{opacity:.45}
        .stage__now{opacity:1}
        .stage__wait{margin:0;opacity:.5;font-size:clamp(20px,3vw,42px)}
        .stage__pending{margin:0;opacity:.45;font-size:clamp(20px,3vw,42px)}
        @media (prefers-reduced-motion:reduce){
          .stage__dot.is-live{animation:none}
        }
        @media (max-width:640px){
          .live-modes{grid-template-columns:1fr}
          .live-controls{flex-wrap:wrap}
        }
      `}</style>
    </div>
  );
}
