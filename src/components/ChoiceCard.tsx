import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { Check, RotateCcw } from "lucide-react";

export interface ChoiceCardProps {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  state: "idle" | "selected" | "correct" | "incorrect" | "disabled";
  onSelect: (id: string) => void;
  className?: string;
}

export function ChoiceCard({
  id,
  label,
  description,
  icon,
  state,
  onSelect,
  className,
}: ChoiceCardProps) {
  const baseClasses =
    "relative flex items-center min-h-[64px] w-full rounded-2xl border-2 px-5 py-4 text-left transition-all active:scale-[0.99] select-none";

  const stateClasses = {
    idle: "border-gray-300 bg-white text-ink hover:bg-gray-50",
    selected: "border-blue-500 bg-blue-50 text-ink",
    correct: "border-primary-600 bg-primary-50 text-ink scale-[1.02]",
    incorrect: "border-red-500 bg-red-50 text-ink animate-[shake_0.4s_ease-in-out]",
    disabled: "border-gray-200 bg-gray-100 text-gray-400 pointer-events-none",
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      disabled={state === "disabled" || state === "correct"}
      className={twMerge(baseClasses, stateClasses[state], className)}
    >
      <div className="flex-1">
        <div className="flex items-center gap-3">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <div className="flex flex-col">
            <span className="text-lg font-semibold">{label}</span>
            {description && (
              <span className="text-sm text-gray-500 font-medium mt-1">
                {description}
              </span>
            )}
          </div>
        </div>
      </div>

      {state === "correct" && (
        <span className="flex-shrink-0 ml-3 text-primary-600">
          <Check size={24} strokeWidth={3} />
        </span>
      )}
      {state === "incorrect" && (
        <span className="flex-shrink-0 ml-3 text-red-500">
          <RotateCcw size={24} strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}
