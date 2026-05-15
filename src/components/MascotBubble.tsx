import { twMerge } from "tailwind-merge";
import { MessageCircle, Heart, Sparkles, Coffee } from "lucide-react";

export interface MascotBubbleProps {
  mood: "happy" | "thinking" | "encouraging" | "calm";
  message: string;
  showMascot?: boolean;
  className?: string;
}

export function MascotBubble({
  mood,
  message,
  showMascot = true,
  className,
}: MascotBubbleProps) {
  const moodConfig = {
    happy: {
      icon: <Sparkles className="w-8 h-8 text-yellow-500" />,
      bubbleBorder: "border-yellow-200",
      bubbleBg: "bg-yellow-50",
    },
    thinking: {
      icon: <MessageCircle className="w-8 h-8 text-blue-500" />,
      bubbleBorder: "border-blue-200",
      bubbleBg: "bg-blue-50",
    },
    encouraging: {
      icon: <Heart className="w-8 h-8 text-red-400" />,
      bubbleBorder: "border-red-200",
      bubbleBg: "bg-red-50",
    },
    calm: {
      icon: <Coffee className="w-8 h-8 text-primary-500" />,
      bubbleBorder: "border-primary-200",
      bubbleBg: "bg-primary-50",
    },
  };

  const config = moodConfig[mood];

  return (
    <div className={twMerge("flex items-end gap-4", className)}>
      {showMascot && (
        <div className="flex shrink-0 items-center justify-center w-16 h-16 rounded-full bg-white border-2 border-gray-200 shadow-sm">
          {config.icon}
        </div>
      )}

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
          className={twMerge(
            "relative px-5 py-4 rounded-2xl border-2 text-lg font-medium text-ink shadow-sm z-20",
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
