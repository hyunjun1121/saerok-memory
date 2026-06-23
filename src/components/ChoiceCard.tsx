import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { twMerge } from "tailwind-merge";
import { Check, RotateCcw } from "lucide-react";
import { useInteractionFeedback } from "../hooks/useInteractionFeedback";

export type ChoiceCardState =
  | "idle"
  | "selected"
  | "correct"
  | "incorrect"
  | "disabled";

export interface ChoiceCardProps {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  state: ChoiceCardState;
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
  const { t } = useTranslation();
  const { tap } = useInteractionFeedback();

  const baseClasses =
    "relative flex items-center min-h-[64px] w-full rounded-2xl border-[3px] px-5 py-4 text-left transition-all active:scale-[0.97] active:translate-y-[1px] select-none";

  const stateClasses: Record<ChoiceCardState, string> = {
    idle: "border-gray-300 bg-white text-ink hover:bg-gray-50",
    selected: "border-amber-700 bg-amber-50 text-ink ring-4 ring-amber-200",
    correct: "border-primary-600 bg-primary-50 text-ink scale-[1.02] ring-4 ring-primary-200",
    incorrect: "border-red-500 bg-red-50 text-ink animate-[shake_0.4s_ease-in-out]",
    disabled: "border-gray-200 bg-gray-100 text-gray-400 pointer-events-none",
  };

  const isPressed = state === "selected" || state === "correct";
  const statusText =
    state === "selected"
      ? t("choice.state.selected", "선택됨")
      : state === "correct"
        ? t("choice.state.correct", "완료")
        : state === "incorrect"
          ? t("choice.state.incorrect", "다시 눌러보기")
          : "";

  const handleSelect = () => {
    tap();
    onSelect(id);
  };

  return (
    <button
      type="button"
      onClick={handleSelect}
      disabled={state === "disabled" || state === "correct"}
      aria-pressed={isPressed}
      className={twMerge(baseClasses, stateClasses[state], className)}
    >
      <div className="flex-1">
        <div className="flex items-center gap-3">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <div className="flex flex-col">
            <span className="text-xl font-bold leading-snug">{label}</span>
            {description && (
              <span className="text-base text-gray-700 font-medium mt-1">
                {description}
              </span>
            )}
          </div>
        </div>
      </div>

      {statusText && (
        <span
          className="ml-3 flex-shrink-0 rounded-full bg-white/80 px-3 py-1 text-sm font-extrabold text-ink shadow-sm"
          aria-hidden="true"
        >
          {statusText}
        </span>
      )}

      {(state === "selected" || state === "correct") && (
        <span className="flex-shrink-0 ml-2 text-amber-700" aria-hidden="true">
          <Check size={24} strokeWidth={3} />
        </span>
      )}
      {state === "incorrect" && (
        <span className="flex-shrink-0 ml-2 text-red-500">
          <RotateCcw size={24} strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}
