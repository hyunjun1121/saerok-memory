import { twMerge } from "tailwind-merge";

export interface VoiceWaveformProps {
  levels: number[];
  active: boolean;
  barCount?: number;
  className?: string;
  /** Tailwind background class for the bars (default brand color). */
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
  barClassName = "bg-primary-500",
  ariaLabel,
}: VoiceWaveformProps) {
  const bars = levels.length > 0 ? levels : Array.from({ length: barCount }, () => 0);

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
            className={twMerge("w-2.5 rounded-full", barClassName)}
            style={{
              height: `${height}px`,
              transformOrigin: "bottom",
              opacity: active ? 1 : 0.35,
              animation: active
                ? `equalizer ${0.8 + (index % 5) * 0.12}s ease-in-out infinite`
                : undefined,
              animationDelay: `${index * 0.04}s`,
            }}
          />
        );
      })}
    </div>
  );
}
