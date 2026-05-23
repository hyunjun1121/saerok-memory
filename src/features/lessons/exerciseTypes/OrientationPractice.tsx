import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button3D } from "../../../components/Button3D";
import { ChoiceCard } from "../../../components/ChoiceCard";
import { saveCognitiveRoutineResult } from "../../cognitive/cognitiveRoutineStorage";
import type { ExerciseState } from "./types";

type OrientationKind = "date_weekday";

interface OrientationPracticeProps {
  prompt: string;
  kind?: OrientationKind;
  targetDateISO?: string;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

interface OrientationOption {
  id: string;
  label: string;
  offsetDays: number;
  isoDate: string;
}

const OPTION_OFFSETS = [0, -1, 1, -7];

function getCurrentTimestampMs() {
  return Date.now();
}

function localeForDate(language: string) {
  if (language.startsWith("ja")) return "ja-JP";
  if (language.startsWith("en")) return "en-US";
  return "ko-KR";
}

function addDays(date: Date, offsetDays: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + offsetDays);
  return next;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTargetDate(targetDateISO?: string) {
  if (!targetDateISO) {
    return new Date();
  }

  const parsed = new Date(`${targetDateISO}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDateWeekday(date: Date, language: string) {
  return new Intl.DateTimeFormat(localeForDate(language), {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function buildOrientationOptions(targetDate: Date, language: string): OrientationOption[] {
  const options = OPTION_OFFSETS.map((offsetDays) => {
    const optionDate = addDays(targetDate, offsetDays);
    return {
      id: `offset_${offsetDays}`,
      label: formatDateWeekday(optionDate, language),
      offsetDays,
      isoDate: toIsoDate(optionDate),
    };
  });

  const rotation = targetDate.getDate() % options.length;
  return [...options.slice(rotation), ...options.slice(0, rotation)];
}

export function OrientationPractice({
  prompt,
  kind = "date_weekday",
  targetDateISO,
  setGlobalState,
  globalState,
}: OrientationPracticeProps) {
  const { t, i18n } = useTranslation();
  const startedAtRef = useRef(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedId, setCheckedId] = useState<string | null>(null);
  const [targetDate] = useState(() => parseTargetDate(targetDateISO));
  const options = useMemo(
    () => buildOrientationOptions(targetDate, i18n.language),
    [targetDate, i18n.language],
  );
  const expectedOption = options.find((option) => option.offsetDays === 0) ?? options[0];
  const selectedOption = options.find((option) => option.id === selectedId);

  useEffect(() => {
    startedAtRef.current = getCurrentTimestampMs();
  }, []);

  const handleSelect = (id: string) => {
    if (globalState === "correct_feedback" || globalState === "incorrect_feedback") {
      return;
    }

    setSelectedId(id);
    setGlobalState("answer_selected");
  };

  const handleCheck = () => {
    if (!selectedOption) {
      return;
    }

    const matchedExpected = selectedOption.offsetDays === 0;
    const responseMs = Math.max(0, getCurrentTimestampMs() - startedAtRef.current);

    setCheckedId(selectedOption.id);
    saveCognitiveRoutineResult({
      type: "orientation_practice",
      completed: true,
      metadata: {
        kind,
        targetDateISO: toIsoDate(targetDate),
        locale: i18n.language,
        expectedOption: {
          id: expectedOption.id,
          label: expectedOption.label,
          isoDate: expectedOption.isoDate,
          offsetDays: expectedOption.offsetDays,
        },
        selectedOption: {
          id: selectedOption.id,
          label: selectedOption.label,
          isoDate: selectedOption.isoDate,
          offsetDays: selectedOption.offsetDays,
        },
        matchedExpected,
        responseMs,
      },
    });

    setGlobalState(matchedExpected ? "correct_feedback" : "incorrect_feedback");
  };

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold uppercase tracking-wide text-blue-500">
          {t("exercise.cognitive.orientation")}
        </span>
        <h2 className="text-3xl font-extrabold leading-snug text-ink">{prompt}</h2>
        <p className="text-base font-bold leading-relaxed text-gray-600">
          {t("exercise.cognitive.orientationGuide")}
        </p>
      </div>

      <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 p-4">
        <p className="text-sm font-extrabold uppercase tracking-wide text-blue-600">
          {t("exercise.cognitive.orientationTodayLabel")}
        </p>
        <p className="mt-1 text-2xl font-extrabold text-ink">
          {t("exercise.cognitive.orientationTodayHelper")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {options.map((option) => {
          let state: "idle" | "selected" | "correct" | "incorrect" | "disabled" = "idle";

          if (checkedId) {
            if (option.offsetDays === 0) {
              state = "correct";
            } else if (option.id === checkedId) {
              state = "incorrect";
            } else {
              state = "disabled";
            }
          } else if (option.id === selectedId) {
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
            onClick={handleCheck}
          >
            {t("exercise.check")}
          </Button3D>
        </div>
      )}
    </div>
  );
}
