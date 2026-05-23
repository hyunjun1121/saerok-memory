import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button3D } from "../../../components/Button3D";
import { saveCognitiveRoutineResult } from "../../cognitive/cognitiveRoutineStorage";
import type { ExerciseState } from "./types";

interface VerbalFluencyPracticeProps {
  prompt: string;
  category: string;
  durationSeconds: number;
  onComplete: () => void;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

function normalizeEntry(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function splitEntries(value: string) {
  return value
    .split(/[,，、\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function VerbalFluencyPractice({
  prompt,
  category,
  durationSeconds,
  onComplete,
  setGlobalState,
  globalState,
}: VerbalFluencyPracticeProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<"intro" | "active" | "finished">("intro");
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const [inputValue, setInputValue] = useState("");
  const [entries, setEntries] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const normalizedEntries = useMemo(
    () => entries.map(normalizeEntry).filter(Boolean),
    [entries],
  );
  const uniqueCount = new Set(normalizedEntries).size;
  const repetitionCount = Math.max(0, normalizedEntries.length - uniqueCount);
  const canSave = entries.length > 0;

  useEffect(() => {
    if (phase !== "active") {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timerId);
          setPhase("finished");
          setGlobalState(entries.length > 0 ? "answer_selected" : "awaiting_answer");
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [entries.length, phase, setGlobalState]);

  useEffect(() => {
    if (globalState === "correct_feedback" || globalState === "incorrect_feedback") {
      return;
    }

    if (phase === "active" && canSave) {
      setGlobalState("answer_selected");
      return;
    }

    if (phase === "intro" || !canSave) {
      setGlobalState("awaiting_answer");
    }
  }, [canSave, globalState, phase, setGlobalState]);

  const startPractice = () => {
    setStartedAt(Date.now());
    setRemainingSeconds(durationSeconds);
    setPhase("active");
    setGlobalState("awaiting_answer");
  };

  const addInputEntries = () => {
    const nextEntries = splitEntries(inputValue);
    if (nextEntries.length === 0) {
      return;
    }

    setEntries((current) => [...current, ...nextEntries]);
    setInputValue("");
    setGlobalState("answer_selected");
  };

  const removeEntry = (index: number) => {
    setEntries((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const finishPractice = () => {
    const now = Date.now();
    const elapsedSeconds =
      startedAt === null
        ? durationSeconds - remainingSeconds
        : Math.min(durationSeconds, Math.round((now - startedAt) / 1000));

    saveCognitiveRoutineResult({
      type: "verbal_fluency_practice",
      completed: canSave,
      metadata: {
        category,
        durationSeconds,
        elapsedSeconds,
        entries,
        uniqueCount,
        repetitionCount,
      },
    });

    setGlobalState(canSave ? "correct_feedback" : "incorrect_feedback");
    if (canSave) {
      onComplete();
    }
  };

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold uppercase tracking-wide text-blue-500">
          {t("exercise.cognitive.verbalFluency")}
        </span>
        <h2 className="text-3xl font-extrabold leading-snug text-ink">{prompt}</h2>
      </div>

      <div className="flex flex-col gap-5 rounded-2xl border-2 border-green-100 bg-green-50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-green-700">
              {t("exercise.cognitive.category")}
            </p>
            <p className="text-3xl font-extrabold text-ink">{category}</p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-green-200 bg-white text-2xl font-extrabold text-green-700">
            {remainingSeconds}
          </div>
        </div>
        <p className="text-base font-bold leading-relaxed text-green-900">
          {t("exercise.cognitive.verbalFluencyGuide")}
        </p>
      </div>

      {phase === "intro" ? (
        <div className="rounded-2xl border-2 border-gray-200 bg-white p-5 text-base font-bold leading-relaxed text-gray-700">
          {t("exercise.cognitive.verbalFluencyIntro")}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-bold text-gray-700">
            {t("exercise.cognitive.wordInputLabel")}
            <textarea
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  addInputEntries();
                }
              }}
              rows={3}
              className="min-h-[88px] rounded-2xl border-2 border-gray-200 bg-white p-4 text-lg font-bold text-ink outline-none transition focus:border-green-400"
              placeholder={t("exercise.cognitive.wordInputPlaceholder")}
            />
          </label>

          <Button3D variant="neutral" fullWidth onClick={addInputEntries}>
            {t("exercise.cognitive.addWords")}
          </Button3D>

          {entries.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label={t("exercise.cognitive.enteredWords")}>
              {entries.map((entry, index) => (
                <button
                  key={`${entry}-${index}`}
                  type="button"
                  onClick={() => removeEntry(index)}
                  className="rounded-full border-2 border-green-200 bg-white px-4 py-2 text-base font-extrabold text-green-800"
                  aria-label={t("exercise.cognitive.removeWord", { word: entry })}
                >
                  {entry}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 text-center">
              <p className="text-sm font-bold text-gray-500">
                {t("exercise.cognitive.uniqueWords")}
              </p>
              <p className="text-2xl font-extrabold text-ink">{uniqueCount}</p>
            </div>
            <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 text-center">
              <p className="text-sm font-bold text-gray-500">
                {t("exercise.cognitive.repeatedWords")}
              </p>
              <p className="text-2xl font-extrabold text-ink">{repetitionCount}</p>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-[96px] left-0 right-0 z-30 mx-auto max-w-md px-4">
        {phase === "intro" ? (
          <Button3D variant="primary" fullWidth onClick={startPractice}>
            {t("exercise.cognitive.startFluency")}
          </Button3D>
        ) : (
          <Button3D
            variant={canSave ? "primary" : "disabled"}
            fullWidth
            onClick={finishPractice}
          >
            {phase === "finished"
              ? t("exercise.cognitive.saveFluency")
              : t("exercise.cognitive.finishFluency")}
          </Button3D>
        )}
      </div>
    </div>
  );
}
