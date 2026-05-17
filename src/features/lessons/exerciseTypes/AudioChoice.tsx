import { useState } from "react";
import { Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button3D } from "../../../components/Button3D";
import { ChoiceCard } from "../../../components/ChoiceCard";
import type { ExerciseState } from "./types";
import { getSpeechLanguage } from "../../../utils/localizedText";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [missCount, setMissCount] = useState(0);

  const playAudio = () => {
    if (!audioText || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(audioText);
    utterance.lang = getSpeechLanguage(i18n.language);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

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

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-3">
        <span className="text-sm font-bold uppercase tracking-wide text-blue-500">
          {t("exercise.audioChoice.prompt")}
        </span>
        <h2 className="text-3xl font-extrabold leading-snug text-ink">{prompt}</h2>
        {audioText && (
          <Button3D variant="secondary" onClick={playAudio}>
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
