# OwnVoice: final presentation script (v2, 2026-10-21)

Matches `OwnVoice-Final-Deck-v2.pptx`: 15 slides, plus 4 hidden backup slides (16–19) for Q&A. Hidden slides are skipped in the slide show; to show one, jump to it by number. The same text is in each slide's speaker notes.

- Spoken length: **984 words, about 7:16 at 135 words per minute** (the 7-minute slot).
- Time per speaker: Alex about 99 s, Andrew about 120 s, Srihari about 100 s, Luis about 117 s.
- Format: 7-minute presentation, then the 2-minute demo video (played separately, after the last slide), then 1 minute of questions and 2 minutes of answers. The deck has no demo slide; the last line hands off to the video.

## What changed from v1, and why

- **Mr. Lin is the human thread.** He is introduced on slide 3 and returns on slide 13 for a before-and-after of his day. Alex's dad (James) opens and closes the story. Mr. Lin is a composite case, and the slide says so.
- **The technical level matches the original Final deck.** Terms are used and briefly explained, not replaced by analogies. Slide 7 names every stage: WORLD vocoder (F0, spectral envelope, aperiodicity), symptom-matched perturbations, matched pairs, Whisper-small fine-tuning, speaker-disjoint split, CER and STER.
- **The theme is named on purpose (slide 5):** "digital inclusion in the AI era" and "smarter public services". One preliminary judge marked us as not matching the theme.
- **Working today (slide 6)** shows real screenshots: the live research demo, the extension on a call with a real patient's voice, and the app design.
- **Real patients (slide 9):** 21 speakers, 420 recordings, 25% fewer character errors, better for 20 of 21. This answers the judges' "clinical-scale generalization" caveat, and it doubles as a cross-border check.
- **Since the preliminary round (slide 10)** covers Implementation and verification, which is 30% of the finals score.
- **Responsible AI (slide 11)** was the biggest gap in the judges' feedback.
- **Public-service integration (slide 12):** a judge called us "assistive for individuals rather than public-service".
- **Corrected claims:**
  - "Helps most where speech is worst" is gone. It held only on simulated speech; on real patients the gains were mild 28%, moderate 31% and severe 20%.
  - "0.5 s per second of speech" is replaced by the measured "about 3 s after the sentence ends".
  - "Nothing is uploaded" is now "live captions run on your own machine; audio is never stored".
  - "About 50% of stroke survivors" is gone, because our own source says roughly a quarter of ischaemic strokes.
  - The results chart now reads −41% for severe, matching the text (exact figure: 41.5%).

## Q&A prep (likely questions)

- **"Does the app work today?"** It is designed, and development starts the day after the competition. Today, the live research demo and the Chrome extension run on our real model.
- **"Does the website work without your laptop?"** Uploads work on the public URL through our hosted demo (20 to 60 seconds per clip). Live captions and dysarthria simulation need the model server running on a laptop, which is how we demo them.
- **"Were the real patients like Mr. Lin?"** Not exactly. The public dataset (MDSC / AISHELL-6B) covers cerebral palsy and Wilson's disease, and the recordings are short voice commands. That is why our next step is a consented pilot with head-and-neck and stroke patients.
- **"Why did healthy speakers improve too?"** Part of the gain is general adaptation to Taiwanese Mandarin and short commands, and standard Whisper sometimes invents English. We report it rather than hide it.
- **"How severe is still too severe?"** Severe speakers still see about 94 mistakes per 100 characters. That is a step forward, not a finished caption.
- **"Where does audio go?"** For live captions (the extension, and later the app), it goes to a model server on the user's own machine, is processed in memory, and is never written to disk. The website's upload demo runs on our hosted demo server in the cloud. It is fine for trying a recording, but it is not the private path, and it is slow on a free CPU (about 20 to 60 seconds per clip).
- **"Which voice is in the demo?"** It is a real speaker from MDSC (ID DM0005), whom the dataset rates as mild. We used it under the CC BY-NC 4.0 licence.

## Script

### Slide 1: Title (Alex, about 35 s)

Good afternoon, we are team OwnVoice from the United States. Let me start with someone close to me. About ten years ago my dad, James, had a stroke. It left him with dysarthria, a weakening of the muscles we use to speak. Overnight, phone menus, voice assistants and counters stopped understanding him. And he is one of millions. Now look at these two words. Same sounds. Only the pitch differs. One means to buy. The other means to sell.

*Switch slides.*

### Slide 2: Tone (Andrew, about 22 s)

Mandarin has four lexical tones, each a pitch contour. In English, a wrong pitch gives you an accent. In Mandarin, it gives you a different word. Dysarthria compresses pitch range before it degrades articulation, so the tone, the part that carries the meaning, is the first thing a patient loses.

*Switch slides.*

### Slide 3: Meet Mr. Lin (Srihari, about 33 s)

To make this concrete, meet Mr. Lin. He is forty-eight and works in Tainan. He chewed betel nut for twenty years. Oral-cancer surgery saved his life, and left him with dysarthria. It is a motor problem, not a cognitive one: he knows exactly what he wants to say. But at home, his family guesses. His bank's voice menu cannot recognise him. Every counter becomes an argument. And at work, meetings move on without him.

*Switch slides.*

### Slide 4: Scale (Srihari, about 27 s)

Mr. Lin is not rare. In Taiwan, stroke alone causes about twelve thousand new cases of dysarthria a year. Oral cancer is the fourth biggest cancer killer of men, and Parkinson's prevalence has risen almost four hundred percent since 2000. Yet when we began, there were zero openly licensed Mandarin dysarthric speech corpora, so speech recognisers simply never learned these voices.

*Switch slides.*

### Slide 5: The theme (Srihari, about 28 s)

That is why this is about digital inclusion in the AI era. Voice is becoming the front door to services: phone menus, AI assistants, automatic captions, telehealth, public hotlines. Each one fails on dysarthric speech. OwnVoice adapts speech AI to these speakers. That is digital inclusion. And services can serve them through a caption layer, without redesigning anything. That is a smarter public service.

*Switch slides.*

### Slide 6: Working today (Andrew, about 37 s)

Here is what works today. First, a live research demo on our website. Hear a sentence at four severities, simulate dysarthria on your own voice, compare stock Whisper with OwnVoice, and run live captions. Second, a Chrome extension, downloadable now, that captions any tab or the microphone. Here it is on a live call with a real patient's voice. Third, the OwnVoice app, with live captions, a one-tap Show mode and privacy controls. It is coming to the App Store and Google Play.

*Switch slides.*

### Slide 7: System (Andrew, about 39 s)

No open corpus existed, so we simulate one. We take openly licensed clear speech, Common Voice Taiwan and AISHELL-3, and use the WORLD vocoder to split each clip into its pitch contour, spectral envelope and aperiodicity. We damage each one to match a clinical symptom: monopitch, formant smearing, breathiness, jitter and slower rate. Three thousand matched clean and damaged pairs fine-tune Whisper-small. We test on held-out speakers, using character error rate and our own tone error rate, STER, which counts tone mistakes only where the sounds were right.

*Switch slides.*

### Slide 8: Simulated results (Andrew, about 22 s)

On that held-out test, stock Whisper's error climbs as speech gets worse. OwnVoice's stays far flatter: forty-one percent fewer character errors on severe speech, and eighty-six percent of characters correct overall, up from eighty-one. On an ordinary laptop CPU, a caption lands about three seconds after the sentence ends.

*Switch slides.*

### Slide 9: Real patients (Luis, about 32 s)

Simulation only proves so much, so we verified on real patients: four hundred and twenty random recordings from twenty-one dysarthric speakers, mild to severe, analysis pre-registered. OwnVoice cut character errors by twenty-five percent and was better for twenty of twenty-one patients. It is also a cross-border check: trained on mostly Taiwanese speech, tested on an independent dataset. We report the limits too: healthy speakers improved as well, and severe speech is still hard.

*Switch slides.*

### Slide 10: Since the preliminary round (Luis, about 24 s)

Since the preliminary round, we have tested on real patients, shipped the extension with a public download and fixed the bugs that real patient audio exposed, turned our research site into a live demo, and designed the app. We also found a bug in our own tone metric, fixed it, re-ran everything, and reported it.

*Switch slides.*

### Slide 11: Responsible AI (Luis, about 37 s)

As the app's privacy screen shows, you stay in control. Live captions run on your own machine; audio is decoded in memory and never stored, so a hospital can run it inside its own network. We train only on openly licensed speech and use patient data strictly under its licence, by speaker ID only. In the app, research sharing is opt-in with written consent. We report every speaker, including the one who got worse. And captions assist the speaker; they are not a diagnosis.

*Switch slides.*

### Slide 12: Public services (Luis, about 24 s)

This goes beyond one person. In hospitals, before and after surgery and in speech therapy, where STER can track tone recovery. At counters and hotlines like 1999, where staff simply read the captions. In telehealth, which the extension already covers. And for banks and telecoms, so customers like Mr. Lin are not dropped.

*Switch slides.*

### Slide 13: Before and after (Alex, about 34 s)

So, back to Mr. Lin. Before, his family guessed. Now his phone shows his words. Before, video visits with his doctor were a struggle. Now captions appear as he speaks. Before, every counter was an argument. Now he taps Show, and the clerk reads it. Before, meetings moved on without him. Now his coworkers read along. Same man, same voice. The technology finally listens. That is what we want for my dad, and everyone like him.

*Switch slides.*

### Slide 14: Commitment and policy (Alex, about 30 s)

And we are in this for the long run. The day this competition ends, we start building the app. We will expand to Hokkien, Cantonese, Vietnamese and Thai, seek a consented hospital pilot, and build the first open Mandarin dysarthric speech database. We also propose two policies for Taiwan: a speech functional outcome field in the National Cancer Registry, and an open, consented Taiwanese dysarthria speech corpus.

*Switch slides.*

### Slide 15: Thank you (Srihari, about 12 s)

Thank you. We are team OwnVoice. Everything is at ownvoice dot vercel dot app, and our code is on GitHub. We will now show you the system working.

*Switch slides.*

## Backup slides (hidden; jump to them during Q&A)

- 16, the pipeline end to end: "How does the whole system fit together?"
- 17, how STER is computed: "How is the tone error rate calculated?"
- 18, characters and tone by severity: "Does tone actually improve?"
- 19, real patients by severity band: "How does it do on severe patients? Is it significant?"
