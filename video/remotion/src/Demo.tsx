import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, interpolate } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { fade } from "@remotion/transitions/fade";
import { MAI_CUES, PROBLEM_CUES, Intro, BuySell, Problem, LogoAnswer, Research, RESEARCH_FRAMES, researchFrameOf, researchEvent, Install, Call, Privacy, End, callFrames, callFrameOf } from "./scenes";
import callMeta from "../public/footage/call.json";
import researchMeta from "../public/footage/research.json";
import { AppScene, APP_SCENE_FRAMES, APP_AUDIO_AT, APP_MARKS, APP_TAP } from "./app";

const T = 22; // transition length, frames

const scenes = [
  { id: "intro", d: 126, el: <Intro /> },
  { id: "buysell", d: 210, el: <BuySell /> },
  { id: "problem", d: 345, el: <Problem /> },
  { id: "logo", d: 132, el: <LogoAnswer /> },
  { id: "site", d: RESEARCH_FRAMES, el: <Research /> },
  { id: "install", d: 96, el: <Install /> },
  { id: "call", d: callFrames.a + callFrames.b + callFrames.c, el: <Call /> },
  { id: "app", d: APP_SCENE_FRAMES, el: <AppScene /> },
  { id: "privacy", d: 138, el: <Privacy /> },
  { id: "end", d: 168, el: <End /> },
];
// Smooth: crossfades, plus two soft slides into the product footage.
const presentations = [fade(), fade(), fade(), slide({ direction: "from-bottom" }), fade(), slide({ direction: "from-right" }), slide({ direction: "from-right" }), fade(), fade()];
const isSlide = presentations.map((_, i) => i === 3 || i === 5 || i === 6);
const timings = presentations.map((_, i) => isSlide[i]
  ? springTiming({ config: { damping: 200 }, durationInFrames: T })
  : linearTiming({ durationInFrames: T }));

// Absolute start frame of each scene (transitions overlap neighbours by T).
export const starts = scenes.map((_, i) => scenes.slice(0, i).reduce((n, sc) => n + sc.d, 0) - i * T);
const at = (id: string) => starts[scenes.findIndex((sc) => sc.id === id)];
export const TOTAL = starts[starts.length - 1] + scenes[scenes.length - 1].d;

/* ------------------------------------------------------------- soundtrack */
type Cue = { at: number; src: string; vol?: number };
const sfx: Cue[] = [];
starts.slice(1).forEach((st, i) => sfx.push({ at: st - 4, src: isSlide[i] ? "sfx/whoosh.wav" : "sfx/whoosh_soft.wav", vol: isSlide[i] ? 0.5 : 0.28 }));
sfx.push({ at: at("logo") + 4, src: "sfx/chime.wav", vol: 0.5 });
sfx.push({ at: at("logo") + 76, src: "sfx/success.wav", vol: 0.55 });
sfx.push({ at: at("problem") + 250, src: "sfx/pop.wav", vol: 0.45 });
sfx.push({ at: at("problem") + 304, src: "sfx/whoosh_soft.wav", vol: 0.3 });
[18, 26, 34].forEach((d) => sfx.push({ at: at("install") + 10 + (d - 18) * 0.9, src: "sfx/pop.wav", vol: 0.45 }));
sfx.push({ at: at("app") + APP_TAP, src: "sfx/click.wav", vol: 0.6 });
[0, 1, 2].forEach((i) => sfx.push({ at: at("privacy") + 12 + i * 7, src: "sfx/pop.wav", vol: 0.45 }));
// Mouse clicks, at the moment they happen in the footage.
(researchMeta.events as any[]).filter((e) => e.kind === "click").forEach((e) => {
  sfx.push({ at: at("site") + Math.round(researchFrameOf(e.t)), src: "sfx/click.wav", vol: 0.6 });
});
(callMeta.events as any[]).filter((e) => e.kind === "click").forEach((e) => {
  sfx.push({ at: at("call") + Math.round(callFrameOf(e.t)), src: "sfx/click.wav", vol: 0.6 });
});

const audioStart = (callMeta as any).audioZero ?? (callMeta.events as any[]).find((e) => e.kind === "audio-start").t;
const voice = {
  healthy: { at: at("problem") + PROBLEM_CUES.healthy, len: Math.round(2.21 * 30) },
  problem: { at: at("problem") + PROBLEM_CUES.patient, len: Math.round(5.25 * 30) },
  site: { at: at("site") + Math.round(researchFrameOf(researchEvent("sample-zh-severe"))), len: Math.round(7.36 * 30) },
  sim: { at: at("site") + Math.round(researchFrameOf(researchEvent("simulated"))), len: Math.round(3.69 * 30) },
  // The fake microphone starts playing when capture opens, i.e. at Start.
  call: { at: at("call") + Math.round(callFrameOf(audioStart)), len: Math.round(33.5 * 30) },
  app: { at: at("app") + APP_AUDIO_AT, len: Math.round(8.7 * 30) },
};
// Speech windows the music ducks under.
const ducks: [number, number][] = [
  [at("buysell") + MAI_CUES.mai3, at("buysell") + MAI_CUES.mai4 + 12],
  [at("buysell") + MAI_CUES.mai3_sev, at("buysell") + MAI_CUES.mai4_sev + 18],
  [voice.healthy.at, voice.healthy.at + voice.healthy.len],
  [voice.problem.at, voice.problem.at + voice.problem.len],
  [voice.site.at, voice.site.at + voice.site.len],
  [voice.sim.at, voice.sim.at + voice.sim.len],
  ...APP_MARKS.map(([a, b]) => [at("app") + a, at("app") + b] as [number, number]),
  ...(callMeta.marks as number[][]).map(([a, b]) => [voice.call.at + a * 30, voice.call.at + b * 30] as [number, number]),
];
const musicVol = (f: number) => {
  let duck = 0;
  for (const [a, b] of ducks) duck = Math.max(duck, interpolate(f, [a - 12, a, b, b + 15], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const fadeIn = interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(f, [TOTAL - 75, TOTAL - 5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return 0.36 * (1 - 0.75 * duck) * fadeIn * fadeOut;
};

export const Demo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <TransitionSeries>
      {scenes.map((sc, i) => (
        <React.Fragment key={sc.id}>
          <TransitionSeries.Sequence durationInFrames={sc.d}>{sc.el}</TransitionSeries.Sequence>
          {i < scenes.length - 1 && <TransitionSeries.Transition presentation={presentations[i] as any} timing={timings[i]} />}
        </React.Fragment>
      ))}
    </TransitionSeries>

    <Audio src={staticFile("audio/music.wav")} volume={musicVol} />
    {(Object.entries(MAI_CUES) as [string, number][]).map(([k, f]) => (
      <Sequence key={k} from={at("buysell") + f} durationInFrames={30}><Audio src={staticFile(`audio/${k}.wav`)} volume={1} /></Sequence>
    ))}
    <Sequence from={voice.healthy.at}><Audio src={staticFile("audio/healthy.wav")} volume={1} /></Sequence>
    <Sequence from={voice.problem.at}><Audio src={staticFile("audio/problem.wav")} volume={1} /></Sequence>
    <Sequence from={voice.site.at} durationInFrames={voice.site.len}><Audio src={staticFile("audio/site-severe.wav")} volume={1} /></Sequence>
    <Sequence from={voice.sim.at} durationInFrames={voice.sim.len}><Audio src={staticFile("audio/sim.wav")} volume={1} /></Sequence>
    <Sequence from={voice.call.at} durationInFrames={Math.min(voice.call.len, at("app") + 10 - voice.call.at)}><Audio src={staticFile("audio/call.wav")} volume={1} /></Sequence>
    <Sequence from={voice.app.at} durationInFrames={voice.app.len}><Audio src={staticFile("audio/app.wav")} volume={1} /></Sequence>
    {sfx.map((c, i) => (
      <Sequence key={i} from={Math.max(0, Math.round(c.at))} durationInFrames={60}><Audio src={staticFile(c.src)} volume={c.vol ?? 0.5} /></Sequence>
    ))}
  </AbsoluteFill>
);
