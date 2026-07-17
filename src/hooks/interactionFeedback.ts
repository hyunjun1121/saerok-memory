// Defensive interaction-feedback primitives (tap tone, success tone, vibration,
// calm speech). Every function is a safe no-op when the browser API is missing,
// so routines stay completable without audio/haptics. Sound is *additive* —
// choice/answer state is always conveyed by text, icon, and border too.

interface WebkitAudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (sharedAudioContext) {
    return sharedAudioContext;
  }

  try {
    const Ctor = window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext;
    if (!Ctor) {
      return null;
    }
    sharedAudioContext = new Ctor();
    return sharedAudioContext;
  } catch {
    return null;
  }
}

function playTone(frequency: number, durationMs: number, gainValue: number): void {
  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  try {
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  } catch {
    // no-op: audio is optional
  }
}

// Soft, short confirmation for a tap/selection.
export function playSoftTapTone(): void {
  playTone(520, 120, 0.05);
}

// Gentle ascending success cue for a correct/complete action.
export function playSoftSuccessTone(): void {
  playTone(587, 130, 0.06);
  window.setTimeout(() => playTone(784, 170, 0.05), 90);
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
