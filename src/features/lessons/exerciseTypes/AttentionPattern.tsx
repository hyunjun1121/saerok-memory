import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChoiceCard } from "@/components/ChoiceCard";
import { ScenarioCard } from "@/features/lessons/ui/ScenarioCard";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";
import { saveCognitiveRoutineResult } from "@/features/cognitive/cognitiveRoutineStorage";

interface AttentionPatternProps {
  prompt: string;
  pattern?: number[];
  options: { id: string; label: string; value?: string }[];
  correctOptionId: string;
  scenarioTitle?: string;
  scenarioBody?: string;
  benefitCopy?: string;
  onComplete: () => void;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

export function AttentionPattern({
  prompt,
  pattern,
  options,
  correctOptionId,
  scenarioTitle,
  scenarioBody,
  benefitCopy,
  setGlobalState,
  globalState,
}: AttentionPatternProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [missCount, setMissCount] = useState(0);

  const handleSelect = (id: string) => {
    if (globalState === "correct_feedback" || globalState === "incorrect_feedback" || globalState === "hint_feedback") return;

    setSelectedId(id);

    if (id === correctOptionId) {
      setGlobalState("correct_feedback");
      saveCognitiveRoutineResult({
        type: "attention_pattern",
        completed: true,
        metadata: { pattern, selectedId: id, correctOptionId, missCount },
      });
      return;
    }

    const newMissCount = missCount + 1;
    setMissCount(newMissCount);

    if (newMissCount === 1) {
      setGlobalState("hint_feedback");
    } else {
      setGlobalState("incorrect_feedback");
      saveCognitiveRoutineResult({
        type: "attention_pattern",
        completed: false,
        metadata: { pattern, selectedId: id, correctOptionId, missCount: newMissCount },
      });
    }
  };

  return (
    <div className="flex flex-col w-full gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-primary-600 uppercase tracking-wide">
          {t("exercise.cognitive.practice")}
        </span>
        <h2 className="text-3xl font-extrabold text-ink leading-snug">{prompt}</h2>
      </div>

      <ScenarioCard title={scenarioTitle} body={scenarioBody} benefit={benefitCopy} />

      {pattern && pattern.length > 0 && (
        <div className="flex items-center justify-center gap-4 py-8">
          {pattern.map((num, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="text-4xl font-extrabold text-ink">{num}</span>
              <span className="text-2xl text-gray-400">→</span>
            </div>
          ))}
          <div className="w-16 h-16 rounded-2xl border-4 border-dashed border-gray-300 flex items-center justify-center">
            <span className="text-2xl text-gray-400">?</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {options.map((option) => {
          let state: "idle" | "selected" | "correct" | "incorrect" | "disabled" = "idle";

          if (globalState === "answer_selected" && selectedId === option.id) {
            state = "selected";
          } else if (globalState === "correct_feedback") {
            if (option.id === correctOptionId) state = "correct";
            else state = "disabled";
          } else if (globalState === "incorrect_feedback" && selectedId === option.id) {
            state = "incorrect";
          } else if (globalState === "incorrect_feedback" || globalState === "hint_feedback") {
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
