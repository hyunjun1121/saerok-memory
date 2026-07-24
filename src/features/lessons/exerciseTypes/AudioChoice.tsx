import { useState } from "react";
import { Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button3D } from "@/components/Button3D";
import { ChoiceCard } from "@/components/ChoiceCard";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";
import { getSpeechLanguage } from "@/utils/localizedText";
import { useInteractionFeedback } from "@/hooks/useInteractionFeedback";

interface Option {
  id: string;
  label: string;
}

interface AudioChoiceProps {
  prompt: string;
  options: Option[];
  correctOptionId: string;
  audioText?: string;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

export function AudioChoice({
  prompt,
  options,
  correctOptionId,
  audioText,
  setGlobalState,
  globalState,
}: AudioChoiceProps) {
  const { t, i18n } = useTranslation();
  const { speak } = useInteractionFeedback();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [missCount, setMissCount] = useState(0);

  const playAudio = () => {
    if (!audioText) return;
    speak(audioText, getSpeechLanguage(i18n.language));
  };

  const handleSelect = (id: string) => {
    if (["correct_feedback", "incorrect_feedback", "hint_feedback"].includes(globalState)) {
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
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-3">
        <span className="text-sm font-bold uppercase tracking-wide text-blue-500">
          {t("exercise.audioChoice.prompt")}
        </span>
        <h2 className="text-3xl font-extrabold leading-snug text-ink">{prompt}</h2>
        {audioText && (
          <Button3D
            variant="secondary"
            feedbackCue="none"
            onClick={playAudio}
          >
            <Volume2 className="mr-2 h-5 w-5" />
            {t("exercise.audioChoice.play")}
          </Button3D>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {options.map((option) => {
          let state: "idle" | "selected" | "correct" | "incorrect" | "disabled" = "idle";

          if (globalState === "answer_selected" && selectedId === option.id) {
            state = "selected";
          } else if (globalState === "correct_feedback") {
            state = option.id === correctOptionId ? "correct" : "disabled";
          } else if (
            (globalState === "incorrect_feedback" || globalState === "hint_feedback") &&
            selectedId === option.id
          ) {
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
