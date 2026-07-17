import { useCallback, useEffect, useRef, useState } from "react";

// Voice recorder for the daily memory routine. It records mic audio and exposes
// a live frequency `levels` feed so the UI can render a reactive waveform, plus
// `stopAndGetBlob()` which resolves with the captured audio Blob (once
// MediaRecorder finalizes it) for upload to the STT backend (features/speech/stt.ts).
// Everything degrades to a safe no-op where mic APIs are absent (jsdom, denied
// permission) so the routine never blocks.
const DEFAULT_MAX_DURATION_MS = 60_000;
export const VOICE_BAR_COUNT = 24;

export interface VoiceRecorder {
  isSupported: boolean;
  isRecording: boolean;
  isFinalizing: boolean;
  levels: number[];
  durationMs: number;
  audioAssetUrl: string | null;
  sampleRateHz: number | null;
  channelCount: number | null;
  error: string | null;
  start: () => void;
  stop: () => void;
  getDurationMs: () => number;
  /** Stop the recorder and resolve with the captured audio Blob (or null). */
  stopAndGetBlob: () => Promise<Blob | null>;
}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { webkitAudioContext?: AudioContextCtor };
  if (typeof AudioContext !== "undefined") return AudioContext;
  return w.webkitAudioContext ?? null;
}

function recorderAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined" &&
    getAudioContextCtor() !== null
  );
}

export function useVoiceRecorder(maxDurationMs = DEFAULT_MAX_DURATION_MS): VoiceRecorder {
  const [isRecording, setIsRecording] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);
  const [durationMs, setDurationMs] = useState(0);
  const [audioAssetUrl, setAudioAssetUrl] = useState<string | null>(null);
  const [sampleRateHz, setSampleRateHz] = useState<number | null>(null);
  const [channelCount, setChannelCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const startGenerationRef = useRef(0);
  const isMountedRef = useRef(true);
  const finalizationPromiseRef = useRef<Promise<Blob | null> | null>(null);
  const finalizationResolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const freqRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const durationMsRef = useRef(0);
  const maxTimerRef = useRef<number | null>(null);

  const isSupported = recorderAvailable();

  const clearRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const clearMaxTimer = useCallback(() => {
    if (maxTimerRef.current !== null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  // Release the mic stream + analyser graph. The MediaRecorder is stopped by the
  // caller; its onstop finalizes the audio blob.
  const teardownAudio = useCallback(() => {
    clearRaf();
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    analyserRef.current = null;
    freqRef.current = null;
    if (ctx) {
      try {
        void ctx.close();
      } catch {
        // no-op
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, [clearRaf]);

  const resolveFinalization = useCallback((blob: Blob | null) => {
    const resolve = finalizationResolveRef.current;
    finalizationResolveRef.current = null;
    finalizationPromiseRef.current = null;
    resolve?.(blob);
  }, []);

  const cancelPendingStart = useCallback(() => {
    startGenerationRef.current += 1;
    startPromiseRef.current = null;
  }, []);

  const stop = useCallback(() => {
    cancelPendingStart();
    clearMaxTimer();
    clearRaf();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        setIsFinalizing(true);
        recorder.stop(); // onstop finalizes audio + tears down the stream
      } catch {
        recorderRef.current = null;
        setIsFinalizing(false);
        teardownAudio();
        resolveFinalization(null);
      }
    } else if (!recorder || !finalizationPromiseRef.current) {
      recorderRef.current = null;
      teardownAudio();
    }
    if (startedAtRef.current !== null) {
      durationMsRef.current = Date.now() - startedAtRef.current;
      setDurationMs(durationMsRef.current);
      startedAtRef.current = null;
    }
    setIsRecording(false);
    setLevels([]);
  }, [cancelPendingStart, clearMaxTimer, clearRaf, resolveFinalization, teardownAudio]);

  // Stop the recorder and resolve with the captured audio Blob once onstop
  // finalizes it. The memory-story flow awaits this to upload audio to the STT
  // backend. Resolves immediately (with any prior blob) if not recording.
  const stopAndGetBlob = useCallback((): Promise<Blob | null> => {
    const pendingFinalization = finalizationPromiseRef.current;
    stop();
    return pendingFinalization ?? Promise.resolve(audioBlobRef.current);
  }, [stop]);

  const getDurationMs = useCallback(() => durationMsRef.current, []);

  // rAF loop runs as a plain closure inside start() (a self-referential
  // useCallback trips react-hooks/immutability). It reads frequency data,
  // downsamples to VOICE_BAR_COUNT bins (0..1), and feeds the waveform.
  const start = useCallback(() => {
    if (
      !recorderAvailable() ||
      recorderRef.current ||
      streamRef.current ||
      startPromiseRef.current
    ) {
      return;
    }
    const startGeneration = startGenerationRef.current + 1;
    startGenerationRef.current = startGeneration;
    setLevels([]);
    setError(null);
    setIsFinalizing(false);
    setDurationMs(0);
    durationMsRef.current = 0;
    setAudioAssetUrl(null);
    setSampleRateHz(null);
    setChannelCount(null);
    audioBlobRef.current = null;
    finalizationPromiseRef.current = null;
    finalizationResolveRef.current = null;

    const startPromise = navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          // Preserve soft elderly speech. Backend whole-utterance activity
          // detection rejects no-response audio without trimming pauses; browser
          // AGC/noise suppression can erase low-volume consonants before upload.
          autoGainControl: false,
          noiseSuppression: false,
        },
      })
      .then((stream) => {
        if (!isMountedRef.current || startGenerationRef.current !== startGeneration) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const trackSettings = stream.getAudioTracks?.()[0]?.getSettings?.();
        const trackSampleRate = trackSettings?.sampleRate;
        const trackChannelCount = trackSettings?.channelCount;
        if (
          typeof trackSampleRate === "number" &&
          Number.isFinite(trackSampleRate) &&
          trackSampleRate > 0
        ) {
          setSampleRateHz(Math.round(trackSampleRate));
        }
        if (
          typeof trackChannelCount === "number" &&
          Number.isFinite(trackChannelCount) &&
          trackChannelCount > 0
        ) {
          setChannelCount(Math.round(trackChannelCount));
        }

        const Ctor = getAudioContextCtor();
        if (Ctor) {
          try {
            const ctx = new Ctor();
            if (
              !(typeof trackSampleRate === "number" && trackSampleRate > 0) &&
              Number.isFinite(ctx.sampleRate) &&
              ctx.sampleRate > 0
            ) {
              setSampleRateHz(Math.round(ctx.sampleRate));
            }
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            audioCtxRef.current = ctx;
            analyserRef.current = analyser;
            const freq = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
            freqRef.current = freq;
            clearRaf();
            const loop = () => {
              analyser.getByteFrequencyData(freq);
              const step = Math.max(1, Math.floor(freq.length / VOICE_BAR_COUNT));
              const bins: number[] = [];
              for (let i = 0; i < VOICE_BAR_COUNT; i += 1) {
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
            teardownAudio();
            setError("audio-unavailable");
            return;
          }
        }

        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream);
        } catch {
          teardownAudio();
          setError("audio-unavailable");
          return;
        }
        const chunks: Blob[] = [];
        finalizationPromiseRef.current = new Promise((resolve) => {
          finalizationResolveRef.current = resolve;
        });
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = () => {
          recorderRef.current = null;
          let blob: Blob | null = null;
          if (chunks.length > 0) {
            blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
            audioBlobRef.current = blob;
            setAudioAssetUrl(URL.createObjectURL(blob));
          }
          teardownAudio();
          setIsFinalizing(false);
          resolveFinalization(blob);
        };
        recorderRef.current = recorder;
        startedAtRef.current = Date.now();
        try {
          recorder.start();
        } catch {
          recorderRef.current = null;
          teardownAudio();
          resolveFinalization(null);
          setError("audio-unavailable");
          return;
        }
        setIsRecording(true);
        clearMaxTimer();
        const safeMaxDurationMs = Math.min(Math.max(maxDurationMs, 5_000), 60_000);
        maxTimerRef.current = window.setTimeout(() => {
          maxTimerRef.current = null;
          stop();
        }, safeMaxDurationMs);
      })
      .catch(() => {
        if (!isMountedRef.current || startGenerationRef.current !== startGeneration) {
          return;
        }
        teardownAudio();
        setError("mic-denied");
      })
      .finally(() => {
        if (startGenerationRef.current === startGeneration) {
          startPromiseRef.current = null;
        }
      });
    startPromiseRef.current = startPromise;
  }, [clearMaxTimer, clearRaf, maxDurationMs, resolveFinalization, teardownAudio, stop]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cancelPendingStart();
      clearMaxTimer();
      clearRaf();
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.ondataavailable = null;
          recorder.onstop = null;
          recorder.stop();
        } catch {
          // no-op
        }
      }
      resolveFinalization(null);
      teardownAudio();
    };
  }, [cancelPendingStart, clearMaxTimer, clearRaf, resolveFinalization, teardownAudio]);

  return {
    isSupported,
    isRecording,
    isFinalizing,
    levels,
    durationMs,
    audioAssetUrl,
    sampleRateHz,
    channelCount,
    error,
    start,
    stop,
    getDurationMs,
    stopAndGetBlob,
  };
}
