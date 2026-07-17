import { useState } from "react";
import { ChoiceCard } from "@/components/ChoiceCard";
import { useTranslation } from "react-i18next";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";

interface Option {
  id: string;
  label: string;
}

interface SituationMatchProps {
  prompt: string;
  options: Option[];
  correctOptionId: string;
  explanation?: string;
  onComplete: () => void;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

export function SituationMatch({
  prompt,
  options,
  correctOptionId,
  setGlobalState,
  globalState,
}: SituationMatchProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [missCount, setMissCount] = useState(0);

  // Evaluate the moment a choice is tapped — no separate confirm step.
  const handleSelect = (id: string) => {
    if (
      globalState === "correct_feedback" ||
      globalState === "incorrect_feedback" ||
      globalState === "hint_feedback"
    ) {
      return;
    }

    setSelectedId(id);

    if (id === correctOptionId) {
      setGlobalState("correct_feedback");
      return;
    }

    const newMissCount = missCount + 1;
    setMissCount(newMissCount);
    setGlobalState(newMissCount === 1 ? "hint_feedback" : "incorrect_feedback");
  };

  return (
    <div className="flex flex-col w-full gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-blue-500 uppercase tracking-wide">
          {t("exercise.situationMatch.prompt")}
        </span>
        <h2 className="text-3xl font-extrabold text-ink leading-snug">{prompt}</h2>
      </div>

      <div className="flex flex-col gap-4">
        {options.map((option) => {
          let state: "idle" | "selected" | "correct" | "incorrect" | "disabled" = "idle";

          if (globalState === "correct_feedback") {
            if (option.id === correctOptionId) state = "correct";
            else state = "disabled";
          } else if (
            (globalState === "incorrect_feedback" || globalState === "hint_feedback") &&
            selectedId === option.id
          ) {
            state = "incorrect";
          } else if (
            globalState === "incorrect_feedback" ||
            globalState === "hint_feedback"
          ) {
            state = "disabled";
          }

          return (
            <ChoiceCard
              key={option.id}
              id={option.id}
              label={option.label}
              state={state}
              onSelect={handleSelect}
            />
          );
        })}
      </div>
    </div>
  );
}
