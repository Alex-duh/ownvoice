/**
 * Interface strings for the live transcription device.
 *
 * Traditional Chinese (zh-TW), not Simplified: the users are in Taiwan, the
 * corpus is Common Voice zh-TW, and the recogniser's own output is normalised
 * to Traditional by zhconv in backend/app.py. A Simplified interface over
 * Traditional output would be incoherent.
 *
 * Scope is deliberately the device only -- the research write-ups around it
 * stay in English, because that is the language the deck, the paper and the
 * judges' reading material are already in. Translating those is a separate
 * decision, not a side effect of localising a widget.
 */

export type Lang = "en" | "zh";

export const LANG_LABEL: Record<Lang, string> = {
  en: "EN",
  zh: "中文",
};

type Strings = {
  title: string;
  sub: string;
  modeTuned: string;
  modeTunedNote: string;
  modeFast: string;
  modeFastNote: string;
  fastWarn: string;
  start: string;
  stop: string;
  inFlight: (n: number) => string;
  readAloud: string;
  noVoice: string;
  stageMode: string;
  empty: string;
  listeningHint: string;
  transcribing: string;
  silence: string;
  secAudio: string;
  avgRtf: (x: string) => string;
  rtfSlow: string;
  rtfFast: string;
  micDenied: string;
  stageListening: string;
  stagePaused: string;
  stageTuned: string;
  stageFast: string;
  stageWait: string;
  stageStart: string;
  stageStop: string;
  stageExit: string;
  speakTitle: string;
};

export const T: Record<Lang, Strings> = {
  en: {
    title: "Live transcription",
    sub: "Speak Mandarin. Audio is cut at pauses and transcribed segment by segment. Nothing is stored — each clip is decoded in memory and discarded.",
    modeTuned: "Adapted model",
    modeTunedNote: "our whisper-small · slower",
    modeFast: "Fast mode",
    modeFastNote: "stock whisper-base · responsive",
    fastWarn:
      "Fast mode runs stock Whisper, not our fine-tuned model. It is here to show the latency and accuracy trade, not our results.",
    start: "● Start listening",
    stop: "■ Stop",
    inFlight: (n) => `${n} in flight`,
    readAloud: "Read transcript aloud",
    noVoice:
      "No Mandarin system voice found in this browser, so readback is unavailable here. It is an accessibility output only: it speaks the recognised text in a generic voice, not the speaker’s own.",
    stageMode: "Stage mode",
    empty: "Transcript appears here.",
    listeningHint: "Listening… pause to end a segment.",
    transcribing: "transcribing…",
    silence: "(silence)",
    secAudio: "s audio",
    avgRtf: (x) => `Average ${x}x real time.`,
    rtfSlow:
      "Above 1 means inference is slower than speech, so the transcript trails the speaker.",
    rtfFast: "Below 1 means the model keeps up with speech.",
    micDenied:
      "Microphone permission denied. Allow it in your browser and try again.",
    stageListening: "Listening",
    stagePaused: "Paused",
    stageTuned: "adapted model",
    stageFast: "fast mode",
    stageWait: "Press Start and speak.",
    stageStart: "Start",
    stageStop: "Stop",
    stageExit: "Exit (Esc)",
    speakTitle: "Read this segment aloud",
  },
  zh: {
    title: "即時語音辨識",
    sub: "請開始說話。系統會在您停頓處切分語音，逐段辨識。錄音不會儲存，每段音訊僅於記憶體中處理後即刪除。",
    modeTuned: "微調模型",
    modeTunedNote: "本研究的 whisper-small · 較慢",
    modeFast: "快速模式",
    modeFastNote: "原版 whisper-base · 反應較快",
    fastWarn:
      "快速模式使用原版 Whisper，並非本研究微調的模型。此模式用於呈現延遲與準確度之間的取捨，而非我們的研究結果。",
    start: "● 開始聆聽",
    stop: "■ 停止",
    inFlight: (n) => `處理中 ${n} 段`,
    readAloud: "朗讀辨識結果",
    noVoice:
      "此瀏覽器未安裝中文語音，因此無法朗讀。朗讀僅為無障礙輔助功能：以系統語音唸出辨識文字，並非還原說話者本人的聲音。",
    stageMode: "簡報模式",
    empty: "辨識結果會顯示在這裡。",
    listeningHint: "聆聽中… 停頓即可結束一段。",
    transcribing: "辨識中…",
    silence: "（無語音）",
    secAudio: " 秒音訊",
    avgRtf: (x) => `平均為實際時間的 ${x} 倍。`,
    rtfSlow: "大於 1 表示辨識速度慢於說話速度，字幕會落後於講者。",
    rtfFast: "小於 1 表示模型可跟上說話速度。",
    micDenied: "麥克風權限遭拒。請在瀏覽器中允許麥克風後再試一次。",
    stageListening: "聆聽中",
    stagePaused: "已暫停",
    stageTuned: "微調模型",
    stageFast: "快速模式",
    stageWait: "請按「開始」後說話。",
    stageStart: "開始",
    stageStop: "停止",
    stageExit: "離開 (Esc)",
    speakTitle: "朗讀此段",
  },
};
