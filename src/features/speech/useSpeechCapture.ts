import { useCallback, useEffect, useRef, useState } from "react";
import { getSpeechLanguage } from "@/utils/localizedText";

// Defensive Web Speech Recognition typing. The real API is non-standard and
// absent in many browsers / SSR / jsdom, so every path here must degrade to a
// safe no-op and never block routine completion.
type SpeechRecognitionAlternativeResult = { 0: { transcript: string } };
type SpeechRecognitionEventLike = Event & {
  results: { length: number } & Record<number, SpeechRecognitionAlternativeResult>;
};
type SpeechRecognitionErrorLike = Event & { error?: string };
type SpeechRecognitionLike = EventTarget & {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: (event: SpeechRecognitionEventLike) => void;
  onerror: (event: SpeechRecognitionErrorLike) => void;
  onend: () => void;
};
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

// SP-05: cap speech length so capture never runs forever. 60s is generous for
// a short routine utterance; the cap auto-stops capture and still records the
// elapsed duration.
const MAX_DURATION_MS = 60000;
export const SPEECH_BAR_COUNT = 24;

export interface SpeechCapture {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  levels: number[];
  error: string | null;
  durationMs: number;
  audioAssetUrl: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { webkitAudioContext?: AudioContextCtor };
  if (typeof AudioContext !== "undefined") return AudioContext;
  return w.webkitAudioContext ?? null;
}

function getRecognitionConstructor():
  | (new () => SpeechRecognitionLike)
  | null {
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as SpeechRecognitionWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function mediaRecorderAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

export function useSpeechCapture(language?: string): SpeechCapture {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [levels, setLevels] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [audioAssetUrl, setAudioAssetUrl] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Speech capture is "supported" when EITHER the Web Speech Recognition API is
  // present OR a MediaRecorder + getUserMedia fallback path exists. The latter
  // covers Chromium-based browsers that lack SpeechRecognition — start() then
  // records audio and drives a reactive waveform via MediaRecorder + Analyser.
  const isSupported = getRecognitionConstructor() !== null || mediaRecorderAvailable();

  const clearMaxTimer = useCallback(() => {
    if (maxTimerRef.current !== null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const clearRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Release the mic stream + analyser graph. MediaRecorder is stopped by the
  // caller; its onstop finalizes the audio blob.
  const teardownAudio = useCallback(() => {
    clearRaf();
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    analyserRef.current = null;
    if (ctx) {
      try {
        void ctx.close();
      } catch {
        // no-op
      }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, [clearRaf]);

  const stop = useCallback(() => {
    clearMaxTimer();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;

    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // no-op
      }
    }

    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        teardownAudio();
      }
    } else {
      teardownAudio();
    }

    if (startedAtRef.current !== null) {
      setDurationMs(Date.now() - startedAtRef.current);
      startedAtRef.current = null;
    }
    setIsListening(false);
    setLevels([]);
  }, [clearMaxTimer, teardownAudio]);

  // SP-05: auto-stop capture after MAX_DURATION_MS so it never runs forever.
  const armMaxTimer = useCallback(() => {
    clearMaxTimer();
    maxTimerRef.current = window.setTimeout(() => {
      maxTimerRef.current = null;
      stop();
    }, MAX_DURATION_MS);
  }, [clearMaxTimer, stop]);

  // Open the mic stream → AnalyserNode (reactive waveform levels) + MediaRecorder
  // (audio asset for later STT). rAF loop is a plain closure inside .then()
  // (a self-referential useCallback trips react-hooks/immutability). Safe no-op
  // where mic APIs are absent.
  const openStream = useCallback(() => {
    if (!mediaRecorderAvailable() || mediaStreamRef.current) {
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        mediaStreamRef.current = stream;

        const Ctor = getAudioContextCtor();
        if (Ctor) {
          try {
            const ctx = new Ctor();
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            audioCtxRef.current = ctx;
            analyserRef.current = analyser;
            const freq = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
            clearRaf();
            const loop = () => {
              analyser.getByteFrequencyData(freq);
              const step = Math.max(1, Math.floor(freq.length / SPEECH_BAR_COUNT));
              const bins: number[] = [];
              for (let i = 0; i < SPEECH_BAR_COUNT; i += 1) {
                let sum = 0;
                let count = 0;
                for (let j = 0; j < step; j += 1) {
                  const idx = i * step + j;
                  if (idx < freq.length) {
                    sum += freq[idx];
                    count += 1;
                  }
                }
                bins.push(count ? sum / count / 255 : 0);
              }
              setLevels(bins);
              rafRef.current = requestAnimationFrame(loop);
            };
            rafRef.current = requestAnimationFrame(loop);
          } catch {
            // analyser optional; recording can still continue below
          }
        }

        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream);
        } catch {
          teardownAudio();
          return;
        }
        const chunks: Blob[] = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        recorder.onstop = () => {
          if (chunks.length > 0) {
            const blob = new Blob(chunks, {
              type: recorder.mimeType || "audio/webm",
            });
            setAudioAssetUrl(URL.createObjectURL(blob));
          }
          teardownAudio();
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
      })
      .catch(() => {
        // getUserMedia denied / unavailable. Listening stays on (sticky) so the
        // waveform UI still reads as "recording"; recognition may still run.
      });
  }, [clearRaf, teardownAudio]);

  const start = useCallback(() => {
    // Optimistic + sticky: flip the listening UI on the instant the learner
    // taps and keep it on until they tap stop. Recognition end/error no longer
    // unset it. Skipped when entirely unsupported (SP-04 no-op contract).
    if (isSupported) {
      setIsListening(true);
    }

    setError(null);
    setTranscript("");
    setLevels([]);
    setDurationMs(0);
    setAudioAssetUrl(null);
    startedAtRef.current = Date.now();

    // Always open the mic (analyser + recorder) when possible — this is what
    // drives the reactive waveform the learner sees.
    openStream();

    // Best-effort transcript via Web Speech Recognition (absent in Chromium
    // headless / some browsers). Its callbacks never unset isListening.
    const Ctor = getRecognitionConstructor();
    if (Ctor && !recognitionRef.current) {
      try {
        const recognition = new Ctor();
        recognition.lang = getSpeechLanguage(language);
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
          const fragments: string[] = [];
          for (let i = 0; i < event.results.length; i += 1) {
            const transcriptPart = event.results[i]?.[0]?.transcript;
            if (transcriptPart) {
              fragments.push(transcriptPart);
            }
          }
          const text = fragments.join(" ").trim();
          if (text) {
            setTranscript((prev) => (prev ? `${prev} ${text}` : text));
          }
        };

        recognition.onerror = (event) => {
          setError(event.error ?? "speech-error");
          recognitionRef.current = null;
        };

        recognition.onend = () => {
          recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch {
        recognitionRef.current = null;
      }
    }

    if (isSupported) {
      armMaxTimer();
    }
  }, [language, armMaxTimer, isSupported, openStream]);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
    setDurationMs(0);
  }, []);

  useEffect(() => {
    return () => {
      clearMaxTimer();
      clearRaf();
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        try {
          recognition.abort?.();
        } catch {
          // no-op
        }
      }
      const recorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // no-op
        }
      }
      teardownAudio();
    };
  }, [clearMaxTimer, clearRaf, teardownAudio]);

  return {
    isSupported,
    isListening,
    transcript,
    levels,
    error,
    durationMs,
    audioAssetUrl,
    start,
    stop,
    reset,
  };
}
