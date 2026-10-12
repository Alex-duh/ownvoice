import { useState } from "react";

/**
 * The demo that works for EVERY visitor, with no backend at all.
 *
 * Why this exists: the Demo section used to hide itself entirely when no model
 * server was reachable, which is the case for every public visitor — the site
 * is a static Space and the API is not hosted. So the strongest evidence in the
 * project was invisible to exactly the people it needed to convince.
 *
 * Everything here is static: the severity clips are pre-rendered by the same
 * simulator code at the same seed, and the two transcripts are the recorded
 * result of running both models on the severe clip. No inference happens.
 * Numbers come from backend/sample_choice.json and must stay in sync with it.
 */

const SEVERITIES = [
  ["clean", "Healthy original", "/samples/sample-clean.wav"],
  ["mild", "Mild", "/samples/sample-zh-mild.wav"],
  ["moderate", "Moderate", "/samples/sample-zh-moderate.wav"],
  ["severe", "Severe", "/samples/sample-zh-severe.wav"],
] as const;

type Sev = (typeof SEVERITIES)[number][0];

const REFERENCE = "與地主做良性的溝通";
const GLOSS = "to communicate constructively with the landowner";

// Recorded output of each model on the severe clip. Held-out speaker.
const RESULTS = [
  {
    key: "base",
    name: "Stock Whisper",
    text: "與地主做人心的構同。",
    cer: 0.4444,
    note: "溝通 becomes 構同 — both syllables carry the wrong tone, and the word is lost.",
    bad: true,
  },
  {
    key: "tuned",
    name: "Our adapted model",
    text: "與地主做人性的溝通",
    cer: 0.1111,
    note: "溝通 recovered. 良性 still misread as 人性, so this is a real improvement, not a perfect one.",
    bad: false,
  },
] as const;

export function SampleEvidence() {
  const [sev, setSev] = useState<Sev>("severe");
  const current = SEVERITIES.find(([k]) => k === sev)!;

  return (
    <div className="ev">
      <div className="ev__head">
        <h3 className="ev__title">Hear the problem, then read the result</h3>
        <p className="ev__sub">
          One sentence from a held-out Common Voice speaker, degraded by our
          simulator at three severities. Plays entirely in your browser.
        </p>
      </div>

      <div className="ev__grid">
        <div className="tile tile--sky ev__card">
          <span className="ev__eyebrow">1 · Listen</span>
          <p className="ev__ref">{REFERENCE}</p>
          <p className="ev__gloss">&ldquo;{GLOSS}&rdquo;</p>

          <div className="ev__sevs">
            {SEVERITIES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`ev__sev ${sev === key ? "is-on" : ""}`}
                onClick={() => setSev(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <audio
            key={current[2]}
            className="ev__audio"
            controls
            src={current[2]}
            preload="none"
          />
          <p className="ev__hint">
            As severity rises the pitch range collapses and the clip stretches:
            4.4s clean to 7.4s severe. That collapse is the tone information
            disappearing.
          </p>
        </div>

        <div className="tile tile--pink ev__card">
          <span className="ev__eyebrow">2 · Compare</span>
          <p className="ev__gloss ev__gloss--tight">
            Both models, same severe clip.
          </p>

          {RESULTS.map((r) => (
            <div
              key={r.key}
              className={`ev__res ${r.bad ? "is-bad" : "is-good"}`}
            >
              <div className="ev__res-top">
                <span className="ev__res-name">{r.name}</span>
                <span className="ev__res-cer">
                  CER {r.cer.toFixed(3)}
                </span>
              </div>
              <p className="ev__res-text">{r.text}</p>
              <p className="ev__res-note">{r.note}</p>
            </div>
          ))}

          <p className="ev__hint">
            Measured on simulated dysarthria, not clinical recordings. The
            limitation is real and stated in the research notes.
          </p>
        </div>
      </div>

      <style>{`
        .ev{margin-top:28px}
        .ev__head{margin-bottom:16px}
        .ev__title{margin:0 0 6px;font-size:clamp(20px,2.4vw,27px);line-height:1.2}
        .ev__sub{margin:0;font-size:14.5px;line-height:1.55;color:var(--ink-soft);
          max-width:62ch}
        .ev__grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;
          align-items:start}
        .ev__card{padding:24px 22px;display:flex;flex-direction:column}
        .ev__eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.14em;
          text-transform:uppercase;opacity:.65}
        .ev__ref{margin:10px 0 2px;font-size:clamp(21px,2.4vw,29px);font-weight:700;
          line-height:1.35}
        .ev__gloss{margin:0 0 14px;font-size:13.5px;opacity:.75;line-height:1.5}
        .ev__gloss--tight{margin:10px 0 14px}
        .ev__sevs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
        .ev__sev{padding:7px 13px;border-radius:99px;font:inherit;font-size:12.5px;
          font-weight:700;cursor:pointer;color:inherit;
          background:rgba(0,0,0,.07);border:1px solid rgba(0,0,0,.18)}
        .ev__sev.is-on{background:var(--ink);color:var(--cream);
          border-color:var(--ink)}
        .ev__audio{width:100%;margin-bottom:12px}
        .ev__hint{margin:auto 0 0;padding-top:12px;font-size:12.5px;line-height:1.5;
          opacity:.7}
        .ev__res{padding:12px 14px;border-radius:12px;margin-bottom:10px;
          background:rgba(255,255,255,.55);border-left:4px solid var(--ink)}
        .ev__res.is-bad{border-left-color:#c2410c}
        .ev__res.is-good{border-left-color:#15803d}
        .ev__res-top{display:flex;justify-content:space-between;align-items:baseline;
          gap:10px;margin-bottom:5px}
        .ev__res-name{font-size:12.5px;font-weight:700;letter-spacing:.03em;
          text-transform:uppercase;opacity:.75}
        .ev__res-cer{font-size:12.5px;font-weight:700;
          font-variant-numeric:tabular-nums;opacity:.75}
        .ev__res-text{margin:0 0 6px;font-size:19px;font-weight:700;line-height:1.45}
        .ev__res-note{margin:0;font-size:12.5px;line-height:1.5;opacity:.78}
        @media (max-width:820px){
          .ev__grid{grid-template-columns:1fr}
        }
      `}</style>
    </div>
  );
}
