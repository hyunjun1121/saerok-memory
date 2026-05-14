import React, { useState } from "react";
import { ChoiceCard } from "../../../components/ChoiceCard";
import { Button3D } from "../../../components/Button3D";
import { useTranslation } from "react-i18next";
import { ExerciseState } from "./types";

interface Option {
  id: string;
  label: string;
}

interface MultipleChoiceMeaningProps {
  prompt: string;
  options: Option[];
  correctOptionId: string;
  explanation?: string;
  onComplete: () => void;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

export function MultipleChoiceMeaning({
  prompt,
  options,
  correctOptionId,
  explanation,
  onComplete,
  setGlobalState,
  globalState,
}: MultipleChoiceMeaningProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [missCount, setMissCount] = useState(0);

  const handleSelect = (id: string) => {
    if (
      globalState === "correct_feedback" ||
      globalState === "incorrect_feedback" ||
      globalState === "hint_feedback"
    ) {
      return;
    }
    setSelectedId(id);
    setGlobalState("answer_selected");
  };

  const handleCheck = () => {
    if (!selectedId) return;

    if (selectedId === correctOptionId) {
      setGlobalState("correct_feedback");
    } else {
      const newMissCount = missCount + 1;
      setMissCount(newMissCount);
      if (newMissCount === 1) {
        setGlobalState("hint_feedback");
      } else {
        setGlobalState("incorrect_feedback");
      }
    }
  };

  return (
    <div className="flex flex-col w-full gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-gray-500 uppercase tracking-wide">
          {t("exercise.multipleChoice.prompt")}
        </span>
        <h2 className="text-3xl font-extrabold text-ink">{prompt}</h2>
      </div>

      <div className="flex flex-col gap-4">
        {options.map((option) => {
          let state: "idle" | "selected" | "correct" | "incorrect" | "disabled" = "idle";

          if (globalState === "answer_selected" && selectedId === option.id) {
            state = "selected";
          } else if (globalState === "correct_feedback") {
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

      {(globalState === "awaiting_answer" || globalState === "answer_selected") && (
        <div className="fixed bottom-[96px] left-0 right-0 px-4 max-w-md mx-auto z-30">
          <Button3D
            variant={globalState === "answer_selected" ? "primary" : "disabled"}
            fullWidth
            onClick={handleCheck}
          >
            확인하기
          </Button3D>
        </div>
      )}
    </div>
  );
}
