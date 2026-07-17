import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StroopColor } from "@/data/mockExercises";
import { ScenarioCard } from "@/features/lessons/ui/ScenarioCard";
import { saveCognitiveRoutineResult } from "@/features/cognitive/cognitiveRoutineStorage";
import { useInteractionFeedback } from "@/hooks/useInteractionFeedback";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";

export interface RenderedStroopTrial {
  id: string;
  word: string;
  inkColor: StroopColor;
}

interface StroopTouchPracticeProps {
  prompt: string;
  trials: RenderedStroopTrial[];
  colorOptions: StroopColor[];
  scenarioTitle?: string;
  scenarioBody?: string;
  benefitCopy?: string;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

interface StroopTrialResult {
  trialId: string;
  word: string;
  expectedColor: StroopColor;
  selectedColor: StroopColor;
  correct: boolean;
  responseMs: number;
}

const DEFAULT_COLOR_OPTIONS: StroopColor[] = ["red", "blue", "green", "yellow"];

const COLOR_CLASSES: Record<
  StroopColor,
  { text: string; swatch: string; button: string; ring: string }
> = {
  red: {
    text: "text-red-600",
    swatch: "bg-red-500",
    button: "border-red-200 bg-red-50 text-red-900",
    ring: "focus:ring-red-200",
  },
  blue: {
    text: "text-blue-600",
    swatch: "bg-blue-500",
    button: "border-blue-200 bg-blue-50 text-blue-900",
    ring: "focus:ring-blue-200",
  },
  green: {
    text: "text-green-600",
    swatch: "bg-green-500",
    button: "border-green-200 bg-green-50 text-green-900",
    ring: "focus:ring-green-200",
  },
  yellow: {
    text: "text-yellow-500",
    swatch: "bg-yellow-400",
    button: "border-yellow-200 bg-yellow-50 text-yellow-900",
    ring: "focus:ring-yellow-200",
  },
};

function isFinishedState(state: ExerciseState) {
  return state === "correct_feedback" || state === "incorrect_feedback" || state === "completed";
}

function getCurrentTimestampMs() {
  return Date.now();
}

function buildAverageResponseMs(results: StroopTrialResult[]) {
  if (results.length === 0) {
    return 0;
  }

  const total = results.reduce((sum, result) => sum + result.responseMs, 0);
  return Math.round(total / results.length);
}

export function StroopTouchPractice({
  prompt,
  trials,
  colorOptions,
  scenarioTitle,
  scenarioBody,
  benefitCopy,
  setGlobalState,
  globalState,
}: StroopTouchPracticeProps) {
  const { t } = useTranslation();
  const { tap } = useInteractionFeedback();
  const trialStartedAtRef = useRef(getCurrentTimestampMs());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<StroopTrialResult[]>([]);

  const safeColorOptions = useMemo(
    () => (colorOptions.length > 0 ? colorOptions : DEFAULT_COLOR_OPTIONS),
    [colorOptions],
  );
  const currentTrial = trials[currentIndex];
  const correctCount = responses.filter((response) => response.correct).length;
  const errorCount = responses.length - correctCount;
  const progressLabel = `${Math.min(currentIndex + 1, trials.length)} / ${trials.length}`;

  useEffect(() => {
    trialStartedAtRef.current = getCurrentTimestampMs();
  }, [currentIndex]);

  useEffect(() => {
    if (!isFinishedState(globalState)) {
      setGlobalState("awaiting_answer");
    }
  }, [globalState, setGlobalState]);

  const handleSelectColor = (selectedColor: StroopColor) => {
    if (!currentTrial || isFinishedState(globalState)) {
      return;
    }

    tap();

    const responseMs = Math.max(0, getCurrentTimestampMs() - trialStartedAtRef.current);
    const trialResult: StroopTrialResult = {
      trialId: currentTrial.id,
      word: currentTrial.word,
      expectedColor: currentTrial.inkColor,
      selectedColor,
      correct: selectedColor === currentTrial.inkColor,
      responseMs,
    };
    const nextResponses = [...responses, trialResult];
    const nextCorrectCount = nextResponses.filter((response) => response.correct).length;
    const nextErrorCount = nextResponses.length - nextCorrectCount;

    setResponses(nextResponses);

    if (nextResponses.length >= trials.length) {
      saveCognitiveRoutineResult({
        type: "stroop_touch_practice",
        completed: true,
        metadata: {
          trialCount: trials.length,
          correctCount: nextCorrectCount,
          errorCount: nextErrorCount,
          averageResponseMs: buildAverageResponseMs(nextResponses),
          trialResults: nextResponses,
        },
      });
      setCurrentIndex(trials.length);
      setGlobalState(nextCorrectCount > 0 ? "correct_feedback" : "incorrect_feedback");
      return;
    }

    setCurrentIndex((index) => index + 1);
    setGlobalState("awaiting_answer");
  };

  if (trials.length === 0) {
    return (
      <div className="flex w-full flex-col gap-4 rounded-2xl border-2 border-gray-200 bg-white p-5">
        <h2 className="text-2xl font-extrabold leading-snug text-ink">{prompt}</h2>
        <p className="text-base font-bold leading-relaxed text-gray-600">
          {t("exercise.cognitive.stroopEmpty")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold uppercase tracking-wide text-primary-600">
          {t("exercise.cognitive.colorFocus")}
        </span>
        <h2 className="text-3xl font-extrabold leading-snug text-ink">{prompt}</h2>
      </div>

      <ScenarioCard title={scenarioTitle} body={scenarioBody} benefit={benefitCopy} />

      <div className="rounded-2xl border-2 border-yellow-100 bg-yellow-50 p-4">
        <p className="text-base font-bold leading-relaxed text-yellow-900">
          {t("exercise.cognitive.stroopGuide")}
        </p>
      </div>

      <div className="rounded-3xl border-2 border-gray-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-extrabold text-gray-500">
          {t("exercise.cognitive.stroopProgress", { progress: progressLabel })}
        </p>
        {currentTrial ? (
          <div className="mt-5 flex min-h-[132px] flex-col items-center justify-center gap-3 rounded-2xl bg-gray-50 px-4">
            <span
              className={[
                "text-6xl font-black leading-none",
                COLOR_CLASSES[currentTrial.inkColor].text,
              ].join(" ")}
              aria-label={t("exercise.cognitive.stroopWordAria", {
                word: currentTrial.word,
              })}
            >
              {currentTrial.word}
            </span>
            {/* Visible color-name fallback so the task never relies on color alone
                (fulfils the scenarioBody promise). */}
            <p className="text-xl font-extrabold text-gray-700">
              {t(`exercise.cognitive.colors.${currentTrial.inkColor}`)}
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-green-50 px-4 py-8 text-xl font-extrabold text-green-800">
            {t("exercise.cognitive.stroopComplete")}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {safeColorOptions.map((color) => {
          const colorName = t(`exercise.cognitive.colors.${color}`);
          return (
            <button
              key={color}
              type="button"
              onClick={() => handleSelectColor(color)}
              disabled={!currentTrial || isFinishedState(globalState)}
              aria-label={colorName}
              className={[
                "flex min-h-[72px] items-center gap-3 rounded-2xl border-[3px] px-4 text-left text-lg font-extrabold shadow-sm transition active:scale-95 disabled:opacity-60",
                "focus:outline-none focus:ring-4",
                COLOR_CLASSES[color].button,
                COLOR_CLASSES[color].ring,
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm",
                  COLOR_CLASSES[color].swatch,
                ].join(" ")}
                aria-hidden="true"
              >
                <span className="h-2 w-2 rounded-full bg-white/80" aria-hidden="true" />
              </span>
              {colorName}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3" aria-live="polite">
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 text-center">
          <p className="text-sm font-bold text-gray-500">
            {t("exercise.cognitive.stroopCorrect")}
          </p>
          <p className="text-2xl font-extrabold text-ink">{correctCount}</p>
        </div>
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 text-center">
          <p className="text-sm font-bold text-gray-500">
            {t("exercise.cognitive.stroopRetries")}
          </p>
          <p className="text-2xl font-extrabold text-ink">{errorCount}</p>
        </div>
      </div>
    </div>
  );
}
