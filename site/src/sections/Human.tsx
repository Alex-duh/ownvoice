import { Reveal } from "../components/Reveal";
import { Link } from "react-router-dom";

/**
 * The front page, written for people rather than reviewers.
 *
 * Every figure below is sourced from docs/PROPOSAL.md, which cites the Taiwan
 * Health Promotion Administration cancer registry and Ministry of Health and
 * Welfare cause-of-death statistics. Nothing here is estimated, rounded up for
 * effect, or invented. If a number cannot be traced to that document it does
 * not belong on this page.
 *
 * One pairing is deliberately avoided: 52.6% (the severe-condition baseline)
 * and 86.2% (matched per-condition intelligibility) come from DIFFERENT
 * experiments and must never be shown as a before/after. The honest matched
 * pair is 80.9% -> 86.2%, and that is what appears here.
 */

const WHO = [
  {
    tag: "Oral cancer",
    head: "4th leading cause of cancer death in Taiwanese men",
    body: "Around 29.8 cases per 100,000, roughly ten times the rate in women. It strikes in the 40s and 50s, ending careers that depend on speaking.",
    tone: "cobalt",
  },
  {
    tag: "Stroke",
    head: "~12,000 new cases of dysarthria a year",
    body: "Taiwan sees about 49,000 strokes annually, and dysarthria follows roughly one in four ischaemic strokes.",
    tone: "tangerine",
  },
  {
    tag: "Parkinson's",
    head: "Prevalence up 394% since 2000",
    body: "Taiwan became a super-aged society in 2025. Speech decline is gradual, which means there is time to act before it is lost.",
    tone: "violet",
  },
];

const STEPS = [
  ["Speak", "Into a laptop, a phone, or straight into a video call. No special hardware, no clinic visit."],
  ["Understood", "A speech model adapted to dysarthric Mandarin turns it into text, in under a second per phrase."],
  ["Read", "The person you are talking to reads what you meant, on screen or on a projector."],
];

export function Human() {
  return (
    <>
      <section className="hsec hsec--hero">
        <div className="wrap">
          <Reveal>
            <p className="heyebrow">Presidential Hackathon 2026 · Digital inclusion</p>
            <h1 className="hhero">
              Losing your voice should not mean
              <br />
              losing your place in the conversation.
            </h1>
            <p className="hlede">
              Dysarthria makes speech hard for other people, and nearly
              impossible for machines, to understand. Voice assistants, call
              centres and automatic captions all fail at once. OwnVoice is a
              speech recogniser built for exactly those voices, in Mandarin,
              where a wrong tone is a wrong word.
            </p>
            <div className="hcta">
              <a className="btn" href="#try">Hear the difference</a>
              <Link className="btn btn--ghost" to="/research">
                Read the research
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="hsec">
        <div className="wrap">
          <Reveal>
            <h2 className="h2">Who this is for</h2>
            <p className="hsub">
              In Taiwan alone, three groups lose intelligible speech every year.
            </p>
          </Reveal>
          <div className="hgrid">
            {WHO.map((w, i) => (
              <Reveal key={w.tag} delay={i * 70}>
                <div className={`tile tile--${w.tone} hcard`}>
                  <span className="hcard__tag">{w.tag}</span>
                  <p className="hcard__head">{w.head}</p>
                  <p className="hcard__body">{w.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="hnote">
              Sources: Taiwan Health Promotion Administration cancer registry;
              Ministry of Health and Welfare cause-of-death statistics.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="hsec hsec--steps">
        <div className="wrap">
          <Reveal>
            <h2 className="h2">How it works, in three steps</h2>
          </Reveal>
          <ol className="hsteps">
            {STEPS.map(([head, body], i) => (
              <Reveal as="li" key={head} delay={i * 70} className="hstep">
                <span className="hstep__n">{i + 1}</span>
                <div>
                  <p className="hstep__head">{head}</p>
                  <p className="hstep__body">{body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="hsec hsec--result">
        <div className="wrap">
          <Reveal>
            <h2 className="h2 h2--light">What it changes</h2>
          </Reveal>
          <div className="hstats">
            <Reveal>
              <div className="hstat">
                <span className="hstat__n">41%</span>
                <span className="hstat__l">
                  of the character errors stock speech recognition makes on
                  severe dysarthria are recovered
                </span>
              </div>
            </Reveal>
            <Reveal delay={70}>
              <div className="hstat">
                <span className="hstat__n">80.9 → 86.2%</span>
                <span className="hstat__l">
                  intelligibility, measured condition by condition against the
                  same speakers
                </span>
              </div>
            </Reveal>
            <Reveal delay={140}>
              <div className="hstat">
                <span className="hstat__n">Free</span>
                <span className="hstat__l">
                  open source, trained only on openly licensed data, runs on an
                  ordinary laptop
                </span>
              </div>
            </Reveal>
          </div>
          <Reveal>
            <p className="hnote hnote--light">
              Measured on simulated dysarthria built from openly licensed
              speech, not yet on clinical recordings. We say so on every page
              that shows a number, and the research section explains why that
              distinction matters.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
