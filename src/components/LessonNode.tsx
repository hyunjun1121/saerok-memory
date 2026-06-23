import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { Check, Lock, RefreshCw, Star, Image as ImageIcon } from "lucide-react";

export type LessonNodeState =
  | "completed"
  | "current"
  | "locked"
  | "review_due"
  | "bonus"
  | "family_memory";

export interface LessonNodeProps {
  id: string;
  state: LessonNodeState;
  icon?: ReactNode;
  label?: string;
  position: "left" | "center" | "right";
  onPress: (id: string) => void;
  className?: string;
}

export function LessonNode({
  id,
  state,
  icon,
  label,
  position,
  onPress,
  className,
}: LessonNodeProps) {
  const isLocked = state === "locked";

  const stateConfig = {
    completed: {
      bg: "bg-primary-700",
      border: "border-amber-800",
      shadow: "shadow-[0_6px_0_var(--color-amber-800)]",
      text: "text-white",
      defaultIcon: <Check size={28} strokeWidth={3} />,
      animate: false,
    },
    current: {
      bg: "bg-primary-700",
      border: "border-amber-800 ring-4 ring-[var(--color-surface-warm)] ring-offset-2",
      shadow: "shadow-[0_6px_0_var(--color-amber-800)]",
      text: "text-white",
      defaultIcon: <Star size={28} strokeWidth={2.5} fill="currentColor" />,
      animate: true,
    },
    locked: {
      bg: "bg-gray-200",
      border: "border-gray-300",
      shadow: "shadow-[0_6px_0_#d1d5db]",
      text: "text-gray-400",
      defaultIcon: <Lock size={28} strokeWidth={2.5} />,
      animate: false,
    },
    review_due: {
      bg: "bg-purple-500",
      border: "border-purple-700",
      shadow: "shadow-[0_6px_0_#7e22ce]",
      text: "text-white",
      defaultIcon: <RefreshCw size={28} strokeWidth={2.5} />,
      animate: true,
    },
    bonus: {
      bg: "bg-yellow-400",
      border: "border-yellow-600",
      shadow: "shadow-[0_6px_0_#ca8a04]",
      text: "text-white",
      defaultIcon: <Star size={28} strokeWidth={2.5} fill="currentColor" />,
      animate: true,
    },
    family_memory: {
      bg: "bg-orange-400",
      border: "border-orange-600",
      shadow: "shadow-[0_6px_0_#ea580c]",
      text: "text-white",
      defaultIcon: <ImageIcon size={28} strokeWidth={2.5} />,
      animate: false,
    },
  }[state];

  const positionClasses = {
    left: "-translate-x-12",
    center: "translate-x-0",
    right: "translate-x-12",
  };

  return (
    <div className={twMerge("flex flex-col items-center justify-center my-6", className)}>
      <button
        onClick={() => onPress(id)}
        disabled={isLocked}
        className={twMerge(
          "relative flex items-center justify-center rounded-full border-2 transition-all active:translate-y-1 active:shadow-none select-none",
          "w-20 h-20 min-w-[64px] min-h-[64px]",
          stateConfig.bg,
          stateConfig.border,
          stateConfig.shadow,
          stateConfig.text,
          positionClasses[position],
          stateConfig.animate ? "animate-pulseSlow" : "",
          isLocked ? "pointer-events-none" : ""
        )}
      >
        {!isLocked && (
          <div className="absolute top-[8%] left-[15%] right-[15%] h-1/4 bg-white/20 rounded-full" />
        )}
        {icon || stateConfig.defaultIcon}
      </button>

      {label && (
        <span
          className={twMerge(
            "mt-4 text-lg font-bold text-ink drop-shadow-sm",
            positionClasses[position]
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
