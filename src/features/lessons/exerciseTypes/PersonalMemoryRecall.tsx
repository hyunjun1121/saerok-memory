import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChoiceCard } from "../../../components/ChoiceCard";
import { Button3D } from "../../../components/Button3D";
import type { ExerciseState } from "./types";
import type { MemoryCard, MemoryTopic } from "../../memory/types";
import { calculateNextReviewState } from "../../memory/memoryScheduler";
import { upsertMemoryCueCard, getMemoryCards, saveMemoryCards } from "../../memory/memoryCardStorage";

function updateMemoryCard(cardId: string, result: "remembered" | "hint_used" | "missed") {
  const existing = getMemoryCards();
  const idx = existing.findIndex(c => c.id === cardId);
  if (idx >= 0) {
    const card = existing[idx];
    card.reviewState = calculateNextReviewState(card.reviewState, result);
    card.updatedAt = new Date().toISOString();
    saveMemoryCards(existing);
  }
}

interface Option {
  id: string;
  label: string;
  value?: string;
}

type MemoryField = "topic" | "emotionTag" | "peopleTags" | "placeTag";

interface PersonalMemoryRecallProps {
  prompt: string;
  options: Option[];
  memoryId?: string;
  linkedConceptId?: string;
  memoryField?: MemoryField;
  correctOptionId?: string;
  onComplete: () => void;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

export function PersonalMemoryRecall({
  prompt,
  options,
  memoryId,
  linkedConceptId,
  memoryField = "topic",
  correctOptionId,
  setGlobalState,
  globalState,
}: PersonalMemoryRecallProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [missCount, setMissCount] = useState(0);
  const [hiddenOptionIds, setHiddenOptionIds] = useState<Set<string>>(new Set());

  const isReviewMode = !!memoryId && !!correctOptionId;

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

    if (isReviewMode) {
      if (selectedId === correctOptionId) {
        setGlobalState("correct_feedback");
        updateMemoryCard(memoryId!, missCount === 0 ? "remembered" : "hint_used");
      } else {
        const newMissCount = missCount + 1;
        setMissCount(newMissCount);

        if (newMissCount === 1) {
          setHiddenOptionIds((prev) => new Set(prev).add(selectedId));
          setGlobalState("hint_feedback");
          setSelectedId(null);
        } else {
          setGlobalState("incorrect_feedback");
          updateMemoryCard(memoryId!, "missed");
        }
      }
    } else {
      const selectedOption = options.find((o) => o.id === selectedId);
      const selectedValue = selectedOption?.value ?? selectedOption?.label ?? "unknown";

      const cardUpdate: Partial<MemoryCard> & { linkedConceptId: string } = {
        linkedConceptId: linkedConceptId || "unknown",
      };

      if (memoryField === "emotionTag") {
        cardUpdate.emotionTag = selectedValue;
      } else if (memoryField === "peopleTags") {
        cardUpdate.peopleTags = [selectedValue];
      } else if (memoryField === "placeTag") {
        cardUpdate.placeTag = selectedValue;
      } else {
        cardUpdate.topic = selectedValue as MemoryTopic;
      }

      upsertMemoryCueCard(cardUpdate);
      setGlobalState("correct_feedback");
    }
  };

  const visibleOptions = options.filter(opt => !hiddenOptionIds.has(opt.id));

  return (
    <div className="flex flex-col w-full gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-pink-500 uppercase tracking-wide">
          {t("exercise.memory.prompt")}
        </span>
        <h2 className="text-3xl font-extrabold text-ink leading-snug">{prompt}</h2>
      </div>

      <div className="flex flex-col gap-4">
        {visibleOptions.map((option) => {
          let state: "idle" | "selected" | "correct" | "incorrect" | "disabled" = "idle";

          if (globalState === "answer_selected" && selectedId === option.id) {
            state = "selected";
          } else if (globalState === "correct_feedback") {
            if (isReviewMode && option.id === correctOptionId) state = "correct";
            else if (!isReviewMode && selectedId === option.id) state = "correct";
            else state = "disabled";
          } else if (
            globalState === "incorrect_feedback" &&
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
            {t("exercise.memory.select")}
          </Button3D>
        </div>
      )}
    </div>
  );
}
