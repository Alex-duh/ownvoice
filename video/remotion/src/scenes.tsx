import React from "react";
import { AbsoluteFill, interpolate, Easing, useCurrentFrame, OffthreadVideo, staticFile, Sequence, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { C, F, s } from "./theme";
import { Iridescent, ToneStack, TONES, tonePath, Words, Pop, Logo, Chip, useIn, clamp01 } from "./components";
import callMeta from "../public/footage/call.json";
import siteMeta from "../public/footage/site.json";
import callStock from "../public/footage/call_stock.json";
import mdsc from "../public/footage/mdsc_summary.json";

const ease = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const, easing: Easing.inOut(Easing.cubic) };

/* =============================================================== 1. intro */
export const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const draw = interpolate(f, [8, 55], [0, 1], ease);
  const breathe = 1 + Math.sin(f / 22) * 0.012;
  const labels = ["mā", "má", "mǎ", "mà"];
  return (
    <AbsoluteFill>
      <Iridescent />
      <AbsoluteFill style={{ padding: "0 140px", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: 860 }}>
          <Words text="ONE SYLLABLE. FOUR TONES." start={4} stagger={2} style={{ font: `700 24px ${F.body}`, letterSpacing: "0.2em", color: C.tangerine, marginBottom: 26 }} />
          <Words text="In Mandarin, pitch changes the word." start={12} stagger={4} style={{ font: `900 104px/1.02 ${F.display}`, letterSpacing: "-0.03em", color: C.ink }} highlight={{ pitch: C.cobalt }} />
          <Words text="Get the tone wrong and you have said something else." start={52} stagger={2} style={{ font: `500 34px/1.4 ${F.body}`, color: C.inkSoft, marginTop: 30 }} />
        </div>
        <div style={{ position: "relative", transform: `scale(${breathe})` }}>
          <ToneStack flatten={0} draw={draw} width={560} gap={110} stroke={10} />
          {labels.map((l, i) => (
            <div key={l} style={{ position: "absolute", left: -80, top: i * 110 + 26, font: `700 34px ${F.body}`, color: TONES[i].color, opacity: interpolate(f, [20 + i * 6, 34 + i * 6], [0, 1], ease) }}>{l}</div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ============================================================ 2. buy / sell */
export const BuySell: React.FC = () => {
  const f = useCurrentFrame();
  const flatten = interpolate(f, [100, 145], [0, 0.8], ease);
  const draw3 = interpolate(f, [16, 44], [0, 1], ease);
  const draw4 = interpolate(f, [26, 54], [0, 1], ease);
  const words = [
    { han: "買", py: "mǎi", gl: "to buy", tone: TONES[2], start: 0 },
    { han: "賣", py: "mài", gl: "to sell", tone: TONES[3], start: 8 },
  ];
  const lineA = clamp01(1 - (f - 92) / 10);
  return (
    <AbsoluteFill>
      <Iridescent dark />
      <AbsoluteFill style={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 240, paddingBottom: 170 }}>
        {words.map((w, i) => (
          <Pop key={w.han} start={w.start} style={{ textAlign: "center", color: C.cream }}>
            <div style={{ font: `600 230px/1 ${F.zh}` }}>{w.han}</div>
            <div style={{ font: `700 50px ${F.body}`, marginTop: 10 }}>{w.py}</div>
            <div style={{ font: `500 30px ${F.body}`, color: "#cfc7b8" }}>{w.gl}</div>
            <svg width={380} height={150} style={{ marginTop: 18, overflow: "visible" }}>
              <path d={tonePath(w.tone.f, flatten, 380, 150)} fill="none" stroke={w.tone.color} strokeWidth={13} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - (i ? draw4 : draw3)} />
            </svg>
          </Pop>
        ))}
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 190, textAlign: "center", color: C.cream }}>
        <div style={{ opacity: lineA, position: "absolute", left: 0, right: 0 }}>
          <Words text="Same sounds. One tone apart." start={30} stagger={3} style={{ justifyContent: "center", font: `800 62px ${F.display}` }} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0 }}>
          <Words text="Illness flattens pitch first." start={100} stagger={3} style={{ justifyContent: "center", font: `800 62px ${F.display}` }} highlight={{ flattens: C.marigold }} />
          <Words text="Now they sound almost the same." start={150} stagger={2} style={{ justifyContent: "center", font: `500 34px ${F.body}`, color: "#cfc7b8", marginTop: 14 }} />
        </div>
      </div>
      <div style={{ position: "absolute", right: 50, bottom: 34, font: `500 17px ${F.body}`, color: "#8a8277" }}>Tone shapes: illustration</div>
    </AbsoluteFill>
  );
};

/* ============================================================== 3. problem */
const Waveform: React.FC<{ src: string; start: number; color: string }> = ({ src, start, color }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audio = useAudioData(staticFile(src));
  const n = 56;
  // Low bins carry the voice; mirror them so the bars read as a waveform, loud in the middle.
  const half = audio && f >= start ? visualizeAudio({ fps, frame: f - start, audioData: audio, numberOfSamples: 64 }).slice(0, n / 2) : new Array(n / 2).fill(0);
  const vals = [...half.slice().reverse(), ...half];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, height: 110 }}>
      {vals.map((v, i) => (
        <div key={i} style={{ width: 8, borderRadius: 4, background: color, height: 8 + Math.min(1, Math.sqrt(v) * 2.4) * 100, opacity: 0.85 }} />
      ))}
    </div>
  );
};

export const Problem: React.FC<{ audioAt: number }> = ({ audioAt }) => {
  const f = useCurrentFrame();
  const typed = "接我到你那大点";
  const nType = Math.floor(interpolate(f, [205, 250], [0, typed.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const strike = interpolate(f, [258, 270], [0, 1], ease);
  return (
    <AbsoluteFill>
      <Iridescent />
      <AbsoluteFill style={{ padding: "110px 140px" }}>
        <Words text="After a stroke, Parkinson’s or mouth-cancer surgery, speech can become hard to understand." start={0} stagger={2} style={{ font: `900 64px/1.08 ${F.display}`, letterSpacing: "-0.02em", maxWidth: 1500 }} />
        <Words text="The person knows exactly what they mean. Speech recognition does not." start={30} stagger={2} style={{ font: `500 32px/1.4 ${F.body}`, color: C.inkSoft, marginTop: 22 }} />
        <div style={{ display: "flex", gap: 36, marginTop: 64 }}>
          <Pop start={audioAt - 12} style={{ flex: 1, background: "#fff", borderRadius: 28, padding: "30px 36px", boxShadow: "0 24px 60px rgba(20,17,15,.10)" }}>
            <div style={{ font: `700 18px ${F.body}`, letterSpacing: "0.14em", color: C.inkSoft }}>HE SAID</div>
            <div style={{ display: "flex", alignItems: "center", gap: 26, marginTop: 10 }}>
              <div style={{ width: 70, height: 70, borderRadius: "50%", background: C.cobalt, display: "grid", placeItems: "center" }}>
                <svg width={28} height={28} viewBox="0 0 24 24"><path d="M7 4 L20 12 L7 20 Z" fill="#fff" /></svg>
              </div>
              <Waveform src="audio/problem.wav" start={audioAt} color={C.cobalt} />
            </div>
            <div style={{ font: `600 54px ${F.zh}`, marginTop: 12 }}>給我聲音再大點</div>
            <div style={{ font: `500 26px ${F.body}`, color: C.inkSoft }}>“Turn the sound up for me.”</div>
          </Pop>
          <Pop start={192} style={{ flex: 1, background: "#fff", borderRadius: 28, padding: "30px 36px", boxShadow: "0 24px 60px rgba(20,17,15,.10)", border: `3px solid ${C.red}33` }}>
            <div style={{ font: `700 18px ${F.body}`, letterSpacing: "0.14em", color: C.red }}>STANDARD SPEECH RECOGNITION HEARD</div>
            <div style={{ position: "relative", font: `600 54px ${F.zh}`, marginTop: 96, color: C.red, display: "inline-block" }}>
              {typed.slice(0, nType)}<span style={{ opacity: f % 16 < 8 && nType < typed.length ? 1 : 0 }}>|</span>
              <div style={{ position: "absolute", left: 0, top: "52%", height: 5, background: C.red, width: `${strike * 100}%`, borderRadius: 3 }} />
            </div>
            <div style={{ font: `500 26px ${F.body}`, color: C.inkSoft, opacity: strike }}>“Pick me up at your place, big dot.”</div>
          </Pop>
        </div>
        <div style={{ font: `500 17px ${F.body}`, color: "#8a8277", marginTop: 20 }}>
          Real speaker with dysarthria (MDSC / AISHELL-6B, CC BY-NC 4.0). Stock Whisper-small output, unedited.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ===================================================== 4. logo + the answer */
export const LogoAnswer: React.FC = () => {
  const f = useCurrentFrame();
  const lift = interpolate(f, [52, 72], [0, -120], ease);
  return (
    <AbsoluteFill>
      <Iridescent />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `translateY(${lift}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <Logo size={150} start={2} />
          <Words text="Live captions for speech that is hard to understand." start={20} stagger={2} style={{ justifyContent: "center", font: `500 36px ${F.body}`, color: C.inkSoft }} />
        </div>
        <Pop start={62} style={{ position: "absolute", top: 640, background: "#fff", borderRadius: 28, padding: "26px 40px", boxShadow: "0 24px 60px rgba(20,17,15,.12)", border: `3px solid ${C.grass}55`, display: "flex", alignItems: "center", gap: 28 }}>
          <div>
            <div style={{ font: `700 18px ${F.body}`, letterSpacing: "0.14em", color: C.grass }}>OWNVOICE HEARD</div>
            <div style={{ font: `600 58px ${F.zh}`, marginTop: 6 }}>給我聲音再大一點</div>
            <div style={{ font: `500 22px ${F.body}`, color: C.inkSoft }}>Same meaning. One extra 一, no other changes.</div>
          </div>
          <Pop start={76}><div style={{ width: 76, height: 76, borderRadius: "50%", background: C.grass, display: "grid", placeItems: "center" }}>
            <svg width={40} height={40} viewBox="0 0 24 24"><path d="M4 12.5 L9.5 18 L20 6.5" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" /></svg></div></Pop>
        </Pop>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ===================================================== camera for footage */
type Key = { t: number; x: number; y: number; z: number };
// Interpolate a camera (focus point x,y in 1920x1080 footage px, zoom z) and
// clamp so the frame never shows past the footage edge.
const camera = (keys: Key[], t: number) => {
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i].t && t <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
  if (t < keys[0].t) b = a;
  if (t > keys[keys.length - 1].t) a = b;
  const k = a === b ? 0 : Easing.inOut(Easing.cubic)(clamp01((t - a.t) / (b.t - a.t)));
  const z = a.z + (b.z - a.z) * k, x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
  let tx = 960 - x * z, ty = 540 - y * z;
  tx = Math.min(0, Math.max(1920 - 1920 * z, tx));
  ty = Math.min(0, Math.max(1080 - 1080 * z, ty));
  return `translate(${tx}px, ${ty}px) scale(${z})`;
};

/* ============================================================== 5. website */
export const SITE_IN = 2.4, SITE_OUT = 27.5;
const siteKeys: Key[] = [
  { t: 2.4, x: 960, y: 540, z: 1 }, { t: 3.4, x: 760, y: 560, z: 1.18 }, { t: 4.3, x: 760, y: 560, z: 1.18 },
  { t: 5.6, x: 960, y: 540, z: 1 }, { t: 6.6, x: 520, y: 640, z: 1.45 }, { t: 9.8, x: 520, y: 660, z: 1.45 },
  { t: 11.2, x: 1340, y: 650, z: 1.42 }, { t: 18.2, x: 1340, y: 660, z: 1.42 }, { t: 19.2, x: 960, y: 540, z: 1.0 },
  { t: 22.6, x: 960, y: 540, z: 1.0 }, { t: 25.6, x: 960, y: 540, z: 1.0 }, { t: 26.4, x: 470, y: 690, z: 1.55 }, { t: 27.5, x: 470, y: 690, z: 1.6 },
];
const siteLabels = [
  { from: 3.0, to: 6.2, text: "The website: open a link, nothing to install" },
  { from: 6.8, to: 11.0, text: "Hear what dysarthria does to one sentence" },
  { from: 11.2, to: 18.4, text: "Ordinary recognition: 44% wrong · OwnVoice: 11% wrong" },
  { from: 19.2, to: 22.5, text: "The whole site in 中文 with one click" },
  { from: 23.4, to: 27.5, text: "One-click download for the Chrome extension" },
];

export const Site: React.FC = () => {
  const f = useCurrentFrame();
  const t = SITE_IN + f / 30;
  const enter = useIn(0, { damping: 18, stiffness: 90 });
  const label = siteLabels.find((l) => t >= l.from && t <= l.to);
  return (
    <AbsoluteFill>
      <Iridescent />
      <div style={{ position: "absolute", left: 160, top: 120, width: 1600, height: 900 + 44, borderRadius: 20, overflow: "hidden", background: "#fff",
        boxShadow: "0 40px 100px rgba(20,17,15,.28)", transform: `perspective(2000px) rotateX(${(1 - enter) * 14}deg) translateY(${(1 - enter) * 80}px)`, opacity: enter }}>
        <div style={{ height: 44, background: "#eceff1", display: "flex", alignItems: "center", gap: 8, padding: "0 16px" }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}
          <div style={{ marginLeft: 20, flex: 1, maxWidth: 560, height: 28, borderRadius: 14, background: "#fff", font: `500 15px ${F.body}`, color: "#3c4043", display: "flex", alignItems: "center", padding: "0 14px" }}>ownvoice.vercel.app</div>
        </div>
        <div style={{ width: 1600, height: 900, overflow: "hidden", position: "relative" }}>
          <div style={{ width: 1920, height: 1080, transformOrigin: "0 0", transform: `scale(${1600 / 1920}) ${camera(siteKeys, t)}` }}>
            <OffthreadVideo src={staticFile("footage/site.mp4")} trimBefore={Math.round(SITE_IN * 30)} muted style={{ width: 1920, height: 1080 }} />
          </div>
        </div>
      </div>
      {label && (
        <Sequence from={Math.round((label.from - SITE_IN) * 30)} layout="none">
          <Pop start={0} style={{ position: "absolute", left: 160, top: 46 }}><Chip>{label.text}</Chip></Pop>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

/* ============================================================== 6. install */
export const Install: React.FC = () => {
  const steps = [
    { n: "1", h: "Download", p: "One click on ownvoice.vercel.app, then unzip." },
    { n: "2", h: "Load it", p: "chrome://extensions → Load unpacked." },
    { n: "3", h: "Click the icon", p: "On any call or tab. Captions open beside it." },
  ];
  return (
    <AbsoluteFill>
      <Iridescent />
      <AbsoluteFill style={{ padding: "150px 160px" }}>
        <Words text="Install in a minute. No account. Nothing to buy." start={0} stagger={2} style={{ font: `900 62px ${F.display}`, letterSpacing: "-0.02em" }} />
        <div style={{ display: "flex", gap: 36, marginTop: 80 }}>
          {steps.map((st, i) => (
            <Pop key={st.n} start={10 + i * 7} style={{ flex: 1, background: "#fff", borderRadius: 28, padding: 40, boxShadow: "0 24px 60px rgba(20,17,15,.10)" }}>
              <div style={{ width: 70, height: 70, borderRadius: "50%", background: C.cobalt, color: "#fff", display: "grid", placeItems: "center", font: `800 34px ${F.display}` }}>{st.n}</div>
              <div style={{ font: `800 40px ${F.display}`, margin: "28px 0 10px" }}>{st.h}</div>
              <div style={{ font: `500 27px/1.4 ${F.body}`, color: C.inkSoft }}>{st.p}</div>
            </Pop>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ================================================================= 7. call */
const ev = (label: string) => (callMeta.events as any[]).find((e) => e.label === label || e.kind === label).t as number;
export const CALL = {
  aIn: Math.max(0, ev("toolbar-icon") - 1.6), aOut: ev("start") - 0.6, aRate: 2, // setup, at 2x
  bIn: ev("start") - 0.6, bOut: Math.max(...(callStock as any[]).map((r) => r.arrive)) + 3.0, // live, real time
  cIn: ev("lang-zh") - 1.4, cOut: (callMeta as any).duration - 0.2,                  // switch to 中文
};
export const callFrames = {
  a: Math.round(((CALL.aOut - CALL.aIn) / CALL.aRate) * 30),
  b: Math.round((CALL.bOut - CALL.bIn) * 30),
  c: Math.round((CALL.cOut - CALL.cIn) * 30),
};
// footage time -> call-scene frame (for audio and SFX placement)
export const callFrameOf = (t: number) =>
  t < CALL.aOut ? ((t - CALL.aIn) / CALL.aRate) * 30
  : t < CALL.bOut ? callFrames.a + (t - CALL.bIn) * 30
  : callFrames.a + callFrames.b + (t - CALL.cIn) * 30;

const callKeys: Key[] = (() => {
  const tb = ev("toolbar-icon"), st = ev("start"), zh = ev("lang-zh");
  return [
    { t: CALL.aIn, x: 960, y: 540, z: 1.0 }, { t: tb - 0.4, x: 1560, y: 200, z: 1.55 }, { t: tb + 0.8, x: 1640, y: 260, z: 1.55 },
    { t: st - 1.5, x: 1680, y: 300, z: 1.6 }, { t: st + 1.2, x: 1680, y: 300, z: 1.6 }, { t: st + 3.2, x: 1250, y: 520, z: 1.22 },
    { t: CALL.bOut, x: 1250, y: 520, z: 1.22 }, { t: zh - 0.9, x: 1700, y: 260, z: 1.5 }, { t: CALL.cOut, x: 1720, y: 240, z: 1.6 },
  ];
})();
const GLOSS = [
  "“Turn on the air conditioning.”",
  "“I need the temperature set to 25.”",
  "“Open the curtains.”",
  "“The volume’s too low for me.”",
  "“Turn the volume up a little for me.”",
];

const CallLayer: React.FC<{ tIn: number; rate?: number; badge: React.ReactNode }> = ({ tIn, rate = 1, badge }) => {
  const f = useCurrentFrame();
  const t = tIn + (f / 30) * rate;
  // Measured from the panel's own level meter (record_call2.mjs), not assumed.
  const audio0 = (callMeta as any).audioZero ?? ev("audio-start");
  const marks = callMeta.marks as number[][];
  const cur = marks.findIndex((m) => t >= audio0 + m[0] - 0.1 && t <= audio0 + m[1] + 1.2);
  // Comparison for the sentence whose OwnVoice caption has just landed in the panel.
  let cmp = -1;
  (callStock as any[]).forEach((r, i) => { if (t >= r.arrive + 0.15 && t <= r.arrive + 4.8) cmp = i; });
  return (
    <AbsoluteFill style={{ background: "#202124" }}>
      <div style={{ width: 1920, height: 1080, transformOrigin: "0 0", transform: camera(callKeys, t) }}>
        <OffthreadVideo src={staticFile("footage/call.mp4")} trimBefore={Math.round(tIn * 30)} playbackRate={rate} muted style={{ width: 1920, height: 1080 }} />
      </div>
      <div style={{ position: "absolute", left: 40, top: 36 }}>{badge}</div>
      {cur >= 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, display: "flex", justifyContent: "center" }}>
          <div style={{ background: "rgba(20,17,15,.78)", color: "#fff", borderRadius: 16, padding: "14px 28px", font: `600 34px ${F.body}`, maxWidth: 1300, textAlign: "center" }}>
            <span style={{ color: C.sky, font: `700 20px ${F.body}`, letterSpacing: "0.12em", marginRight: 16 }}>MR. LIN</span>{GLOSS[cur]}
          </div>
        </div>
      )}
      {cmp >= 0 && (() => {
        const r = (callStock as any[])[cmp];
        const norm = (x: string) => x.replace(/[\s,，。.!?、]/g, "");
        const stockOk = norm(r.stock) === norm(r.ref_tw) || r.stock_cer === 0;
        const oursOk = norm(r.live) === norm(r.ref_tw);
        return (
          <div style={{ position: "absolute", left: 40, top: 110, background: "rgba(255,255,255,.96)", borderRadius: 18, padding: "16px 22px", boxShadow: "0 16px 40px rgba(0,0,0,.3)", maxWidth: 820 }}>
            <div style={{ font: `700 16px ${F.body}`, letterSpacing: "0.12em", color: C.inkSoft }}>HE SAID</div>
            <div style={{ font: `600 30px ${F.zh}`, color: C.ink, marginTop: 2 }}>{r.ref_tw}</div>
            <div style={{ font: `700 16px ${F.body}`, letterSpacing: "0.12em", color: stockOk ? C.inkSoft : C.red, marginTop: 10 }}>STANDARD RECOGNITION, SAME AUDIO</div>
            <div style={{ font: `600 30px ${F.zh}`, color: stockOk ? C.ink : C.red, marginTop: 2 }}>{r.stock}{stockOk ? " ✓" : ""}</div>
            <div style={{ font: `700 16px ${F.body}`, letterSpacing: "0.12em", color: C.cobalt, marginTop: 10 }}>OWNVOICE, LIVE</div>
            <div style={{ font: `600 30px ${F.zh}`, color: C.ink, marginTop: 2 }}>{r.live}{oursOk ? <span style={{ color: C.grass }}> ✓</span> : ""}</div>
          </div>
        );
      })()}
      <div style={{ position: "absolute", left: 40, bottom: 18, font: `500 16px ${F.body}`, color: "rgba(255,255,255,.75)" }}>
        Real OwnVoice extension and model, recorded live on a laptop CPU. Voice: a real speaker with dysarthria (MDSC / AISHELL-6B, CC BY-NC 4.0), sentences selected from his recordings, fed in as the microphone.
      </div>
    </AbsoluteFill>
  );
};

export const Call: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={callFrames.a}>
      <CallLayer tIn={CALL.aIn} rate={CALL.aRate} badge={<Chip bg={C.tangerine}>2× speed · opening the extension</Chip>} />
    </Sequence>
    <Sequence from={callFrames.a} durationInFrames={callFrames.b}>
      <CallLayer tIn={CALL.bIn} badge={<Chip bg={C.cobalt}>● Live · real time</Chip>} />
    </Sequence>
    <Sequence from={callFrames.a + callFrames.b} durationInFrames={callFrames.c}>
      <CallLayer tIn={CALL.cIn} badge={<Chip>English or 中文, one click</Chip>} />
    </Sequence>
  </AbsoluteFill>
);

/* ============================================================== 8. results */
export const Results: React.FC = () => {
  const f = useCurrentFrame();
  const groups = [
    { l: "Mild", a: 16.1, b: 13.7, cut: "−15%" },
    { l: "Moderate", a: 20.7, b: 13.1, cut: "−37%" },
    { l: "Severe", a: 28.8, b: 16.8, cut: "−41%" },
  ];
  const H = 400;
  return (
    <AbsoluteFill>
      <Iridescent />
      <AbsoluteFill style={{ padding: "100px 140px" }}>
        <Words text="RESULTS ON SIMULATED DYSARTHRIA, 91 SPEAKERS" start={0} style={{ font: `700 24px ${F.body}`, letterSpacing: "0.2em", color: C.tangerine }} />
        <Words text="It helps most where speech is worst." start={4} stagger={3} style={{ font: `900 70px ${F.display}`, letterSpacing: "-0.02em", marginTop: 8 }} />
        <div style={{ display: "flex", marginTop: 40, gap: 120 }}>
          <div>
            <div style={{ display: "flex", gap: 26, font: `600 22px ${F.body}`, color: C.inkSoft, marginBottom: 90 }}>
              <span><i style={{ display: "inline-block", width: 20, height: 20, borderRadius: 5, background: "#b7aea1", marginRight: 8, verticalAlign: -3 }} />Standard Whisper</span>
              <span><i style={{ display: "inline-block", width: 20, height: 20, borderRadius: 5, background: C.cobalt, marginRight: 8, verticalAlign: -3 }} />OwnVoice</span>
              <span>Mistakes per 100 characters</span>
            </div>
            <div style={{ display: "flex", gap: 80, alignItems: "flex-end", height: H, borderBottom: `3px solid ${C.rule}` }}>
              {groups.map((g, i) => {
                const pa = interpolate(f, [18 + i * 8, 48 + i * 8], [0, 1], ease);
                const pb = interpolate(f, [26 + i * 8, 56 + i * 8], [0, 1], ease);
                return (
                  <div key={g.l} style={{ position: "relative", display: "flex", gap: 14, alignItems: "flex-end", height: H }}>
                    {[{ v: g.a, c: "#b7aea1", p: pa }, { v: g.b, c: C.cobalt, p: pb }].map((bar, j) => (
                      <div key={j} style={{ width: 110, height: (bar.v / 30) * H * bar.p, background: bar.c, borderRadius: "12px 12px 0 0", position: "relative" }}>
                        <div style={{ position: "absolute", top: -38, left: 0, right: 0, textAlign: "center", font: `700 26px ${F.body}`, opacity: bar.p }}>{bar.v}</div>
                      </div>
                    ))}
                    <Pop start={60 + i * 8} style={{ position: "absolute", left: "50%", top: H - (g.a / 30) * H - 110, transform: "translateX(-50%)" }}>
                      <div style={{ background: C.tangerine, color: "#fff", font: `800 32px ${F.display}`, padding: "8px 16px", borderRadius: 12, whiteSpace: "nowrap", marginLeft: -60 }}>{g.cut}</div>
                    </Pop>
                    <div style={{ position: "absolute", bottom: -50, left: 0, right: 0, textAlign: "center", font: `700 28px ${F.body}` }}>{g.l}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 44, paddingTop: 110 }}>
            <Pop start={90}><div style={{ font: `900 110px/1 ${F.display}`, color: C.cobalt }}>86.2%</div><div style={{ font: `500 30px ${F.body}`, color: C.inkSoft }}>of characters correct, up from 80.9%</div></Pop>
            <Pop start={110}><div style={{ font: `900 110px/1 ${F.display}`, color: C.tangerine }}>~3 s</div><div style={{ font: `500 30px ${F.body}`, color: C.inkSoft }}>from end of sentence to caption,<br />on an ordinary laptop CPU</div></Pop>
          </div>
        </div>
        {(mdsc as any).ready ? (() => {
          const all = (mdsc as any)["dysarthric (all)"];
          const pct = (x: number) => `${Math.round(x * 100)}%`;
          return (
            <Pop start={130} style={{ position: "absolute", left: 140, right: 140, bottom: 70, background: "#fff", borderRadius: 22, padding: "18px 28px", boxShadow: "0 18px 50px rgba(20,17,15,.10)", display: "flex", alignItems: "center", gap: 28 }}>
              <div style={{ font: `800 22px ${F.body}`, letterSpacing: "0.12em", color: C.grass, whiteSpace: "nowrap" }}>FIRST TEST ON REAL PATIENTS</div>
              <div style={{ font: `600 28px ${F.body}` }}>
                {all.speakers} speakers with dysarthria, {all.n} recordings: character errors {pct(all.stock_cer)} → <span style={{ color: C.cobalt }}>{pct(all.ours_cer)}</span> with OwnVoice
              </div>
            </Pop>
          );
        })() : null}
        <div style={{ position: "absolute", left: 140, bottom: 34, font: `500 17px ${F.body}`, color: "#8a8277" }}>
          {(mdsc as any).ready
            ? "Bars: fine-tuned Whisper-small on simulated dysarthria, unseen speakers. Real patients: MDSC / AISHELL-6B (CC BY-NC 4.0), 20 random sentences per speaker, no selection."
            : "Fine-tuned Whisper-small. Simulated dysarthria; test speakers never used in training. Testing with real patients is next."}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ============================================================== 9. privacy */
export const Privacy: React.FC = () => {
  const items = [
    { h: "Runs on your laptop", p: "No special microphone, no new hardware.", c: C.cobalt },
    { h: "Nothing uploaded", p: "Speech is transcribed on your machine and discarded.", c: C.tangerine },
    { h: "Free and open source", p: "Mandarin today. Taiwanese Hokkien and Cantonese next.", c: C.grass },
  ];
  return (
    <AbsoluteFill>
      <Iridescent />
      <AbsoluteFill style={{ padding: "200px 160px" }}>
        <Words text="Your voice stays yours." start={0} stagger={3} style={{ font: `900 84px ${F.display}`, letterSpacing: "-0.02em" }} highlight={{ yours: C.cobalt }} />
        <div style={{ display: "flex", gap: 40, marginTop: 90 }}>
          {items.map((it, i) => (
            <Pop key={it.h} start={12 + i * 7} style={{ flex: 1, borderTop: `7px solid ${it.c}`, paddingTop: 28 }}>
              <div style={{ font: `800 46px/1.1 ${F.display}` }}>{it.h}</div>
              <div style={{ font: `500 28px/1.4 ${F.body}`, color: C.inkSoft, marginTop: 14 }}>{it.p}</div>
            </Pop>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ================================================================= 10. end */
export const End: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Iridescent dark speed={1.4} />
      <div style={{ position: "absolute", right: -60, top: 120, opacity: 0.22 }}>
        <ToneStack flatten={(Math.sin(f / 30) * 0.5 + 0.5) * 0.85} draw={1} width={700} gap={120} stroke={12} />
      </div>
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30, textAlign: "center" }}>
        <Logo size={140} dark start={0} />
        <Words text="Be understood." start={18} stagger={4} style={{ justifyContent: "center", font: `700 52px ${F.body}`, color: C.cream }} />
        <Pop start={34}><div style={{ font: `800 58px ${F.display}`, color: C.marigold }}>ownvoice.vercel.app</div></Pop>
        <Pop start={42}><div style={{ font: `600 30px ${F.body}`, color: "#cfc7b8" }}>github.com/andrewshih0407/ownvoice</div></Pop>
        <Pop start={52}><div style={{ font: `500 28px/1.6 ${F.body}`, color: "#cfc7b8", marginTop: 20 }}>
          Andrew Shih · Alexander Du · Srihari Kumaresan · Luis Cruz Mondragon<br />2026 Presidential Hackathon · International Track</div></Pop>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 26, textAlign: "center", font: `500 15px ${F.body}`, color: "#8a8277" }}>
        Music: “Carefree” by Kevin MacLeod (incompetech.com), CC BY 4.0. Voices: Mozilla Common Voice (CC0).
      </div>
    </AbsoluteFill>
  );
};
