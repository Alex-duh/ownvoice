import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing, Img, staticFile } from "remotion";
import { C, F } from "./theme";

/* ------------------------------------------------------------------ backdrop */

// The product site's iridescent hero (site/src/three/GradientPlane.tsx) rebuilt
// as drifting blurred blobs: same pastel mix over cream, no WebGL needed.
export const Iridescent: React.FC<{ dark?: boolean; speed?: number }> = ({ dark, speed = 1 }) => {
  const f = useCurrentFrame() * speed;
  const blobs = [
    { c: C.sky, x: 22, y: 30, r: 46, a: 0.9, sx: 0.011, sy: 0.007 },
    { c: C.violet, x: 70, y: 25, r: 40, a: 0.55, sx: 0.008, sy: 0.012 },
    { c: C.pink, x: 78, y: 72, r: 44, a: 0.55, sx: 0.01, sy: 0.009 },
    { c: C.cobalt, x: 30, y: 78, r: 36, a: 0.35, sx: 0.013, sy: 0.006 },
    { c: C.marigold, x: 52, y: 52, r: 26, a: 0.25, sx: 0.009, sy: 0.014 },
  ];
  return (
    <AbsoluteFill style={{ background: dark ? C.ink : C.cream, overflow: "hidden" }}>
      {blobs.map((b, i) => {
        const x = b.x + Math.sin(f * b.sx + i) * 9;
        const y = b.y + Math.cos(f * b.sy + i * 1.7) * 8;
        return (
          <div key={i} style={{
            position: "absolute", left: `${x}%`, top: `${y}%`, width: `${b.r}vw`, height: `${b.r}vw`,
            transform: "translate(-50%,-50%)", borderRadius: "50%", background: b.c,
            opacity: dark ? b.a * 0.45 : b.a * 0.6, filter: "blur(110px)",
          }} />
        );
      })}
      {/* vignette back toward the base colour, as in the original shader */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, transparent 35%, ${dark ? C.ink : C.cream} 100%)`, opacity: 0.6 }} />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- tone curves */

// site/src/three/ToneContour.tsx: tones 1-4 as pitch shapes, t in [0,1] -> [-1,1].
export const TONES = [
  { f: () => 0.75, color: C.cobalt },
  { f: (t: number) => -0.45 + 1.25 * t * t, color: C.grass },
  { f: (t: number) => 0.1 - 1.5 * Math.sin(Math.PI * Math.min(t * 1.15, 1)) * (1 - t * 0.35), color: C.marigold },
  { f: (t: number) => 0.85 - 1.7 * t, color: C.tangerine },
];

export const tonePath = (fn: (t: number) => number, flatten: number, w: number, h: number) => {
  const pts: number[][] = [];
  for (let i = 0; i <= 64; i++) pts.push([i / 64, fn(i / 64)]);
  const mean = pts.reduce((n, p) => n + p[1], 0) / pts.length;
  return pts.map(([t, y], i) => `${i ? "L" : "M"}${(t * w).toFixed(1)},${(h / 2 - (mean + (y - mean) * (1 - flatten)) * h * 0.42).toFixed(1)}`).join(" ");
};

export const ToneStack: React.FC<{ flatten: number; draw: number; width?: number; gap?: number; stroke?: number }> = ({ flatten, draw, width = 620, gap = 92, stroke = 9 }) => (
  <svg width={width + 40} height={gap * 4 + 40} viewBox={`-20 -20 ${width + 40} ${gap * 4 + 40}`} style={{ overflow: "visible" }}>
    {TONES.map((tone, i) => (
      <g key={i} transform={`translate(0, ${i * gap})`}>
        <path d={tonePath(tone.f, flatten, width, gap * 1.2)} fill="none" stroke={tone.color} strokeOpacity={0.18} strokeWidth={stroke * 2.6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        <path d={tonePath(tone.f, flatten, width, gap * 1.2)} fill="none" stroke={tone.color} strokeWidth={stroke} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      </g>
    ))}
  </svg>
);

/* ------------------------------------------------------------ kinetic text */

// Each word rises into place from behind its own line (a mask reveal), eased
// out with no overshoot and no blur.
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const Words: React.FC<{ text: string; start?: number; stagger?: number; style?: React.CSSProperties; color?: string; highlight?: Record<string, string> }> = ({ text, start = 0, stagger = 3, style, highlight = {} }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0 0.28em", ...style }}>
      {words.map((w, i) => {
        const p = interpolate(frame - start - i * stagger, [0, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut });
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.08em", marginBottom: "-0.08em" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 105}%)`, opacity: Math.min(1, p * 1.6), color: highlight[w.replace(/[.,]/g, "")] ?? undefined }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};

export const useIn = (start: number, cfg = { damping: 16, stiffness: 120 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - start, fps, config: cfg });
};

// Cards glide up and settle; eased, no bounce.
export const Pop: React.FC<{ start: number; children: React.ReactNode; style?: React.CSSProperties; from?: number }> = ({ start, children, style, from = 0.96 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - start, [0, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut });
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 36}px) scale(${from + (1 - from) * p})`, ...style }}>{children}</div>;
};

/* -------------------------------------------------------------------- logo */

export const Logo: React.FC<{ size?: number; dark?: boolean; start?: number }> = ({ size = 150, dark, start = 0 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - start, [0, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut });
  const letters = "OwnVoice".split("");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.22 }}>
      <Img src={staticFile("ov-icon.png")} style={{ width: size * 0.95, height: size * 0.95, transform: `scale(${0.6 + 0.4 * p})`, opacity: p }} />
      <div style={{ font: `900 ${size}px ${F.display}`, letterSpacing: "-0.04em", color: dark ? C.cream : C.ink, display: "flex" }}>
        {letters.map((ch, i) => {
          const q = interpolate(frame - start - 6 - i * 2, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
          return <span key={i} style={{ display: "inline-block", opacity: q, transform: `translateY(${(1 - q) * 40}px)`, color: i >= 3 ? C.cobalt : undefined }}>{ch}</span>;
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ badges */

export const Chip: React.FC<{ children: React.ReactNode; color?: string; bg?: string; style?: React.CSSProperties }> = ({ children, color = "#fff", bg = C.ink, style }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 18px", borderRadius: 999, background: bg, color, font: `700 22px ${F.body}`, boxShadow: "0 10px 30px rgba(20,17,15,.18)", ...style }}>{children}</div>
);

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
