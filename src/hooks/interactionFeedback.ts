// Defensive interaction-feedback primitives (licensed UI sounds, vibration,
// calm speech). Every function is a safe no-op when a browser API is missing,
// so routines stay completable without audio/haptics. Sound is additive:
// choice/answer state is always conveyed by text, icon, and border too.

export type InteractionCue =
  | "select"
  | "confirm"
  | "success"
  | "retry"
  | "routineComplete"
  | "recordStart"
  | "recordStop";

interface InteractionCueConfig {
  src: string;
  volume: number;
  timeoutMs: number;
}

const INTERACTION_CUE_CONFIG: Record<InteractionCue, InteractionCueConfig> = {
  select: {
    src: "/assets/audio/ui/select.wav",
    volume: 0.18,
    timeoutMs: 240,
  },
  confirm: {
    src: "/assets/audio/ui/confirm.wav",
    volume: 0.18,
    timeoutMs: 300,
  },
  success: {
    src: "/assets/audio/ui/success.wav",
    volume: 0.22,
    timeoutMs: 550,
  },
  retry: {
    src: "/assets/audio/ui/retry.wav",
    volume: 0.12,
    timeoutMs: 350,
  },
  routineComplete: {
    src: "/assets/audio/ui/routine-complete.wav",
    volume: 0.24,
    timeoutMs: 900,
  },
  recordStart: {
    src: "/assets/audio/ui/record-start.wav",
    volume: 0.16,
    timeoutMs: 330,
  },
  recordStop: {
    src: "/assets/audio/ui/record-stop.wav",
    volume: 0.16,
    timeoutMs: 330,
  },
};

const cueAudioCache = new Map<InteractionCue, HTMLAudioElement>();

interface ActivePlayback {
  audio: HTMLAudioElement;
  settle: () => void;
}

let activePlayback: ActivePlayback | null = null;

function getCueAudio(cue: InteractionCue): HTMLAudioElement | null {
  const cached = cueAudioCache.get(cue);
  if (cached) {
    return cached;
  }

  if (typeof Audio === "undefined") {
    return null;
  }

  try {
    const config = INTERACTION_CUE_CONFIG[cue];
    const audio = new Audio(config.src);
    audio.preload = "auto";
    audio.volume = config.volume;
    cueAudioCache.set(cue, audio);
    return audio;
  } catch {
    return null;
  }
}

export function stopInteractionCue(): void {
  const playback = activePlayback;
  if (!playback) {
    return;
  }

  try {
    playback.audio.pause();
    playback.audio.currentTime = 0;
  } catch {
    // no-op: audio is optional
  }
  playback.settle();
}

export function playInteractionCue(cue: InteractionCue): Promise<void> {
  stopInteractionCue();
  const audio = getCueAudio(cue);
  if (!audio) {
    return Promise.resolve();
  }

  try {
    audio.currentTime = 0;
  } catch {
    // Continue: some browser media implementations reject time changes.
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const settle = () => {
      if (settled) {
        return;
      }
      settled = true;
      audio.removeEventListener("ended", settle);
      audio.removeEventListener("error", settle);
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      if (activePlayback?.settle === settle) {
        activePlayback = null;
      }
      resolve();
    };
    const haltAndSettle = () => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // The timeout still releases recording/UI flow when media cleanup fails.
      }
      settle();
    };

    audio.addEventListener("ended", settle);
    audio.addEventListener("error", settle);
    activePlayback = { audio, settle };
    // Boundaries such as recordStart await this promise. Stop late playback at
    // the deadline too, so a cold audio load cannot begin after capture starts.
    timeoutId = setTimeout(haltAndSettle, INTERACTION_CUE_CONFIG[cue].timeoutMs);

    try {
      const playback = audio.play();
      void Promise.resolve(playback).catch(settle);
    } catch {
      settle();
    }
  });
}

// Light vibration. No-op where Vibration API is unsupported (iOS/desktop).
export function vibrateLightly(pattern: number | number[] = 18): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    // no-op
  }
}

// Calm TTS. No-op where speechSynthesis is missing. Caller controls enabling.
// Browser TTS voices are OS/browser-provided — there is no cloud "announcer"
// voice (Naver Clova, etc.) without an API key — so we prefer the clearest,
// most measured system voice (Google / Microsoft Natural) and slow the pace for
// elderly listeners.
const PREFERRED_VOICE_HINTS = [
  "natural",
  "google",
  "microsoft",
  "sunhi",
  "heami",
  "yunji",
  "naria",
  "nanami",
  "zira",
  "aria",
];

function pickVoice(lang?: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    return null;
  }
  const prefix = lang ? lang.slice(0, 2).toLowerCase() : "";
  const sameLang = prefix
    ? voices.filter((voice) => voice.lang.toLowerCase().startsWith(prefix))
    : voices;
  const pool = sameLang.length > 0 ? sameLang : voices;
  const score = (name: string) => {
    const lower = name.toLowerCase();
    return PREFERRED_VOICE_HINTS.reduce(
      (sum, hint, index) =>
        sum + (lower.includes(hint) ? PREFERRED_VOICE_HINTS.length - index : 0),
      0,
    );
  };
  return [...pool].sort((a, b) => score(b.name) - score(a.name))[0] ?? null;
}

// Prime the voice list on module load — some browsers populate
// speechSynthesis.getVoices() asynchronously, so a warm-up read + the
// voiceschanged event make voices available before the first utterance.
if (typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined") {
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  } catch {
    // no-op
  }
}

export function speakCalmly(text: string, lang?: string): void {
  try {
    if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") {
      return;
    }
    if (!text) {
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang) {
      utterance.lang = lang;
    }
    const voice = pickVoice(lang);
    if (voice) {
      utterance.voice = voice;
    }
    // Slowed for elderly listeners (was 0.92).
    utterance.rate = 0.8;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // no-op
  }
}
