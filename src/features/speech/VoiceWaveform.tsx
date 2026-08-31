import { twMerge } from "tailwind-merge";

export interface VoiceWaveformProps {
  levels: number[];
  active: boolean;
  barCount?: number;
  className?: string;
  /** Optional Tailwind background override for every bar. */
  barClassName?: string;
  ariaLabel?: string;
}

// Reactive equalizer for the voice memory routine. Bar heights follow the mic
// frequency `levels` (0..1), and a CSS equalizer animation keeps the bars visibly
// alive even during quiet moments — so the learner can tell their voice is being
// captured. When inactive the bars rest low and dim.
export function VoiceWaveform({
  levels,
  active,
  barCount = 24,
  className,
  barClassName,
  ariaLabel,
}: VoiceWaveformProps) {
  const bars = levels.length > 0 ? levels : Array.from({ length: barCount }, () => 0);
  const resolvedBarClassName =
    barClassName ?? (active ? "bg-red-500" : "bg-primary-500");

  return (
    <div
      className={twMerge("flex h-40 items-end justify-center gap-1.5", className)}
      role="img"
      aria-label={ariaLabel}
    >
      {bars.map((level, index) => {
        const height = 10 + Math.max(level, active ? 0.08 : 0) * 140;
        return (
          <span
            key={index}
            className={twMerge("w-2.5 rounded-full", resolvedBarClassName)}
            style={{
              height: `${height}px`,
              transformOrigin: "bottom",
              opacity: active ? 1 : 0.35,
              animationName: active ? "equalizer" : "none",
              animationDuration: `${0.8 + (index % 5) * 0.12}s`,
              animationTimingFunction: "ease-in-out",
              animationIterationCount: active ? "infinite" : 1,
              animationDelay: active ? `${index * 0.04}s` : "0s",
            }}
          />
        );
      })}
    </div>
  );
}
