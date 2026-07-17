import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { twMerge } from "tailwind-merge";
import { Check, RotateCcw } from "lucide-react";
import { useInteractionFeedback } from "@/hooks/useInteractionFeedback";

export type ChoiceCardState =
  | "idle"
  | "selected"
  | "correct"
  | "incorrect"
  | "disabled";

export type ChoiceCardLayout = "row" | "tile";
export type ChoiceCardTone = "neutral" | "red" | "yellow" | "green" | "blue";

export interface ChoiceCardProps {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  state: ChoiceCardState;
  onSelect: (id: string) => void;
  className?: string;
  layout?: ChoiceCardLayout;
  keyboardShortcut?: string;
  tone?: ChoiceCardTone;
}

const choiceToneClasses: Record<
  ChoiceCardTone,
  Record<Extract<ChoiceCardState, "idle" | "selected">, string>
> = {
  neutral: {
    idle: "border-gray-300 bg-white text-ink hover:bg-gray-50",
    selected:
      "border-amber-700 bg-amber-50 text-ink scale-[1.02] ring-4 ring-amber-200 motion-reduce:scale-100",
  },
  red: {
    idle: "border-red-500 bg-red-50 text-red-950 hover:bg-red-100",
    selected:
      "border-red-800 bg-red-200 text-red-950 scale-[1.02] ring-4 ring-red-300 motion-reduce:scale-100",
  },
  yellow: {
    idle: "border-yellow-700 bg-yellow-50 text-yellow-950 hover:bg-yellow-100",
    selected:
      "border-yellow-800 bg-yellow-200 text-yellow-950 scale-[1.02] ring-4 ring-yellow-300 motion-reduce:scale-100",
  },
  green: {
    idle: "border-green-600 bg-green-50 text-green-950 hover:bg-green-100",
    selected:
      "border-green-800 bg-green-200 text-green-950 scale-[1.02] ring-4 ring-green-300 motion-reduce:scale-100",
  },
  blue: {
    idle: "border-blue-600 bg-blue-50 text-blue-950 hover:bg-blue-100",
    selected:
      "border-blue-800 bg-blue-200 text-blue-950 scale-[1.02] ring-4 ring-blue-300 motion-reduce:scale-100",
  },
};

const selectedIndicatorClasses: Record<ChoiceCardTone, string> = {
  neutral: "text-amber-700",
  red: "text-red-900",
  yellow: "text-yellow-900",
  green: "text-green-900",
  blue: "text-blue-900",
};

export function ChoiceCard({
  id,
  label,
  description,
  icon,
  state,
  onSelect,
  className,
  layout = "row",
  keyboardShortcut,
  tone = "neutral",
}: ChoiceCardProps) {
  const { t } = useTranslation();
  const { tap } = useInteractionFeedback();
  const isTile = layout === "tile";

  const baseClasses =
    "relative flex min-h-[64px] w-full items-center rounded-2xl border-[3px] transition-transform duration-200 ease-out active:scale-[0.97] active:translate-y-[1px] motion-reduce:transform-none motion-reduce:transition-none select-none";
  const layoutClasses = isTile
    ? "aspect-square flex-col justify-center px-3 py-3 text-center"
    : "px-5 py-4 text-left";

  const feedbackStateClasses: Record<Exclude<ChoiceCardState, "idle" | "selected">, string> = {
    correct: "border-primary-600 bg-primary-50 text-ink scale-[1.02] ring-4 ring-primary-200",
    incorrect: "border-red-500 bg-red-50 text-ink animate-[shake_0.4s_ease-in-out]",
    disabled: "border-gray-200 bg-gray-100 text-gray-400 pointer-events-none",
  };
  const stateClasses =
    state === "idle" || state === "selected"
      ? choiceToneClasses[tone][state]
      : feedbackStateClasses[state];

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
      aria-keyshortcuts={keyboardShortcut}
      data-choice-tone={tone}
      className={twMerge(baseClasses, layoutClasses, stateClasses, className)}
    >
      <div className={isTile ? "flex w-full flex-none justify-center" : "flex-1"}>
        <div className={`flex items-center gap-3 ${isTile ? "justify-center" : ""}`}>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <div className={`flex flex-col ${isTile ? "items-center" : ""}`}>
            <span
              className={
                isTile
                  ? "text-[clamp(17px,4.4vw,21px)] font-bold leading-tight [overflow-wrap:anywhere]"
                  : "text-xl font-bold leading-snug"
              }
            >
              {label}
            </span>
            {description && (
              <span
                className={`mt-1 font-medium text-gray-700 ${
                  isTile ? "text-[15px] leading-snug [overflow-wrap:anywhere]" : "text-base"
                }`}
              >
                {description}
              </span>
            )}
          </div>
        </div>
      </div>

      {statusText && (
        <span
          className={`flex-shrink-0 rounded-full bg-white/80 py-1 font-extrabold text-ink shadow-sm ${
            isTile ? "mt-3 px-2.5 text-[15px]" : "ml-3 px-3 text-sm"
          }`}
          aria-hidden="true"
        >
          {statusText}
        </span>
      )}

      {(state === "selected" || state === "correct") && (
        <span
          className={`flex-shrink-0 ${
            state === "selected" ? selectedIndicatorClasses[tone] : "text-amber-700"
          } ${
            isTile ? "absolute right-2.5 top-2.5" : "ml-2"
          }`}
          aria-hidden="true"
        >
          <Check size={isTile ? 20 : 24} strokeWidth={3} />
        </span>
      )}
      {state === "incorrect" && (
        <span
          className={`flex-shrink-0 text-red-500 ${
            isTile ? "absolute right-2.5 top-2.5" : "ml-2"
          }`}
          aria-hidden="true"
        >
          <RotateCcw size={isTile ? 20 : 24} strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}
