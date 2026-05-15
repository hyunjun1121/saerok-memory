import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button3D } from "../../../components/Button3D";
import type { ExerciseState } from "./types";

interface PictureOption {
  id: string;
  label: string;
  imageUrl?: string;
}

interface PictureChoiceProps {
  prompt: string;
  options: PictureOption[];
  correctOptionId: string;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

export function PictureChoice({
  prompt,
  options,
  correctOptionId,
  setGlobalState,
  globalState,
}: PictureChoiceProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [missCount, setMissCount] = useState(0);

  const handleSelect = (id: string) => {
    if (["correct_feedback", "incorrect_feedback", "hint_feedback"].includes(globalState)) {
      return;
    }

    setSelectedId(id);
    setGlobalState("answer_selected");
  };

  const handleCheck = () => {
    if (!selectedId) return;

    if (selectedId === correctOptionId) {
      setGlobalState("correct_feedback");
      return;
    }

    const newMissCount = missCount + 1;
    setMissCount(newMissCount);
    setGlobalState(newMissCount === 1 ? "hint_feedback" : "incorrect_feedback");
  };

  const cardClass = (id: string) => {
    if (globalState === "correct_feedback") {
      return id === correctOptionId
        ? "border-primary-600 bg-primary-50"
        : "border-gray-200 bg-gray-100 opacity-60";
    }

    if (
      (globalState === "incorrect_feedback" || globalState === "hint_feedback") &&
      selectedId === id
    ) {
      return "border-red-500 bg-red-50";
    }

    return selectedId === id
      ? "border-blue-500 bg-blue-50"
      : "border-gray-300 bg-white hover:bg-gray-50";
  };

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold uppercase tracking-wide text-green-600">
          {t("exercise.pictureChoice.prompt")}
        </span>
        <h2 className="text-3xl font-extrabold leading-snug text-ink">{prompt}</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={globalState === "correct_feedback"}
            onClick={() => handleSelect(option.id)}
            className={`flex min-h-[160px] flex-col overflow-hidden rounded-2xl border-2 text-left transition-all ${cardClass(option.id)}`}
          >
            {option.imageUrl && (
              <img
                src={option.imageUrl}
                alt=""
                className="h-28 w-full object-cover"
              />
            )}
            <span className="flex flex-1 items-center px-4 py-3 text-lg font-bold text-ink">
              {option.label}
            </span>
          </button>
        ))}
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
