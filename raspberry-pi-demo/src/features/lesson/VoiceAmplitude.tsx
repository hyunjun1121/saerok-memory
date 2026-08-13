import { useEffect, useRef, useState } from "react";
import { createFallbackVoiceFrame } from "@/features/lesson/fallbackWaveform";

const BAR_COUNT = 19;
const FALLBACK_FRAME_INTERVAL_MS = 72;
const FALLBACK_START_OFFSET_MS = 180;

export interface VoiceAmplitudeProps {
  active: boolean;
  fallbackLabel: string;
}

export function VoiceAmplitude({ active, fallbackLabel }: VoiceAmplitudeProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    if (!active) {
      waveformRef.current?.style.setProperty("--voice-level", "0.08");
      return undefined;
    }

    let disposed = false;
    let frameId = 0;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;

    const enableFallback = () => {
      if (!disposed) setUsingFallback(true);
    };

    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
      enableFallback();
      return undefined;
    }

    void navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false })
      .then((mediaStream) => {
        if (disposed) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        setUsingFallback(false);
        stream = mediaStream;
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.72;
        context.createMediaStreamSource(mediaStream).connect(analyser);
        const samples = new Uint8Array(analyser.frequencyBinCount);
        const update = () => {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) {
            const normalized = (sample - 128) / 128;
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / samples.length);
          const level = Math.min(1, Math.max(0.08, rms * 7));
          waveformRef.current?.style.setProperty("--voice-level", level.toFixed(3));
          frameId = requestAnimationFrame(update);
        };
        update();
      })
      .catch(enableFallback);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((track) => track.stop());
      if (context) void context.close().catch(() => undefined);
    };
  }, [active]);

  useEffect(() => {
    if (!active || !usingFallback || !waveformRef.current) return undefined;

    const waveform = waveformRef.current;
    const bars = [...waveform.querySelectorAll<HTMLElement>("span")];
    const applyFrame = (elapsedMs: number) => {
      const frame = createFallbackVoiceFrame(elapsedMs + FALLBACK_START_OFFSET_MS, bars.length);
      bars.forEach((bar, index) => {
        bar.style.setProperty("--fallback-scale", String(frame[index] ?? 0.08));
      });
    };
    const reduceMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || typeof window.requestAnimationFrame !== "function") {
      applyFrame(540);
      return undefined;
    }

    const startedAt = performance.now();
    let previousFrameAt = startedAt - FALLBACK_FRAME_INTERVAL_MS;
    let frameId = 0;
    const update = (now: number) => {
      if (now - previousFrameAt >= FALLBACK_FRAME_INTERVAL_MS) {
        applyFrame(now - startedAt);
        previousFrameAt = now;
      }
      frameId = window.requestAnimationFrame(update);
    };
    frameId = window.requestAnimationFrame(update);

    return () => window.cancelAnimationFrame(frameId);
  }, [active, usingFallback]);

  return (
    <div
      ref={waveformRef}
      className={`voice-waveform ${active ? "is-active" : ""} ${usingFallback ? "is-fallback" : ""}`}
      data-fallback={usingFallback ? "true" : "false"}
      data-motion={active && usingFallback ? "speech-simulation" : "none"}
      aria-label={usingFallback ? fallbackLabel : undefined}
    >
      {Array.from({ length: BAR_COUNT }, (_, index) => (
        <span
          key={index}
          style={{ "--bar-shape": 0.48 + (index % 5) * 0.11 } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
