import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button3D } from "@/components/Button3D";
import { ChoiceCard } from "@/components/ChoiceCard";
import { getCognitiveRoutineResults, saveCognitiveRoutineResult } from "@/features/cognitive/cognitiveRoutineStorage";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";

interface WordCategoryCue {
  word: string;
  category: string;
}

interface DelayedWordRecallProps {
  prompt: string;
  phase: "encode" | "recall";
  wordSetId?: string;
  words?: string[];
  wordCategoryCues?: WordCategoryCue[];
  options?: { id: string; label: string }[];
  requiredSelectionCount?: number;
  plannedDelayMinutes?: number;
  expectedAnswers?: string[];
  onComplete: () => void;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

function parseIsoDate(value?: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function getLatestEncodeTimestamp(wordSetId: string): number | null {
  const matchingRecords = getCognitiveRoutineResults()
    .filter((result) => {
      const metadata = result.metadata ?? {};
      return (
        result.type === "delayed_word_recall" &&
        metadata.phase === "encode" &&
        metadata.wordSetId === wordSetId
      );
    })
    .map((result) => parseIsoDate(result.timestamp))
    .filter((timestamp): timestamp is number => timestamp !== null)
    .sort((a, b) => b - a);

  return matchingRecords[0] ?? null;
}

function buildCategoryCueMetadata(cues: WordCategoryCue[]) {
  return cues.map((cue) => ({
    word: cue.word,
    category: cue.category,
  }));
}

function normalizeRecallEntry(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, "");
}

function parseFreeRecallText(value: string): string[] {
  return value
    .split(/[\s,，、;；/]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function DelayedWordRecall({
  prompt,
  phase,
  wordSetId = "unknown",
  words = [],
  wordCategoryCues = [],
  options = [],
  requiredSelectionCount = 3,
  plannedDelayMinutes,
  expectedAnswers = [],
  onComplete,
  setGlobalState,
  globalState,
}: DelayedWordRecallProps) {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [freeRecallText, setFreeRecallText] = useState("");

  const categoryCueMetadata = buildCategoryCueMetadata(wordCategoryCues);

  const handleSelect = (id: string) => {
    if (globalState === "correct_feedback" || globalState === "incorrect_feedback") return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < requiredSelectionCount) {
        next.add(id);
      }

      setGlobalState(next.size === requiredSelectionCount ? "answer_selected" : "awaiting_answer");
      return next;
    });
  };

  const handleConfirmEncode = () => {
    saveCognitiveRoutineResult({
      type: "delayed_word_recall",
      completed: true,
      metadata: {
        phase: "encode",
        wordSetId,
        words,
        wordCategoryCues: categoryCueMetadata,
        wordCount: words.length,
        plannedDelayMinutes,
      },
    });
    setGlobalState("correct_feedback");
    onComplete();
  };

  const handleCheckRecall = () => {
    if (selectedIds.size < requiredSelectionCount) return;

    const selectedArray = Array.from(selectedIds);
    const expectedSet = new Set(expectedAnswers);
    const correctCount = selectedArray.filter((id) => expectedSet.has(id)).length;
    const latestEncodeTimestamp = getLatestEncodeTimestamp(wordSetId);
    const observedDelayMs =
      latestEncodeTimestamp !== null ? Math.max(0, Date.now() - latestEncodeTimestamp) : null;
    const freeRecallEntries = parseFreeRecallText(freeRecallText);
    const expectedLabels = options
      .filter((option) => expectedSet.has(option.id))
      .map((option) => normalizeRecallEntry(option.label));
    const expectedLabelSet = new Set(expectedLabels);
    const freeRecallCorrectCount = freeRecallEntries.filter((entry) =>
      expectedLabelSet.has(normalizeRecallEntry(entry)),
    ).length;

    saveCognitiveRoutineResult({
      type: "delayed_word_recall",
      completed: true,
      metadata: {
        phase: "recall",
        wordSetId,
        selectedAnswers: selectedArray,
        expectedAnswers,
        correctCount,
        requiredSelectionCount,
        presentedOptions: options.map((option) => ({
          id: option.id,
          label: option.label,
        })),
        wordCategoryCues: categoryCueMetadata,
        plannedDelayMinutes,
        observedDelayMs,
        observedDelayMinutes:
          observedDelayMs !== null ? Math.round((observedDelayMs / 60_000) * 10) / 10 : null,
        recallMode:
          freeRecallEntries.length > 0
            ? "free_recall_then_recognition_choice"
            : "recognition_choice",
        freeRecallEntries,
        freeRecallCorrectCount,
        freeRecallExtraCount: Math.max(0, freeRecallEntries.length - freeRecallCorrectCount),
      },
    });

    setGlobalState("correct_feedback");
  };

  if (phase === "encode") {
    return (
      <div className="flex w-full flex-col gap-8">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold uppercase tracking-wide text-blue-500">
            {t("exercise.cognitive.practice")}
          </span>
          <h2 className="text-3xl font-extrabold leading-snug text-ink">{prompt}</h2>
          <p className="text-base font-bold leading-relaxed text-gray-600">
            {t("exercise.cognitive.wordRecallEncodeGuide")}
          </p>
        </div>

        {wordCategoryCues.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 rounded-2xl border-2 border-blue-100 bg-blue-50 p-4">
            {wordCategoryCues.map((cue) => (
              <div
                key={`${cue.category}-${cue.word}`}
                className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm"
              >
                <span className="text-sm font-extrabold text-blue-600">{cue.category}</span>
                <span className="text-2xl font-extrabold text-ink">{cue.word}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-blue-100 bg-blue-50 p-8">
            {words.map((word) => (
              <span key={word} className="text-2xl font-bold text-ink">
                {word}
              </span>
            ))}
          </div>
        )}

        <div className="mt-1">
          <Button3D variant="primary" fullWidth onClick={handleConfirmEncode}>
            {t("exercise.cognitive.ready")}
          </Button3D>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold uppercase tracking-wide text-blue-500">
          {t("exercise.cognitive.practice")}
        </span>
        <h2 className="text-3xl font-extrabold leading-snug text-ink">{prompt}</h2>
        <p className="text-base font-bold leading-relaxed text-gray-600">
          {t("exercise.cognitive.wordRecallRecallGuide", { count: requiredSelectionCount })}
        </p>
      </div>

      {wordCategoryCues.length > 0 && (
        <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm font-extrabold leading-relaxed text-blue-900">
            {t("exercise.cognitive.wordRecallCueLabel")}:{" "}
            {wordCategoryCues.map((cue) => cue.category).join(" · ")}
          </p>
        </div>
      )}

      <label className="flex flex-col gap-2 text-sm font-extrabold text-gray-700">
        {t("exercise.cognitive.wordRecallFreeLabel")}
        <textarea
          value={freeRecallText}
          onChange={(event) => setFreeRecallText(event.target.value)}
          rows={3}
          className="min-h-[88px] rounded-2xl border-2 border-gray-200 bg-white p-4 text-base font-bold leading-relaxed text-ink outline-none transition focus:border-blue-300"
          placeholder={t("exercise.cognitive.wordRecallFreePlaceholder")}
        />
        <span className="text-sm font-bold leading-relaxed text-gray-500">
          {t("exercise.cognitive.wordRecallFreeHelper")}
        </span>
      </label>

      <div className="grid grid-cols-2 gap-4">
        {options.map((option) => {
          let state: "idle" | "selected" | "correct" | "disabled" = "idle";
          const isSelected = selectedIds.has(option.id);

          if (globalState === "answer_selected" && isSelected) {
            state = "selected";
          } else if (globalState === "correct_feedback") {
            state = isSelected ? "correct" : "disabled";
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
        <div className="mt-1">
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
