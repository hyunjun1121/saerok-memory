import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Volume2 } from "lucide-react";
import { Button3D } from "@/components/Button3D";
import { ChoiceCard } from "@/components/ChoiceCard";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";
import { speakCalmly } from "@/hooks/interactionFeedback";
import { getSpeechLanguage } from "@/utils/localizedText";

interface SequenceItem {
  id: string;
  label: string;
}

interface SequenceOrderProps {
  prompt: string;
  items: SequenceItem[];
  correctOrder: string[];
  requiredSelectionCount?: number;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

export function SequenceOrder({
  prompt,
  items,
  correctOrder,
  requiredSelectionCount = items.length,
  setGlobalState,
  globalState,
}: SequenceOrderProps) {
  const { t, i18n } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [missCount, setMissCount] = useState(0);
  const [visualSequence, setVisualSequence] = useState<string | null>(null);
  const visualSequenceTimerRef = useRef<number | null>(null);

  const isFeedbackVisible = [
    "correct_feedback",
    "incorrect_feedback",
    "hint_feedback",
  ].includes(globalState);
  const selectionTarget = Math.min(Math.max(requiredSelectionCount, 1), items.length);

  const handlePlaySequence = () => {
    const orderedLabels = correctOrder
      .map((id) => items.find((item) => item.id === id)?.label)
      .filter((label): label is string => Boolean(label));
    const spokenSequence = orderedLabels.join(", ");

    if (!spokenSequence) return;
    if (visualSequenceTimerRef.current !== null) {
      window.clearTimeout(visualSequenceTimerRef.current);
      visualSequenceTimerRef.current = null;
    }
    setVisualSequence(null);

    const canSpeak =
      typeof window !== "undefined" &&
      typeof window.speechSynthesis !== "undefined" &&
      typeof SpeechSynthesisUtterance !== "undefined";
    if (canSpeak) {
      // Instruction audio is task content, so it remains available even when
      // optional tap/success sounds are disabled in learner settings.
      speakCalmly(spokenSequence, getSpeechLanguage(i18n.language));
      return;
    }

    // Visual fallback keeps the activity usable when system speech is absent.
    // It disappears after a short viewing window, matching the memory task.
    setVisualSequence(orderedLabels.join(" → "));
    visualSequenceTimerRef.current = window.setTimeout(() => {
      setVisualSequence(null);
      visualSequenceTimerRef.current = null;
    }, 4000);
  };

  useEffect(
    () => () => {
      if (visualSequenceTimerRef.current !== null) {
        window.clearTimeout(visualSequenceTimerRef.current);
      }
    },
    [],
  );

  const handleSelect = (id: string) => {
    if (isFeedbackVisible) return;

    const isAlreadySelected = selectedIds.includes(id);
    const next = isAlreadySelected
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : selectedIds.length < selectionTarget
        ? [...selectedIds, id]
        : selectedIds;

    setSelectedIds(next);
    setGlobalState(
      next.length === selectionTarget ? "answer_selected" : "awaiting_answer",
    );
  };

  const handleCheck = () => {
    if (selectedIds.length !== selectionTarget) return;

    const isCorrect =
      correctOrder.length === selectionTarget &&
      correctOrder.every((id, index) => selectedIds[index] === id);
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
        <Button3D variant="secondary" onClick={handlePlaySequence}>
          <Volume2 className="mr-2 h-5 w-5" />
          {t("exercise.sequenceOrder.listen")}
        </Button3D>
        {visualSequence && (
          <p
            className="rounded-2xl border-2 border-purple-200 bg-purple-50 px-4 py-3 text-center text-xl font-extrabold text-purple-900"
            role="status"
          >
            {t("exercise.sequenceOrder.visualFallback", { words: visualSequence })}
          </p>
        )}
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
