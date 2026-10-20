# Demo video plan (2 minutes): product demo, v2

Revised 2026-10-19 (v1 written the same day). v1 was framed for clinical partners. The video
is for the **Presidential Hackathon final review**, so its job is to show that OwnVoice is a
working product that wins on the judging criteria.

## What the judges score (docs/handbook-2026.pdf)

| Criterion | Finals weight | What the video must show |
|---|---|---|
| Feasibility | 30% | It installs and runs today, on ordinary hardware, for free |
| Innovation | 20% | Tone is the failure nobody else measures (STER), and a captioner built for it |
| Social impact | 20% | Who it's for in Taiwan, in one human moment |
| **Implementation and verification** | **30%** | **Real, uncut product footage.** The handbook says finalists "must provide a system demo" |

That means about 70% of the runtime is real footage of the extension and site, and about 30% is
motion graphics around it.

## Format: product ad with voiceover, kinetic text and real footage

- **Voiceover, not text-only.** A 2-minute text-only video makes judges read the whole time
  while also watching a UI, so the product gets half their attention. Use a human voice:
  Andrew's, for continuity with the live pitch. It sounds more credible than an AI voice in a
  social-impact category.
- **Burn in English and 中文 subtitles** anyway. A captioning product with an uncaptioned
  video undercuts its own message, and it signals the accessibility mindset.
- **Kinetic text** carries the numbers and the one-line claims. Low music bed, ducked under
  the voiceover and **muted whenever demo audio plays**, so judges hear the speech the model
  hears.
- **Real-time footage in the hero shot.** Do not speed up captions. If any shot is sped up
  (install steps), show a "3×" badge.

## Shot list (about 120 s)

| Time | Shot | Voiceover (draft) | On screen |
|---|---|---|---|
| 0:00–0:08 | **Cold open, no voiceover.** Black screen. Clean 買 mǎi plays, then 賣 mài, while their *real* pitch contours draw (F0 extracted with pyworld). Then both at severe: the two contours collapse into one flat line | — | "One tone apart." → "Illness flattens it first." |
| 0:08–0:18 | A severe-simulated clip plays on a video call, and stock captions produce nonsense (stock Whisper; optionally Google Meet's own captions, see test below) | "For millions of people after a stroke or mouth-cancer surgery, captions fail at exactly the moment they're needed." | Garbled caption, struck through in red |
| 0:18–0:24 | Logo reveal | "So we built OwnVoice." | OwnVoice · captions for speech that's hard to understand |
| 0:24–0:38 | **Install in three clicks** (3× with badge): ownvoice.vercel.app, **Download extension** (zoom on the button), chrome://extensions, Load unpacked, pin the icon | "Download it, load it into Chrome, done. No account." | 1 Download · 2 Load · 3 Pin |
| 0:38–1:08 | **Hero shot, real time.** A Google Meet call. The other participant's voice is a severe-simulated clip. Click the OwnVoice icon, the side panel slides in, choose "This tab's audio", press Start. Captions arrive phrase by phrase. Auto-zoom follows the cursor, then holds on the panel | "Any call in your browser. OwnVoice listens to the tab and captions each phrase as it ends, using a model trained for unclear speech." | Small persistent tag: "Simulated severe dysarthria · unseen speaker" |
| 1:08–1:22 | Mic mode plus the 中文 toggle: the panel switches language. Cut to the website's full-screen stage mode on a laptop turned toward the viewer (the service-counter scenario) | "Or caption yourself, in person, in Chinese or English." | |
| 1:22–1:40 | **Proof.** Animated bars, stock vs OwnVoice, by severity, from docs/results.md | "On the hardest speech we cut errors by 41%. Tested only on speakers the model never heard in training." | 41% fewer errors (severe) · 86.2% characters correct · small print: "simulated dysarthria" |
| 1:40–1:52 | Privacy and cost card: laptop icon with a struck-through cloud | "It runs on your own laptop. Nothing is uploaded. It's free and open source." | Free · Open source · On-device |
| 1:52–2:00 | End card | "OwnVoice. Be understood." | ownvoice.vercel.app · github.com/andrewshih0407/ownvoice · team names · Presidential Hackathon 2026 |

### Truthfulness checks before locking the cut

1. **Run the backend on the recording laptop** during the hero shot, or the "nothing is
   uploaded" line becomes false.
2. **Don't say "fixes tones."** Tone errors fell 43% on *severe* speech only. Overall STER
   barely moved.
3. **Optional head-to-head with Meet's own captions.** This is the most persuasive shot if it
   holds, and it's also the riskiest. Test it first on 6–8 held-out severe clips and record the
   result either way. Only use it if OwnVoice is better across the set, not on one
   cherry-picked clip. Whether Meet captions Mandarin (Traditional) is `[ASSUMPTION until
   checked]`. Otherwise compare against stock Whisper-small. That would need a `mode=base`
   option on `/transcribe_chunk` (about 10 lines in `backend/app.py`), because "Fast mode" is
   whisper-**base** and isn't the fair baseline.

## The simulated voices

- **Use pre-rendered severe clips from held-out speakers** (`src/data.py build_splits`). That
  matches exactly what the numbers measure. Training clips score CER 0.000 and would show
  memorisation.
- **For the Meet shot:** a second laptop joins the call and plays the clip into Meet through a
  virtual audio device (BlackHole on macOS). **Turn off Meet's noise cancellation** on that
  laptop, or it may filter the breathiness and jitter the simulator adds.
  `[ASSUMPTION until run]`
- **For the 買/賣 hook:** record a native speaker's clean 買 and 賣, then run both through
  `/simulate` at severe.
- **Never** have a teammate imitate dysarthria.

## How Claude can build the polished parts

The work splits into two halves, and they need different tools.

**1. Screen capture with auto-zoom: record it yourself.** Playwright-based "demo recorder"
skills (e.g. Promo Video Recorder, Professional UI Demo Recorder) can drive the *website*, but
they can't click Chrome's toolbar icon. Tab capture requires that real user click (see
`extension/background.js`), so the extension shots have to be recorded by hand. Use a recorder
that logs the cursor and auto-zooms on clicks: Screen Studio (paid, macOS) or Cap (open
source). Both are from my recall, so check current pricing. Or use the `screenstudio-alt` skill,
which needs input logging *during* capture because zoom can't be recovered from pixels later.

**2. Motion graphics and the final edit: Remotion, with its official Claude skills.**
- Install with `npx skills add remotion-dev/skills` (from remotion.dev/docs/ai/skills). Skills
  include `remotion-best-practices`, `remotion-create`, `remotion-markup`, `remotion-captions`
  and `remotion-render`.
- Claude writes the React compositions: the pitch-contour cold open (driven by real F0 data,
  so it's exact by construction), the stat cards, the animated results chart, the end card,
  and the bilingual burned-in subtitles. It also composites your screen recordings with any
  extra zoom keyframes, so the whole video renders from one repo you can re-render.
- License: Remotion is free for individuals and very small teams, with a company license above
  that. This is from my recall `[verify on remotion.dev/license]`. A student hackathon team
  should be in the free tier.
- Limitation: Remotion produces animated-presentation-style video. That's right for the
  graphics, but it isn't a footage editor. Real editing (cuts, timing to the voiceover) is
  still faster in CapCut or DaVinci Resolve. Pick one: compose everything in Remotion, or
  render the graphics as clips and cut in an editor. **Recommendation: graphics in Remotion,
  final cut in CapCut or DaVinci.**

## Steps, in order (make-or-break first)

1. **Test the extension for real (about 1 hour).** Its README says it is *untested against a
   real microphone and real tab capture*. Load it unpacked, start the backend, and caption a
   held-out clip in a tab, then in Meet. If tab capture fails, the hero shot changes, so
   nothing downstream starts until this passes.
2. **Measure latency** on the recording laptop: 10 segments, note `elapsed_ms` per segment.
   The cold start is about 45 s (sidepanel.js warms the model up on open), so open the panel
   well before rolling.
3. Prepare the clips: 8 held-out severe clips plus the 買/賣 pair.
4. Write the voiceover script to the shot list, about 230 words at a calm pace.
5. Record the screen takes (clean Chrome profile, Do Not Disturb, 1080p or higher), then
   record the voiceover.
6. Build the graphics in Remotion, cut, add subtitles, export 1080p H.264, ≤ 2:00.
7. Put the commit hash and model id (`anonymous6623/ownvoice-asr`) in the description.

Estimated budget: about 2 days of total team effort. Steps 1–2 take about 2 hours and gate the
rest.

---

## Overlay app (assessed 2026-10-19, unchanged)

**Not before the finals.** It enlarges the project rather than sharpening it, and the extension
already covers "works on video calls." If time remains after the video is locked, a Document
Picture-in-Picture floating caption window (0.5–1 day, Chrome-only) is the cheap version. The
desktop and system-audio versions take 2–11 days and are fragile to demo. Put "captions inside
LINE and phone calls" on the roadmap slide instead.
