/**
 * Speech synthesis for the transcript readback.
 *
 * IMPORTANT framing: this speaks the RECOGNISED TEXT in a generic system voice.
 * It is not voice restoration and must never be presented as such. docs/prior-art.md
 * records why the project moved away from an ASR -> TTS cascade (a text bottleneck
 * discards prosody and timing, and the prior art all uses direct speech-to-speech),
 * and the pitch is positioned around tone rather than own-voice restoration.
 * What this adds is an accessibility output: the listener HEARS what the speaker
 * meant, in a voice that makes no claim to be theirs.
 *
 * Implementation is the browser's built-in Web Speech API, chosen over a served
 * TTS model (BreezyVoice, SpeechT5) because it costs nothing, downloads nothing,
 * adds no server memory on a 2-vCPU box, and speaks instantly. The tradeoff is
 * that available voices depend on the visitor's operating system.
 */

const ZH_PREFERENCE = ["zh-tw", "zh-hant", "zh-hk", "zh-cn", "zh"];

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Best available Mandarin voice, preferring Taiwanese.
 *
 * Returns null when the OS ships no Chinese voice at all, which is common on
 * stock Linux and some Windows installs. Callers must treat that as "readback
 * unavailable" rather than falling back to an English voice reading Hanzi.
 */
export function pickZhVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  for (const want of ZH_PREFERENCE) {
    const hit = voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(want));
    if (hit) return hit;
  }
  return null;
}

/**
 * Voices load asynchronously in Chrome and are often an empty array on first
 * call, so this resolves on the voiceschanged event and gives up rather than
 * hanging if it never fires.
 */
export function loadVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (!speechSupported()) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", finish);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", finish);
    setTimeout(finish, timeoutMs);
  });
}

export function cancelSpeech(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

/** Speak one line. Resolves when it finishes, errors, or is cancelled. */
export function speak(
  text: string,
  voice: SpeechSynthesisVoice | null,
  opts: { rate?: number; onStart?: () => void } = {}
): Promise<void> {
  if (!speechSupported() || !text.trim()) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = "zh-TW";
    }
    // Slightly under default: dysarthric-speech transcripts are the kind of
    // content a listener is trying hard to follow.
    u.rate = opts.rate ?? 0.95;
    u.onstart = () => opts.onStart?.();
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}
