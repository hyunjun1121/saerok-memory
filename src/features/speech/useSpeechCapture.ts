import { useCallback, useEffect, useRef, useState } from "react";
import { getSpeechLanguage } from "../../utils/localizedText";

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

export interface SpeechCapture {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  error: string | null;
  durationMs: number;
  audioAssetUrl: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
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
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [audioAssetUrl, setAudioAssetUrl] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const isSupported = getRecognitionConstructor() !== null;

  const clearMaxTimer = useCallback(() => {
    if (maxTimerRef.current !== null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

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
        // no-op
      }
    }

    if (startedAtRef.current !== null) {
      setDurationMs(Date.now() - startedAtRef.current);
      startedAtRef.current = null;
    }
    setIsListening(false);
  }, [clearMaxTimer]);

  // SP-05: auto-stop capture after MAX_DURATION_MS so it never runs forever.
  // stop is captured by closure (stable useCallback), keeping this memo stable.
  const armMaxTimer = useCallback(() => {
    clearMaxTimer();
    maxTimerRef.current = window.setTimeout(() => {
      maxTimerRef.current = null;
      stop();
    }, MAX_DURATION_MS);
  }, [clearMaxTimer, stop]);

  // SP-05: when SpeechRecognition is unavailable or fails to construct, record
  // audio via MediaRecorder so the routine keeps an audio record and never
  // breaks. Everything degrades to a no-op if getUserMedia is missing too.
  const startMediaRecorderFallback = useCallback(() => {
    if (!mediaRecorderAvailable() || mediaRecorderRef.current) {
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        mediaStreamRef.current = stream;
        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream);
        } catch {
          stream.getTracks().forEach((track) => track.stop());
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
          stream.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        };

        mediaRecorderRef.current = recorder;
        startedAtRef.current = Date.now();
        setError(null);
        setTranscript("");
        setDurationMs(0);
        setAudioAssetUrl(null);
        recorder.start();
        setIsListening(true);
        armMaxTimer();
      })
      .catch(() => {
        // getUserMedia denied / unavailable — routine continues via typed input.
      });
  }, [armMaxTimer]);

  const start = useCallback(() => {
    const Ctor = getRecognitionConstructor();
    if (!Ctor || recognitionRef.current) {
      startMediaRecorderFallback();
      return;
    }

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
        clearMaxTimer();
        setError(event.error ?? "speech-error");
        recognitionRef.current = null;
        setIsListening(false);
        if (startedAtRef.current !== null) {
          setDurationMs(Date.now() - startedAtRef.current);
          startedAtRef.current = null;
        }
      };

      recognition.onend = () => {
        clearMaxTimer();
        recognitionRef.current = null;
        setIsListening(false);
        if (startedAtRef.current !== null) {
          setDurationMs(Date.now() - startedAtRef.current);
          startedAtRef.current = null;
        }
      };

      recognitionRef.current = recognition;
      startedAtRef.current = Date.now();
      setError(null);
      setTranscript("");
      setDurationMs(0);
      setAudioAssetUrl(null);
      recognition.start();
      setIsListening(true);
      armMaxTimer();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      startMediaRecorderFallback();
    }
  }, [language, armMaxTimer, clearMaxTimer, startMediaRecorderFallback]);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
    setDurationMs(0);
  }, []);

  useEffect(() => {
    return () => {
      clearMaxTimer();
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
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [clearMaxTimer]);

  return {
    isSupported,
    isListening,
    transcript,
    error,
    durationMs,
    audioAssetUrl,
    start,
    stop,
    reset,
  };
}
