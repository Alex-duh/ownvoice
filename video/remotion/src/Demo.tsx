import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, interpolate } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { iris } from "@remotion/transitions/iris";
import { fade } from "@remotion/transitions/fade";
import { pushCut } from "@remotion/transitions/push-cut";
import { Intro, BuySell, Problem, LogoAnswer, Site, Install, Call, Results, Privacy, End, SITE_IN, SITE_OUT, callFrames, callFrameOf } from "./scenes";
import callMeta from "../public/footage/call.json";
import siteMeta from "../public/footage/site.json";

const T = 18; // transition length, frames
const PROBLEM_AUDIO_AT = 62;

const scenes = [
  { id: "intro", d: 165, el: <Intro /> },
  { id: "buysell", d: 210, el: <BuySell /> },
  { id: "problem", d: 300, el: <Problem audioAt={PROBLEM_AUDIO_AT} /> },
  { id: "logo", d: 150, el: <LogoAnswer /> },
  { id: "site", d: Math.round((SITE_OUT - SITE_IN) * 30), el: <Site /> },
  { id: "install", d: 105, el: <Install /> },
  { id: "call", d: callFrames.a + callFrames.b + callFrames.c, el: <Call /> },
  { id: "results", d: 270, el: <Results /> },
  { id: "privacy", d: 150, el: <Privacy /> },
  { id: "end", d: 210, el: <End /> },
];
const presentations = [
  wipe({ direction: "from-left" }),
  slide({ direction: "from-bottom" }),
  iris({ width: 1920, height: 1080 }),
  slide({ direction: "from-right" }),
  pushCut(),
  slide({ direction: "from-right" }),
  wipe({ direction: "from-top-left" }),
  slide({ direction: "from-bottom" }),
  fade(),
];

// Absolute start frame of each scene (transitions overlap neighbours by T).
export const starts = scenes.map((_, i) => scenes.slice(0, i).reduce((n, sc) => n + sc.d, 0) - i * T);
const at = (id: string) => starts[scenes.findIndex((sc) => sc.id === id)];
export const TOTAL = starts[starts.length - 1] + scenes[scenes.length - 1].d;

/* ------------------------------------------------------------- soundtrack */
type Cue = { at: number; src: string; vol?: number };
const sfx: Cue[] = [];
starts.slice(1).forEach((st, i) => sfx.push({ at: st - 6, src: i === 2 ? "sfx/whoosh.wav" : i % 2 ? "sfx/whoosh_soft.wav" : "sfx/whoosh.wav", vol: 0.55 }));
sfx.push({ at: at("logo") + 4, src: "sfx/chime.wav", vol: 0.5 });
sfx.push({ at: at("logo") + 76, src: "sfx/success.wav", vol: 0.55 });
sfx.push({ at: at("problem") + 192, src: "sfx/pop.wav", vol: 0.5 });
sfx.push({ at: at("problem") + 262, src: "sfx/whoosh_soft.wav", vol: 0.35 });
[18, 26, 34].forEach((d) => sfx.push({ at: at("install") + 10 + (d - 18) * 0.9, src: "sfx/pop.wav", vol: 0.45 }));
[0, 1, 2].forEach((i) => sfx.push({ at: at("results") + 60 + i * 8, src: "sfx/pop.wav", vol: 0.45 }));
[0, 1, 2].forEach((i) => sfx.push({ at: at("privacy") + 12 + i * 7, src: "sfx/pop.wav", vol: 0.45 }));
// Mouse clicks, at the moment they happen in the footage.
(siteMeta.events as any[]).filter((e) => e.kind === "click").forEach((e) => {
  if (e.t > SITE_IN && e.t < SITE_OUT) sfx.push({ at: at("site") + Math.round((e.t - SITE_IN) * 30), src: "sfx/click.wav", vol: 0.6 });
});
(callMeta.events as any[]).filter((e) => e.kind === "click").forEach((e) => {
  sfx.push({ at: at("call") + Math.round(callFrameOf(e.t)), src: "sfx/click.wav", vol: 0.6 });
});

const audioStart = (callMeta.events as any[]).find((e) => e.kind === "audio-start").t;
const siteAudio = (siteMeta.events as any[]).find((e) => e.label === "sample-zh-severe").t;
const voice = {
  problem: { at: at("problem") + PROBLEM_AUDIO_AT, len: Math.round(7.33 * 30) },
  site: { at: at("site") + Math.round((siteAudio - SITE_IN) * 30), len: Math.round(7.36 * 30) },
  // The fake microphone starts playing when capture opens, i.e. at Start.
  call: { at: at("call") + Math.round(callFrameOf(audioStart)) + 2, len: Math.round(35.8 * 30) },
};
// Speech windows the music ducks under.
const ducks: [number, number][] = [
  [voice.problem.at, voice.problem.at + voice.problem.len],
  [voice.site.at, voice.site.at + voice.site.len],
  ...(callMeta.marks as number[][]).map(([a, b]) => [voice.call.at + a * 30, voice.call.at + b * 30] as [number, number]),
];
const musicVol = (f: number) => {
  let duck = 0;
  for (const [a, b] of ducks) duck = Math.max(duck, interpolate(f, [a - 12, a, b, b + 15], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const fadeIn = interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(f, [TOTAL - 75, TOTAL - 5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return 0.42 * (1 - 0.78 * duck) * fadeIn * fadeOut;
};

export const Demo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <TransitionSeries>
      {scenes.map((sc, i) => (
        <React.Fragment key={sc.id}>
          <TransitionSeries.Sequence durationInFrames={sc.d}>{sc.el}</TransitionSeries.Sequence>
          {i < scenes.length - 1 && <TransitionSeries.Transition presentation={presentations[i] as any} timing={linearTiming({ durationInFrames: T })} />}
        </React.Fragment>
      ))}
    </TransitionSeries>

    <Audio src={staticFile("audio/carefree.wav")} volume={musicVol} />
    <Sequence from={voice.problem.at}><Audio src={staticFile("audio/problem.wav")} volume={1} /></Sequence>
    <Sequence from={voice.site.at} durationInFrames={Math.min(voice.site.len, at("install") - voice.site.at)}><Audio src={staticFile("audio/site-severe.wav")} volume={1} /></Sequence>
    <Sequence from={voice.call.at} durationInFrames={voice.call.len}><Audio src={staticFile("audio/call.wav")} volume={1} /></Sequence>
    {sfx.map((c, i) => (
      <Sequence key={i} from={Math.max(0, Math.round(c.at))} durationInFrames={60}><Audio src={staticFile(c.src)} volume={c.vol ?? 0.5} /></Sequence>
    ))}
  </AbsoluteFill>
);
