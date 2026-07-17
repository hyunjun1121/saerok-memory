import { twMerge } from "tailwind-merge";

export interface MascotBubbleProps {
  mood: "happy" | "thinking" | "encouraging" | "calm" | "praising";
  message: string;
  showMascot?: boolean;
  mascotSrc?: string;
  frameless?: boolean;
  className?: string;
}

export function MascotBubble({
  mood,
  message,
  showMascot = true,
  mascotSrc = "/assets/haru/mascot.png",
  frameless = false,
  className,
}: MascotBubbleProps) {
  const moodConfig = {
    happy: {
      bubbleBorder: "border-yellow-200",
      bubbleBg: "bg-yellow-50",
    },
    thinking: {
      bubbleBorder: "border-blue-200",
      bubbleBg: "bg-blue-50",
    },
    encouraging: {
      bubbleBorder: "border-amber-200",
      bubbleBg: "bg-amber-50",
    },
    calm: {
      bubbleBorder: "border-primary-200",
      bubbleBg: "bg-primary-50",
    },
    praising: {
      bubbleBorder: "border-amber-300",
      bubbleBg: "bg-amber-50",
    },
  };

  const config = moodConfig[mood];

  return (
    <div className={twMerge("flex items-end gap-4", className)}>
      {showMascot &&
        (frameless ? (
          <img
            src={mascotSrc}
            alt=""
            className="shrink-0 h-28 w-28 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.18)]"
          />
        ) : (
          <div className="flex shrink-0 items-center justify-center w-16 h-16 overflow-hidden rounded-full bg-white border-2 border-primary-200 shadow-sm">
            <img src={mascotSrc} alt="" className="w-14 h-14 object-contain mt-2" />
          </div>
        ))}

      <div className="relative">
        {showMascot && (
          <div
            className={twMerge(
              "absolute -left-3 bottom-4 w-4 h-4 border-l-2 border-b-2 bg-inherit transform rotate-45 z-10",
              config.bubbleBorder,
              config.bubbleBg
            )}
          />
        )}
        <div
          role="status"
          aria-live="polite"
          className={twMerge(
            "relative px-5 py-4 rounded-2xl border-2 text-xl font-bold text-ink shadow-sm z-20",
            config.bubbleBorder,
            config.bubbleBg
          )}
        >
          {message}
        </div>
      </div>
    </div>
  );
}
