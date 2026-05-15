import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button3D } from "../../../components/Button3D";
import { ChoiceCard } from "../../../components/ChoiceCard";
import type { ExerciseState } from "./types";

interface SequenceItem {
  id: string;
  label: string;
}

interface SequenceOrderProps {
  prompt: string;
  items: SequenceItem[];
  correctOrder: string[];
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

export function SequenceOrder({
  prompt,
  items,
  correctOrder,
  setGlobalState,
  globalState,
}: SequenceOrderProps) {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [missCount, setMissCount] = useState(0);

  const isFeedbackVisible = [
    "correct_feedback",
    "incorrect_feedback",
    "hint_feedback",
  ].includes(globalState);

  const handleSelect = (id: string) => {
    if (isFeedbackVisible) return;

    setSelectedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((selectedId) => selectedId !== id)
        : [...prev, id];

      setGlobalState(next.length === items.length ? "answer_selected" : "awaiting_answer");
      return next;
    });
  };

  const handleCheck = () => {
    if (selectedIds.length !== items.length) return;

    const isCorrect = correctOrder.every((id, index) => selectedIds[index] === id);
    if (isCorrect) {
      setGlobalState("correct_feedback");
      return;
    }

    const newMissCount = missCount + 1;
    setMissCount(newMissCount);
    setGlobalState(newMissCount === 1 ? "hint_feedback" : "incorrect_feedback");
  };

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold uppercase tracking-wide text-purple-500">
          {t("exercise.sequenceOrder.prompt")}
        </span>
        <h2 className="text-3xl font-extrabold leading-snug text-ink">{prompt}</h2>
      </div>

      <div className="flex flex-col gap-4">
        {items.map((item) => {
          const selectedIndex = selectedIds.indexOf(item.id);
          const isSelected = selectedIndex >= 0;

          return (
            <ChoiceCard
              key={item.id}
              id={item.id}
              label={isSelected ? `${selectedIndex + 1}. ${item.label}` : item.label}
              state={isSelected ? "selected" : "idle"}
              onSelect={handleSelect}
            />
          );
        })}
      </div>

      {(globalState === "awaiting_answer" || globalState === "answer_selected") && (
        <div className="fixed bottom-[96px] left-0 right-0 z-30 mx-auto max-w-md px-4">
          <Button3D
            variant={globalState === "answer_selected" ? "primary" : "disabled"}
            fullWidth
            onClick={handleCheck}
          >
            {t("exercise.check")}
          </Button3D>
        </div>
      )}
    </div>
  );
}
