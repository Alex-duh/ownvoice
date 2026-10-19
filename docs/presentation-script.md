# OwnVoice — 5-minute presentation script

Team script, corrected. Matches OwnVoice-Presentation-Final.pptx (6 slides); the same text is in each slide's speaker notes.

---

## Slide 1 — Title and hook  [Andrew · 0:00–0:45]

Good morning. We are Team OwnVoice.

If a speech engine transcribes "I want to sell my stocks" as "I want to buy my stocks," a standard error metric scores it 80 percent correct: one character out of five is wrong. You would probably say that software is broken. You would probably lose your money too.

In Mandarin, this isn't a thought experiment. It's the daily reality for people with dysarthria. 賣, mài, means to sell. 買, mǎi, means to buy. They share the exact same consonants and vowels. Pitch is the only difference. When a stroke or oral cancer flattens someone's pitch, standard metrics count the mistake as just another wrong character. They can't tell you that tone was the cause.

---

## Slide 2 — The problem and scale  [Alex · 0:45–1:30]

In Taiwan, the medical burden is immense. Roughly 49,000 strokes occur every year, and about one in four leaves the survivor with dysarthria, which is over 12,000 people. Oral cavity cancer, driven mainly by betel nut, is the fourth leading cause of male cancer death in Taiwan.

As public services, telehealth and everyday devices shift to voice-first interfaces, these patients face a double exclusion in the AI era: social and technological. Stock Whisper gets 89.3 percent of characters right on clear speech, but collapses to 52.6 percent on our simulated severe dysarthria. And across our literature review, zero dysarthria papers score tone as its own failure.

---

## Slide 3 — What we built  [Srihari · 1:30–2:05]

To close this gap, we built two things. First, STER, the Segmental Tone Error Rate. STER counts tone mistakes only on syllables where the consonant and vowel were already recognised correctly, which isolates pitch failure from general articulation errors.

Second, we fine-tuned OpenAI's Whisper-small on simulated dysarthric Mandarin from 91 speakers. The splits are strictly speaker-disjoint, so no speaker's voice appears in both training and test. We want to be clear up front: every dysarthric sample here is simulated.

---

## Slide 4 — Results  [Luis · 2:05–2:40]

Fine-tuning raised overall character accuracy from 80.9 to 86.2 percent, cutting errors by 27.7 percent relative. Severe dysarthria improved the most, with character errors down 41.5 percent.

But here is our key finding: STER barely moved. It changed by only negative 0.0041. Fine-tuning fixed the characters but left tone accuracy where it was. That tells us tone has to be modelled explicitly; it won't come for free. One caveat: these are results on simulated speech, so they compare methods. They are not clinical claims.

---

## Slide 5 — Under the hood  [Andrew · 2:40–3:30]

Here's how it works under the hood.

First, we simulate. There's no openly licensed Mandarin dysarthria corpus, so we take clear speech from Common Voice and AISHELL-3 and run it through the WORLD vocoder. The vocoder splits a voice into pitch, vocal-tract shape and breath noise. We squeeze the pitch toward the speaker's average, blur the formants and add breathiness, then rebuild the audio slower and less steady. At severe, only 20 percent of the pitch range survives.

Second, the model. Whisper-small turns audio into a spectrogram and runs it through 12 encoder layers. Then 12 decoder layers write the text one token at a time.

Third, training. We split by speaker first: 73 speakers for training, 18 never heard. The whole pipeline trains on a single consumer GPU.

If asked: pitch is never an explicit model input; it only survives as harmonic spacing in the low Mel bands, and the character loss can be lowered through context, which is why STER does not move.

---

## Slide 6 — Asks, roadmap and close  [Alex · 3:30–4:25]

To move from a working prototype to real patient impact, we have four specific asks for our mentors today. Priority one is a field validation partner. We need 50 to 100 authentic patient recordings from an oncology or speech pathology department, such as Chi Mei Hospital. With that access, we can retrain on real human speech before the October 22 finals.

Second, regulatory guidance on Taiwan FDA pathways for speech-processing medical software. Third, open data infrastructure: a consented, openly licensed Taiwanese dysarthria speech corpus.

Fourth, scale. Mandarin is only one tonal language. Taiwanese Hokkien, Hakka, Cantonese and Thai all carry meaning in tone, and STER carries over to any language with a syllable-and-tone transcription. We are asking for speech data in those languages, and for partners to deploy OwnVoice where people actually use voice: telehealth, hospitals and public services.

**[Srihari · 4:25–5:00]**

Over the next month, we will test our simulator against authentic patient recordings, retrain our model, and consult on TFDA pathways. At finals, we aim to present a model validated on real patient speech, a regulatory roadmap, and clinical partnership letters.

After that: a clinical pilot, a TFDA filing, and more tonal languages. Our vision is for OwnVoice to become the reference for tone-aware speech technology.

Learn more at our website and repository.

Luis: To include every voice of Taiwan — and their money too.

Alex: Thank you for listening. 謝謝.

If asked about languages: today the STER code uses Mandarin pinyin. Each new language needs its own syllable-and-tone converter (Tâi-lô for Hokkien, Jyutping for Cantonese) and its own speech data, which is exactly the ask.


---

# Technical depth

Two things here: a longer version of slide 3 you can swap in if you have the
time, and a reference appendix for when a technical judge pushes. Every number
below is from the code, not from memory — `src/dysarthria_sim.py`,
`src/train_asr.py`, `src/metrics.py`.

## Slide 3 — deep version  [~80 seconds, costs you 35]

Only use this if you cut slide 5 down to a single sentence, or if the audience
is technical.

We built two things: a metric and a model.

The metric first. To score a Mandarin transcript we convert both the reference
and the prediction to pinyin with tone digits, so 買 becomes "mai3" and 賣
becomes "mai4". Then we split every syllable into two parts: the segment,
"mai", and the tone, 3 or 4.

Here is the subtle part. Our first version aligned reference and prediction on
the full syllable, tone included, and it was wrong. If the model inserted a
word, the alignment shifted, the tone comparisons went out of phase, and real
tone errors disappeared from the score — and they disappeared more on the worse
audio, which is exactly backwards. So we now run edit-distance alignment on the
segments alone. Tone cannot influence where things line up. Then, on every
syllable where the segment already matched, we ask one question: is the tone
right? That ratio is STER.

Now the model. We take Whisper-small, 244 million parameters, and fine-tune it
on paired data we generate. The generator runs the WORLD vocoder, which
decomposes speech into three streams: the pitch contour, the spectral envelope
and the aperiodicity. We perturb each stream separately, then resynthesise. Six
perturbations, three severities. The important one is F0 compression toward the
speaker's own mean — at severe we pull 80 percent of the way to monotone, which
is precisely what destroys tone.

Training runs at learning rate 1e-5, batch size 8 with gradient accumulation 2,
on one consumer GPU; epoch 1 was best and later epochs overfit. We keep clean
speech in the training mix so the model does not forget normal Mandarin. Splits are speaker-disjoint with
a fixed seed, so nothing leaks.

## Appendix A — the simulation, exactly

WORLD (`pyworld`) decomposes a waveform into F0 (pitch per frame), SP (spectral
envelope, the timbre) and AP (aperiodicity, the noise component). We modify
those three arrays and resynthesise. That is what keeps the voice recognisably
the same person: WavLM speaker similarity is 0.907 between clean and severe.

| Parameter | Mild | Moderate | Severe | Models |
|---|---|---|---|---|
| `rate` | 0.90 | 0.75 | 0.60 | Reduced speaking rate, near-universal in dysarthria |
| `prosody` | 0.30 | 0.55 | 0.80 | F0 range compression toward the speaker mean — monopitch |
| `jitter` | 0.010 | 0.025 | 0.045 | Cycle-to-cycle F0 noise, laryngeal control loss |
| `smear` | 0.15 | 0.35 | 0.55 | Spectral envelope smoothing, blurred formants |
| `breathy` | 0.10 | 0.25 | 0.40 | Raised aperiodicity, incomplete glottal closure |
| `amp` | 0.05 | 0.12 | 0.20 | Slow amplitude instability, respiratory support loss |

`prosody` is the one that matters for this project. It rewrites each voiced
frame as `mean + (f0 - mean) * (1 - strength)`. At 0.80 the contour keeps only
a fifth of its excursion, so a rising tone and a falling tone start to look the
same to the model.

The presets are deliberately conservative. Over-perturbing produces audio no
model can recover, which teaches the model nothing.

Validation, from `src/verify_sim.py`: F0 standard deviation falls monotonically
with severity, 2.545 to 1.173 semitones; spectral flux falls; duration rises.
Those are the published acoustic correlates of real dysarthria, so the
simulation moves the right things in the right direction. Jitter is the one
perturbation we have not validated against a reference measurement, and we say
so.

## Appendix B — the metric, exactly

Three numbers come out of `score()`:

- CER — character error rate, standard Levenshtein over characters. Chinese has
  no word delimiters, so CER is the correct unit; WER would be meaningless.
- TER — tone error rate over the whole tone sequence, including syllables whose
  sounds were wrong.
- STER — tone error rate restricted to syllables whose initial and final were
  already correct.

TER and STER differ because TER mixes two failures together. If the model
mishears the syllable entirely, its tone was never really in play. STER asks
the narrower and more diagnostic question: when the model heard the sounds
correctly, did it also hear the pitch correctly?

Neutral tone is mapped to 5 rather than left blank, so it participates in
scoring instead of silently matching everything.

The alignment bug is worth telling, because it shows the metric was tested
rather than asserted. Original behaviour, from the docstring in
`src/metrics.py`: reference 我要買東西 against prediction 我就要買東西 returned
STER 0.000 — an inserted character pushed everything out of phase and the tone
error vanished. Aligning on segments first fixed it.

## Appendix C — training and decoding, exactly

| Setting | Value | Why |
|---|---|---|
| Base model | `openai/whisper-small`, ~244M params | Fits one consumer GPU; larger models did not fit the budget |
| Epochs | 3 run, epoch 1 kept | Epochs 2–3 overfit (train loss 0.002, eval CER rose) |
| Learning rate | 1e-5, warmup ratio 0.1 | Standard for Whisper fine-tuning; higher wrecks the decoder |
| Batch | 8, gradient accumulation 2, gradient checkpointing | Effective batch 16 inside 8 GB of VRAM |
| Precision | fp16 on CUDA | Speed and memory |
| Checkpointing | best model at end, eval each epoch | Guards against a late-epoch collapse |
| Clean data | kept in the training mix | Without it the model forgets normal speech |
| Splits | speaker-disjoint, seed 0 | No speaker appears on both sides |
| Decoder language | forced to `zh` | Otherwise Whisper sometimes emits the wrong script |

Decoding at inference: greedy, `no_repeat_ngram_size=4`, `repetition_penalty=1.15`.
That is not cosmetic. The first fine-tune hallucinated repeating loops on severe
audio and scored CER 2.843 — nearly thirty times worse than doing nothing,
because the model emitted far more characters than the reference contained.
Blocking repeated 4-grams stopped it.

## Appendix D — what a sceptical reviewer should attack, and our answer

**"You are evaluating on your own simulation, so of course it improves."**
Correct, and that is why the headline framing is the negative result. If the
setup were self-serving, STER would have improved too. It did not.

**"Speaker leakage."**
`build_splits` partitions by speaker before anything else, seed 0, 20 percent
held out. Test speakers were never seen.

**"Whisper already saw Common Voice in pretraining."**
Likely true, and it works against us, not for us: the baseline is stronger than
it would be on unseen data, so the measured gain is conservative.

**"Why not train on real data?"**
No openly licensed Mandarin dysarthria corpus exists. MDSC and CDSD are behind
signed licences with multi-week approval. Unlicensed re-uploads of TORGO and
UASpeech circulate freely and we refuse to touch them — patient medical data,
and an explicit disqualification criterion.

**"Is the improvement just the model getting better at the language model, not
the acoustics?"**
Partly, almost certainly — that is the honest reading of CER improving while
STER does not. A stronger language prior fixes characters through context. It
cannot fix tone, because tone is acoustic. That is the finding.
