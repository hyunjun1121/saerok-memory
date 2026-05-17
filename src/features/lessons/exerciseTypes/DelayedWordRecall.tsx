import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button3D } from "../../../components/Button3D";
import { ChoiceCard } from "../../../components/ChoiceCard";
import type { ExerciseState } from "./types";
import { saveCognitiveRoutineResult } from "../../cognitive/cognitiveRoutineStorage";

interface DelayedWordRecallProps {
  prompt: string;
  phase: "encode" | "recall";
  wordSetId?: string;
  words?: string[]; // Used in encode
  options?: { id: string; label: string }[]; // Used in recall
  requiredSelectionCount?: number;
  expectedAnswers?: string[]; // IDs for the recall
  onComplete: () => void;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

export function DelayedWordRecall({
  prompt,
  phase,
  wordSetId = "unknown",
  words = [],
  options = [],
  requiredSelectionCount = 3,
  expectedAnswers = [],
  onComplete,
  setGlobalState,
  globalState,
}: DelayedWordRecallProps) {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelect = (id: string) => {
    if (globalState === "correct_feedback" || globalState === "incorrect_feedback") return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size < requiredSelectionCount) {
          next.add(id);
        }
      }

      if (next.size === requiredSelectionCount) {
        setGlobalState("answer_selected");
      } else {
        setGlobalState("awaiting_answer");
      }

      return next;
    });
  };

  const handleConfirmEncode = () => {
    saveCognitiveRoutineResult({
      type: "delayed_word_recall",
      completed: true,
      metadata: { phase: "encode", wordSetId, words }
    });
    setGlobalState("correct_feedback");
    onComplete(); // Move on directly since there's no feedback tray for encode
  };

  const handleCheckRecall = () => {
    if (selectedIds.size < requiredSelectionCount) return;

    const selectedArray = Array.from(selectedIds);
    saveCognitiveRoutineResult({
      type: "delayed_word_recall",
      completed: true,
      metadata: { phase: "recall", wordSetId, selectedAnswers: selectedArray, expectedAnswers }
    });

    // We don't grade strictly in the UI, just acknowledge completion.
    setGlobalState("correct_feedback");
  };

  if (phase === "encode") {
    return (
      <div className="flex flex-col w-full gap-8">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-blue-500 uppercase tracking-wide">
            {t("exercise.cognitive.practice", "기억 연습")}
          </span>
          <h2 className="text-3xl font-extrabold text-ink leading-snug">{prompt}</h2>
        </div>

        <div className="flex flex-col gap-4 items-center justify-center p-8 bg-blue-50 rounded-2xl border-2 border-blue-100">
          {words.map((word, i) => (
            <span key={i} className="text-2xl font-bold text-ink">{word}</span>
          ))}
        </div>

        <div className="fixed bottom-[96px] left-0 right-0 px-4 max-w-md mx-auto z-30">
          <Button3D variant="primary" fullWidth onClick={handleConfirmEncode}>
            {t("exercise.cognitive.ready", "네, 기억했습니다")}
          </Button3D>
        </div>
      </div>
    );
  }

  // Recall Phase
  return (
    <div className="flex flex-col w-full gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-blue-500 uppercase tracking-wide">
          {t("exercise.cognitive.practice", "기억 연습")}
        </span>
        <h2 className="text-3xl font-extrabold text-ink leading-snug">{prompt}</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {options.map((option) => {
          let state: "idle" | "selected" | "correct" | "disabled" = "idle";
          const isSelected = selectedIds.has(option.id);

          if (globalState === "answer_selected" && isSelected) {
            state = "selected";
          } else if (globalState === "correct_feedback") {
             if (isSelected) state = "correct";
             else state = "disabled";
          } else if (globalState === "awaiting_answer" && isSelected) {
             state = "selected";
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
            onClick={handleCheckRecall}
          >
            {t("exercise.check")}
          </Button3D>
        </div>
      )}
    </div>
  );
}
