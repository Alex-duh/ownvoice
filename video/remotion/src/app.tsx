import React from "react";
import { AbsoluteFill, interpolate, Easing, useCurrentFrame, useVideoConfig, staticFile, Img, OffthreadVideo } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { C, F } from "./theme";
import { Iridescent, Words, Pop } from "./components";
import appAudio from "../public/footage/app_audio.json";
import callStock from "../public/footage/call_stock.json";

/*
 * The OwnVoice phone app: a design (screens + motion), not yet a build.
 * The same components render the video scene (AppScene) and the still
 * screenshots used in the deck, the website and app/ (AppStills).
 */

const ease = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const, easing: Easing.inOut(Easing.cubic) };
const W = 410, H = 880; // phone screen, CSS px

/* ------------------------------------------------------------------ icons */
const Mic: React.FC<{ s?: number; c?: string }> = ({ s = 34, c = "#fff" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24"><rect x="8.5" y="3" width="7" height="12" rx="3.5" fill={c} /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" /></svg>
);
const Expand: React.FC<{ c?: string }> = ({ c = C.ink }) => (
  <svg width={24} height={24} viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke={c} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const SpeakerIc: React.FC<{ c?: string }> = ({ c = C.ink }) => (
  <svg width={24} height={24} viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill={c} /><path d="M16 8.5a5 5 0 0 1 0 7" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" /></svg>
);

/* ----------------------------------------------------------------- frame */
export const Phone: React.FC<{ children: React.ReactNode; scale?: number; style?: React.CSSProperties; dark?: boolean }> = ({ children, scale = 1, style, dark }) => (
  <div style={{ width: W + 28, height: H + 28, borderRadius: 68, background: "#111", padding: 14, transform: `scale(${scale})`,
    boxShadow: "0 50px 120px rgba(20,17,15,.35), inset 0 0 0 2px #3a3a3a", ...style }}>
    <div style={{ width: W, height: H, borderRadius: 54, overflow: "hidden", position: "relative", background: C.cream, color: dark ? C.cream : C.ink }}>
      {children}
      {/* status bar + island */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 34px", font: `600 17px ${F.body}`, color: "inherit", pointerEvents: "none" }}>
        <span>9:41</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <svg width={18} height={12} viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" /><rect x="5" y="5" width="3" height="7" rx="1" fill="currentColor" /><rect x="10" y="2" width="3" height="10" rx="1" fill="currentColor" /><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" /></svg>
          <svg width={26} height={12} viewBox="0 0 26 12"><rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="currentColor" fill="none" opacity=".5" /><rect x="2" y="2" width="17" height="8" rx="2" fill="currentColor" /></svg>
        </span>
      </div>
      <div style={{ position: "absolute", top: 11, left: "50%", marginLeft: -62, width: 124, height: 36, borderRadius: 20, background: "#000" }} />
      <div style={{ position: "absolute", bottom: 8, left: "50%", marginLeft: -70, width: 140, height: 5, borderRadius: 3, background: "currentColor", opacity: 0.35 }} />
    </div>
  </div>
);

/* ----------------------------------------------------------- talk screen */
export type Msg = { zh: string; en: string; age: number }; // age: frames since it landed (for the entry animation)

const Header: React.FC<{ tab: number }> = ({ tab }) => (
  <>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "62px 22px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Img src={staticFile("ov-icon.png")} style={{ width: 34, height: 34 }} />
        <div style={{ font: `900 24px ${F.display}`, letterSpacing: "-0.03em" }}>Own<span style={{ color: C.cobalt }}>Voice</span></div>
      </div>
      <div style={{ display: "flex", border: `1.5px solid ${C.rule}`, borderRadius: 999, background: "#fff", font: `700 14px ${F.body}`, overflow: "hidden" }}>
        <span style={{ padding: "5px 11px", background: C.ink, color: C.cream }}>中文</span><span style={{ padding: "5px 11px" }}>EN</span>
      </div>
    </div>
    <div style={{ margin: "16px 22px 0", display: "flex", background: C.cream2, borderRadius: 14, padding: 4, font: `700 15px ${F.body}` }}>
      {["Talk", "Show", "History"].map((t, i) => (
        <div key={t} style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 11, background: i === tab ? "#fff" : "transparent", color: i === tab ? C.ink : C.inkSoft, boxShadow: i === tab ? "0 2px 8px rgba(20,17,15,.08)" : "none" }}>{t}</div>
      ))}
    </div>
  </>
);

export const TalkScreen: React.FC<{ msgs: Msg[]; listening: number; levels: number[]; pressShow?: number }> = ({ msgs, listening, levels, pressShow = 0 }) => {
  const shown = msgs.slice(-3);
  return (
    <div style={{ position: "absolute", inset: 0, color: C.ink }}>
      <Header tab={0} />
      <div style={{ margin: "14px 22px 0", display: "flex", alignItems: "center", gap: 8, font: `600 13px ${F.body}`, color: C.inkSoft }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: C.grass }} />
        Mandarin · dysarthria model
      </div>
      {/* captions, newest at the bottom */}
      <div style={{ position: "absolute", left: 18, right: 18, top: 210, bottom: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 12 }}>
        {shown.length === 0 && listening < 0.05 && (
          <div style={{ textAlign: "center", color: C.inkSoft, font: `500 18px/1.5 ${F.body}`, marginBottom: 120 }}>Tap the microphone and speak.<br />Your words appear here.</div>
        )}
        {shown.map((m, i) => {
          const latest = i === shown.length - 1;
          const p = interpolate(m.age, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
          return (
            <div key={m.zh + i} style={{ background: latest ? "#fff" : "rgba(255,255,255,.55)", borderRadius: 22, padding: latest ? "18px 20px" : "12px 18px",
              boxShadow: latest ? "0 10px 30px rgba(20,17,15,.10)" : "none", border: latest ? `2px solid ${C.cobalt}33` : "none",
              opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
              <div style={{ font: `600 ${latest ? 44 : 26}px/1.2 ${F.zh}` }}>{m.zh}</div>
              <div style={{ font: `500 ${latest ? 18 : 15}px ${F.body}`, color: C.inkSoft, marginTop: 4 }}>{m.en}</div>
            </div>
          );
        })}
        {listening > 0.05 && (
          <div style={{ opacity: listening, display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderRadius: 18, background: "rgba(62,107,224,.08)" }}>
            <div style={{ font: `700 14px ${F.body}`, color: C.cobalt, letterSpacing: "0.08em" }}>LISTENING</div>
            <div style={{ display: "flex", alignItems: "center", gap: 3, height: 30, flex: 1 }}>
              {levels.map((v, i) => <div key={i} style={{ flex: 1, borderRadius: 2, background: C.cobalt, height: 4 + Math.min(1, v) * 26, opacity: 0.85 }} />)}
            </div>
          </div>
        )}
      </div>
      {/* controls */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 48, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 30px" }}>
        <div style={{ textAlign: "center", font: `600 13px ${F.body}`, color: C.inkSoft }}>
          <div style={{ width: 58, height: 58, borderRadius: 29, background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 4px 14px rgba(20,17,15,.08)", transform: `scale(${1 - pressShow * 0.12})`, outline: pressShow > 0 ? `${pressShow * 6}px solid ${C.marigold}66` : "none" }}><Expand /></div>
          <div style={{ marginTop: 6 }}>Show</div>
        </div>
        <div style={{ position: "relative", width: 104, height: 104 }}>
          <div style={{ position: "absolute", inset: -14 - listening * 10, borderRadius: "50%", background: C.cobalt, opacity: 0.12 + listening * 0.1 }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: C.cobalt, display: "grid", placeItems: "center", boxShadow: "0 12px 30px rgba(62,107,224,.45)" }}><Mic s={44} /></div>
        </div>
        <div style={{ textAlign: "center", font: `600 13px ${F.body}`, color: C.inkSoft }}>
          <div style={{ width: 58, height: 58, borderRadius: 29, background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 4px 14px rgba(20,17,15,.08)" }}><SpeakerIc /></div>
          <div style={{ marginTop: 6 }}>Read aloud</div>
        </div>
      </div>
    </div>
  );
};

/* ----------------------------------------------------------- show screen */
// Big text for the person across the desk or counter.
export const ShowScreen: React.FC<{ zh: string; en: string; p?: number }> = ({ zh, en, p = 1 }) => (
  <div style={{ position: "absolute", inset: 0, background: C.ink, color: C.cream, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 30px", opacity: p }}>
    <div style={{ font: `700 15px ${F.body}`, letterSpacing: "0.16em", color: C.sky }}>MR. LIN SAYS</div>
    <div style={{ font: `700 84px/1.1 ${F.zh}`, whiteSpace: "nowrap", color: C.marigold, marginTop: 14, transform: `scale(${0.9 + 0.1 * p})`, transformOrigin: "0 50%" }}>{zh}</div>
    <div style={{ font: `600 28px/1.3 ${F.body}`, marginTop: 18 }}>{en}</div>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, textAlign: "center", font: `500 15px ${F.body}`, color: "#8a8277" }}>Tap anywhere to go back</div>
  </div>
);

/* ------------------------------------------------------- privacy screen */
const Toggle: React.FC<{ on: boolean }> = ({ on }) => (
  <div style={{ width: 50, height: 30, borderRadius: 15, background: on ? C.grass : "#d6cfc3", position: "relative", flex: "0 0 auto" }}>
    <div style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 24, height: 24, borderRadius: 12, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
  </div>
);
export const PrivacyScreen: React.FC = () => {
  const rows = [
    { h: "Delete audio after captioning", p: "Your voice is never saved.", on: true },
    { h: "Keep history on this phone only", p: "Nothing is synced to a server.", on: true },
    { h: "Help improve OwnVoice", p: "Share recordings for research. Only with your written consent; off by default.", on: false },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, color: C.ink }}>
      <div style={{ padding: "70px 24px 0" }}>
        <div style={{ font: `600 15px ${F.body}`, color: C.cobalt }}>‹ Settings</div>
        <div style={{ font: `900 38px ${F.display}`, letterSpacing: "-0.02em", marginTop: 10 }}>Privacy</div>
        <div style={{ font: `500 16px/1.45 ${F.body}`, color: C.inkSoft, marginTop: 6 }}>You decide what happens to your voice.</div>
      </div>
      <div style={{ margin: "22px 18px 0", background: "#fff", borderRadius: 22, overflow: "hidden" }}>
        {rows.map((r, i) => (
          <div key={r.h} style={{ display: "flex", gap: 14, alignItems: "center", padding: "18px 18px", borderTop: i ? `1px solid ${C.rule}` : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: `700 17px ${F.body}` }}>{r.h}</div>
              <div style={{ font: `500 14px/1.4 ${F.body}`, color: C.inkSoft, marginTop: 2 }}>{r.p}</div>
            </div>
            <Toggle on={r.on} />
          </div>
        ))}
      </div>
      <div style={{ margin: "18px 18px 0", background: "#fff", borderRadius: 22, padding: "18px 18px" }}>
        <div style={{ font: `700 13px ${F.body}`, letterSpacing: "0.12em", color: C.inkSoft }}>SPEECH MODEL</div>
        <div style={{ font: `700 17px ${F.body}`, marginTop: 6 }}>Mandarin · tuned for dysarthria</div>
        <div style={{ font: `500 14px/1.4 ${F.body}`, color: C.inkSoft, marginTop: 2 }}>Trained only on openly licensed recordings.</div>
      </div>
      <div style={{ margin: "18px 18px 0", background: "#fff", borderRadius: 22, padding: "18px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ font: `700 17px ${F.body}` }}>Language</div><div style={{ font: `500 14px ${F.body}`, color: C.inkSoft }}>繁體中文 · English</div></div>
        <div style={{ font: `600 15px ${F.body}`, color: C.cobalt }}>Change</div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------- welcome screen */
export const WelcomeScreen: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, color: C.ink }}>
    <Iridescent />
    <div style={{ position: "absolute", inset: 0, padding: "150px 30px 0", display: "flex", flexDirection: "column" }}>
      <Img src={staticFile("ov-icon.png")} style={{ width: 84, height: 84 }} />
      <div style={{ font: `900 54px/1.02 ${F.display}`, letterSpacing: "-0.03em", marginTop: 26 }}>Speak.<br />We'll write it<br /><span style={{ color: C.cobalt }}>down.</span></div>
      <div style={{ font: `500 19px/1.5 ${F.body}`, color: C.inkSoft, marginTop: 18 }}>Live captions for speech that is hard to understand. Made for Mandarin, after a stroke, surgery or Parkinson's.</div>
      <div style={{ marginTop: "auto", marginBottom: 70 }}>
        <div style={{ background: C.ink, color: C.cream, textAlign: "center", padding: "18px 0", borderRadius: 18, font: `700 19px ${F.body}` }}>Get started</div>
        <div style={{ textAlign: "center", font: `500 14px ${F.body}`, color: C.inkSoft, marginTop: 14 }}>No account needed · 中文 / English</div>
      </div>
    </div>
  </div>
);

/* ============================================================ video scene */
// Two real clips of speaker DM0005 (MDSC). Captions are our model's output on
// these exact recordings (video/scan_speaker.py), shown with translations.
export const APP_SENTENCES = [
  { zh: "關閉空調", en: "“Turn off the air conditioning.”", stock: "1,B,COME TO", stockEn: "(not even Chinese)" },
  { zh: "音量加大", en: "“Turn the volume up.”", stock: "永遠絕大", stockEn: "“Forever, absolutely big.”" },
];
export const APP_AUDIO_AT = 40;           // scene frame the soundtrack starts
const LAND_AFTER = 30;                     // frames from end of speech to caption
const marks = (appAudio.marks as number[][]).map(([a, b]) => [APP_AUDIO_AT + a * 30, APP_AUDIO_AT + b * 30]);
export const APP_MARKS = marks;
const lands = marks.map(([, b]) => Math.round(b + LAND_AFTER));
const SHOW_TAP = lands[1] + 50, SBS = SHOW_TAP + 95;
export const APP_SCENE_FRAMES = SBS + 140;
export const APP_TAP = SHOW_TAP;

const useLevels = (src: string, start: number, n = 22) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audio = useAudioData(staticFile(src));
  if (!audio || f < start) return new Array(n).fill(0);
  const v = visualizeAudio({ fps, frame: f - start, audioData: audio, numberOfSamples: 64 }).slice(0, n / 2);
  return [...v.slice().reverse(), ...v].map((x) => Math.sqrt(x) * 2.2);
};

export const AppScene: React.FC = () => {
  const f = useCurrentFrame();
  const levels = useLevels("audio/app.wav", APP_AUDIO_AT);
  const listening = Math.max(0, ...marks.map(([a, b]) => interpolate(f, [a - 6, a + 4, b + 6, b + 20], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const msgs: Msg[] = APP_SENTENCES.map((s, i) => ({ zh: s.zh, en: s.en, age: f - lands[i] })).filter((m) => m.age >= 0);
  const enter = interpolate(f, [0, 28], [0, 1], { ...ease, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const press = interpolate(f, [SHOW_TAP - 4, SHOW_TAP, SHOW_TAP + 8], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const showP = interpolate(f, [SHOW_TAP + 4, SHOW_TAP + 18, SBS + 6, SBS + 20], [0, 1, 1, 0], ease);
  const turn = interpolate(f, [SHOW_TAP + 4, SHOW_TAP + 30], [0, 1], ease);
  const sbs = interpolate(f, [SBS, SBS + 30], [0, 1], { ...ease, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  // Which sentence's comparison card is up.
  const cmp = lands.findIndex((l, i) => f >= l + 4 && f < (lands[i + 1] ?? SHOW_TAP) - 2);
  const latest = APP_SENTENCES[1];
  // phone: right of centre, then (show) scales up, then (side by side) moves right and shrinks
  const phoneX = interpolate(sbs, [0, 1], [1290, 1440]);
  const phoneScale = (0.98 + turn * 0.06 * (1 - sbs)) * interpolate(sbs, [0, 1], [1, 0.76]);
  const phoneY = interpolate(sbs, [0, 1], [540, 585]);
  // The laptop shows the real call footage, at a moment when the panel holds captions.
  const lastArrive = Math.max(...(callStock as any[]).map((r) => r.arrive));
  return (
    <AbsoluteFill>
      <Iridescent />
      {/* left column: story + comparison (fades away for the side-by-side) */}
      <div style={{ position: "absolute", left: 140, top: 150, width: 760, opacity: 1 - sbs }}>
        <Words text="THE OWNVOICE APP · COMING SOON" start={6} stagger={2} style={{ font: `700 22px ${F.body}`, letterSpacing: "0.2em", color: C.tangerine }} />
        <div style={{ position: "relative", height: 180, marginTop: 10 }}>
          <div style={{ position: "absolute", opacity: 1 - turn }}>
            <Words text="Back at work, his captions are in his pocket." start={12} stagger={3} style={{ font: `900 66px/1.05 ${F.display}`, letterSpacing: "-0.02em" }} highlight={{ pocket: C.cobalt }} />
          </div>
          <div style={{ position: "absolute", opacity: turn }}>
            {turn > 0 && <Words text="One tap, and his coworker reads it." start={SHOW_TAP + 6} stagger={3} style={{ font: `900 66px/1.05 ${F.display}`, letterSpacing: "-0.02em" }} highlight={{ reads: C.cobalt }} />}
          </div>
        </div>
        {cmp >= 0 && f < SHOW_TAP && (() => {
          const s = APP_SENTENCES[cmp];
          return (
            <Pop key={cmp} start={lands[cmp] + 4} style={{ marginTop: 40, background: "#fff", borderRadius: 24, padding: "22px 28px", boxShadow: "0 24px 60px rgba(20,17,15,.10)", width: 620 }}>
              <div style={{ font: `700 16px ${F.body}`, letterSpacing: "0.12em", color: C.red }}>STANDARD RECOGNITION, SAME AUDIO</div>
              <div style={{ font: `600 36px ${F.zh}`, color: C.red, marginTop: 4 }}>{s.stock}</div>
              <div style={{ font: `500 20px ${F.body}`, color: C.inkSoft, fontStyle: "italic" }}>{s.stockEn}</div>
              <div style={{ font: `700 16px ${F.body}`, letterSpacing: "0.12em", color: C.cobalt, marginTop: 16 }}>OWNVOICE</div>
              <div style={{ font: `600 36px ${F.zh}`, marginTop: 4 }}>{s.zh}<span style={{ color: C.grass }}> ✓</span></div>
              <div style={{ font: `500 20px ${F.body}`, color: C.inkSoft, fontStyle: "italic" }}>{s.en}</div>
            </Pop>
          );
        })()}
      </div>

      {/* side by side: laptop with the extension + the phone */}
      {sbs > 0 && (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 78, textAlign: "center", opacity: sbs }}>
            <Words text="Calls on the laptop. Everywhere else on the phone." start={SBS + 4} stagger={2} style={{ justifyContent: "center", font: `900 58px ${F.display}`, letterSpacing: "-0.02em" }} highlight={{ laptop: C.cobalt, phone: C.cobalt }} />
          </div>
          <div style={{ position: "absolute", left: 120, top: 250, opacity: sbs, transform: `translateX(${(1 - sbs) * -120}px)` }}>
            <div style={{ width: 1060, height: 596 + 34, background: "#1d1d1f", borderRadius: "22px 22px 6px 6px", padding: "17px 17px 17px" }}>
              <div style={{ width: 1026, height: 577, overflow: "hidden", borderRadius: 6, position: "relative" }}>
                <div style={{ width: 1920, height: 1080, transform: `scale(${1026 / 1920})`, transformOrigin: "0 0" }}>
                  <OffthreadVideo src={staticFile("footage/call.mp4")} trimBefore={Math.round((lastArrive + 1.5) * 30)} muted style={{ width: 1920, height: 1080 }} />
                </div>
              </div>
            </div>
            <div style={{ width: 1180, height: 26, marginLeft: -60, background: "linear-gradient(#cfcfd3,#a9a9ae)", borderRadius: "0 0 18px 18px" }} />
            <div style={{ textAlign: "center", font: `700 24px ${F.body}`, marginTop: 22 }}>Chrome extension · available now</div>
          </div>
          <div style={{ position: "absolute", left: 1210, top: 927, width: 460, textAlign: "center", font: `700 24px ${F.body}`, opacity: sbs }}>App · coming to iPhone and Android</div>
        </>
      )}

      {/* the phone */}
      <div style={{ position: "absolute", left: phoneX, top: phoneY, transform: `translate(-50%, -50%) translateY(${(1 - enter) * 160}px) rotate(${turn * -3 * (1 - sbs)}deg)`, opacity: enter }}>
        <Phone scale={phoneScale} dark={showP > 0.5}>
          <TalkScreen msgs={msgs} listening={listening} levels={levels} pressShow={press} />
          {showP > 0 && <ShowScreen zh={latest.zh} en={latest.en} p={showP} />}
        </Phone>
      </div>

      <div style={{ position: "absolute", left: 140, bottom: 30, font: `500 16px ${F.body}`, color: "#8a8277", opacity: 1 - sbs }}>
        App design. Captions are OwnVoice's real output on these recordings (real speaker with dysarthria, MDSC / AISHELL-6B, CC BY-NC 4.0).
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================ stills */
// 1920x1080: the four screens side by side, for the deck, site and app/.
export const AppStills: React.FC = () => {
  const msgs: Msg[] = [
    { zh: "幫我關閉屏幕", en: "“Turn off the screen for me.”", age: 99 },
    { zh: "關閉空調", en: "“Turn off the air conditioning.”", age: 99 },
    { zh: "音量加大", en: "“Turn the volume up.”", age: 99 },
  ];
  return (
    <AbsoluteFill>
      <Iridescent />
      <AbsoluteFill style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 36 }}>
        {[<WelcomeScreen />, <TalkScreen msgs={msgs} listening={0} levels={[]} />, <ShowScreen zh="音量加大" en="“Turn the volume up.”" />, <PrivacyScreen />].map((el, i) => (
          <Phone key={i} scale={0.88} style={{ margin: "0 -26px" }} dark={i === 2}>{el}</Phone>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// One screen per still (index chosen by props), on a transparent background.
export const AppScreen: React.FC<{ which: number }> = ({ which }) => {
  const msgs: Msg[] = [
    { zh: "幫我關閉屏幕", en: "“Turn off the screen for me.”", age: 99 },
    { zh: "關閉空調", en: "“Turn off the air conditioning.”", age: 99 },
    { zh: "音量加大", en: "“Turn the volume up.”", age: 99 },
  ];
  const el = [<WelcomeScreen />, <TalkScreen msgs={msgs} listening={0} levels={[]} />, <ShowScreen zh="音量加大" en="“Turn the volume up.”" />, <PrivacyScreen />][which];
  return <AbsoluteFill style={{ display: "grid", placeItems: "center" }}><Phone dark={which === 2}>{el}</Phone></AbsoluteFill>;
};

