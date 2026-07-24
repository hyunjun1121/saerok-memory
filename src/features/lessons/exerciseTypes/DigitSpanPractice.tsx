import { useState } from "react";
import { Button3D } from "@/components/Button3D";
import { ScenarioCard } from "@/features/lessons/ui/ScenarioCard";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";
import { saveCognitiveRoutineResult } from "@/features/cognitive/cognitiveRoutineStorage";
import { useTranslation } from "react-i18next";
import { useInteractionFeedback } from "@/hooks/useInteractionFeedback";

interface DigitSpanPracticeProps {
  prompt: string;
  digits: string[];
  direction: "forward" | "backward";
  scenarioTitle?: string;
  scenarioBody?: string;
  benefitCopy?: string;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

function isFeedbackState(state: ExerciseState) {
  return (
    state === "correct_feedback" ||
    state === "incorrect_feedback" ||
    state === "hint_feedback" ||
    state === "completed"
  );
}

export function DigitSpanPractice({
  prompt,
  digits,
  direction,
  scenarioTitle,
  scenarioBody,
  benefitCopy,
  setGlobalState,
  globalState,
}: DigitSpanPracticeProps) {
  const { t } = useTranslation();
  const { playCue } = useInteractionFeedback();
  const [phase, setPhase] = useState<"study" | "answer">("study");
  const [enteredDigits, setEnteredDigits] = useState<string[]>([]);
  const [missCount, setMissCount] = useState(0);

  const expectedDigits = direction === "backward" ? [...digits].reverse() : digits;
  const isReadyToCheck = enteredDigits.length === expectedDigits.length;

  const startAnswer = () => {
    setPhase("answer");
    setEnteredDigits([]);
    setGlobalState("awaiting_answer");
  };

  const addDigit = (digit: string) => {
    if (phase !== "answer" || isFeedbackState(globalState)) {
      return;
    }

    void playCue("select");

    setEnteredDigits((current) => {
      if (current.length >= expectedDigits.length) {
        return current;
      }

      const next = [...current, digit];
      setGlobalState(next.length === expectedDigits.length ? "answer_selected" : "awaiting_answer");
      return next;
    });
  };

  const removeLastDigit = () => {
    if (phase !== "answer" || isFeedbackState(globalState)) {
      return;
    }

    setEnteredDigits((current) => {
      const next = current.slice(0, -1);
      setGlobalState(next.length === expectedDigits.length ? "answer_selected" : "awaiting_answer");
      return next;
    });
  };

  const handleCheck = () => {
    if (!isReadyToCheck) {
      return;
    }

    const completed = enteredDigits.join("") === expectedDigits.join("");
    const resultMetadata = {
      direction,
      spanLength: digits.length,
      presentedDigits: digits,
      expectedDigits,
      enteredDigits,
      missCount,
    };

    if (completed) {
      saveCognitiveRoutineResult({
        type: "digit_span_practice",
        completed: true,
        metadata: resultMetadata,
      });
      setGlobalState("correct_feedback");
      return;
    }

    const nextMissCount = missCount + 1;
    setMissCount(nextMissCount);
    setEnteredDigits([]);

    if (nextMissCount === 1) {
      setGlobalState("hint_feedback");
      return;
    }

    saveCognitiveRoutineResult({
      type: "digit_span_practice",
      completed: false,
      metadata: {
        ...resultMetadata,
        missCount: nextMissCount,
      },
    });
    setGlobalState("incorrect_feedback");
  };

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold uppercase tracking-wide text-primary-600">
          {t("exercise.cognitive.workingMemory")}
        </span>
        <h2 className="text-3xl font-extrabold leading-snug text-ink">{prompt}</h2>
      </div>

      <ScenarioCard title={scenarioTitle} body={scenarioBody} benefit={benefitCopy} />

      {phase === "study" ? (
        <div className="flex flex-col gap-5 rounded-2xl border-2 border-blue-100 bg-blue-50 p-6 text-center">
          <p className="text-base font-bold leading-relaxed text-blue-900">
            {direction === "backward"
              ? t("exercise.cognitive.digitSpanBackwardGuide")
              : t("exercise.cognitive.digitSpanForwardGuide")}
          </p>
          <div className="flex justify-center gap-3">
            {digits.map((digit, index) => (
              <span
                key={`${digit}-${index}`}
                className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-blue-200 bg-white text-3xl font-extrabold text-ink shadow-sm"
              >
                {digit}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-4 gap-3 rounded-2xl border-2 border-gray-200 bg-white p-4">
            {expectedDigits.map((_, index) => (
              <span
                key={index}
                className="flex h-14 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-2xl font-extrabold text-ink"
              >
                {enteredDigits[index] ?? ""}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {KEYPAD_DIGITS.map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => addDigit(digit)}
                className="min-h-[56px] rounded-2xl border-2 border-gray-300 bg-white text-2xl font-extrabold text-ink transition active:scale-[0.98]"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={removeLastDigit}
              className="col-span-2 min-h-[56px] rounded-2xl border-2 border-gray-300 bg-white text-lg font-extrabold text-gray-700 transition active:scale-[0.98]"
            >
              {t("exercise.cognitive.backspace")}
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-[96px] left-0 right-0 z-30 mx-auto max-w-md px-4">
        {phase === "study" ? (
          <Button3D variant="primary" fullWidth onClick={startAnswer}>
            {t("exercise.cognitive.startAnswer")}
          </Button3D>
        ) : (
          <Button3D
            variant={isReadyToCheck ? "primary" : "disabled"}
            fullWidth
            onClick={handleCheck}
          >
            {t("exercise.check")}
          </Button3D>
        )}
      </div>
    </div>
  );
}
