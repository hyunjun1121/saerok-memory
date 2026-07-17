import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChoiceCard } from "@/components/ChoiceCard";
import { saveCognitiveRoutineResult } from "@/features/cognitive/cognitiveRoutineStorage";
import type { ExerciseState } from "@/features/lessons/exerciseTypes/types";

// date_weekday = full date picker (back-compat: used by tests + catalog).
// month / weekday / season = the three orientation questions the demo randomly
// picks between ("오늘 몇 월이에요?" / "무슨 요일이에요?" / "계절이 뭐에요?").
// "random" (from the exercise payload) picks one of those three on mount.
type OrientationMode = "date_weekday" | "month" | "weekday" | "season";
type OrientationKind = OrientationMode | "random";

interface OrientationPracticeProps {
  prompt: string;
  kind?: OrientationKind;
  targetDateISO?: string;
  setGlobalState: (state: ExerciseState) => void;
  globalState: ExerciseState;
}

interface OrientationChoice {
  id: string;
  label: string;
  isCorrect: boolean;
  // date_weekday metadata
  offsetDays?: number;
  isoDate?: string;
  // month / weekday / season metadata
  value?: string;
}

const DATE_OFFSETS = [0, -1, 1, -7];
const RANDOM_MODES: OrientationMode[] = ["month", "weekday", "season"];
const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

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

// Format a month name (0-based index) without depending on the current date.
function monthLabel(monthIndex0: number, language: string) {
  const ref = new Date(2026, monthIndex0, 15, 12, 0, 0);
  return new Intl.DateTimeFormat(localeForDate(language), { month: "long" }).format(ref);
}

// Format a weekday name (0=Sunday). 1970-01-04 was a Sunday, so day 4+w lands on
// weekday w — a stable anchor independent of "today".
function weekdayLabel(weekdayIndex0: number, language: string) {
  const ref = new Date(1970, 0, 4 + weekdayIndex0, 12, 0, 0);
  return new Intl.DateTimeFormat(localeForDate(language), { weekday: "long" }).format(ref);
}

function seasonForMonth(month1to12: number): (typeof SEASONS)[number] {
  if (month1to12 >= 3 && month1to12 <= 5) return "spring";
  if (month1to12 >= 6 && month1to12 <= 8) return "summer";
  if (month1to12 >= 9 && month1to12 <= 11) return "autumn";
  return "winter";
}

function rotateBy<T>(items: T[], seed: number): T[] {
  const rotation = ((seed % items.length) + items.length) % items.length;
  return [...items.slice(rotation), ...items.slice(0, rotation)];
}

function buildChoices(
  mode: OrientationMode,
  targetDate: Date,
  language: string,
): OrientationChoice[] {
  if (mode === "date_weekday") {
    const options: OrientationChoice[] = DATE_OFFSETS.map((offsetDays) => {
      const optionDate = addDays(targetDate, offsetDays);
      return {
        id: `offset_${offsetDays}`,
        label: formatDateWeekday(optionDate, language),
        isCorrect: offsetDays === 0,
        offsetDays,
        isoDate: toIsoDate(optionDate),
      };
    });
    return rotateBy(options, targetDate.getDate());
  }

  if (mode === "month") {
    const correctMonth = targetDate.getMonth(); // 0-based
    const monthIndices = [
      correctMonth,
      (correctMonth + 3) % 12,
      (correctMonth + 6) % 12,
      (correctMonth + 9) % 12,
    ];
    const deduped = Array.from(new Set(monthIndices));
    const options: OrientationChoice[] = deduped.map((m) => ({
      id: `month_${m}`,
      label: monthLabel(m, language),
      isCorrect: m === correctMonth,
      value: `${m + 1}`,
    }));
    return rotateBy(options, targetDate.getDate());
  }

  if (mode === "weekday") {
    const correctWeekday = targetDate.getDay(); // 0 = Sunday
    const weekdayIndices = [
      correctWeekday,
      (correctWeekday + 2) % 7,
      (correctWeekday + 4) % 7,
      (correctWeekday + 6) % 7,
    ];
    const deduped = Array.from(new Set(weekdayIndices));
    const options: OrientationChoice[] = deduped.map((w) => ({
      id: `weekday_${w}`,
      label: weekdayLabel(w, language),
      isCorrect: w === correctWeekday,
      value: `${w}`,
    }));
    return rotateBy(options, targetDate.getDate());
  }

  // season
  const correctSeason = seasonForMonth(targetDate.getMonth() + 1);
  const options: OrientationChoice[] = SEASONS.map((season) => ({
    id: `season_${season}`,
    // Raw season id; localized at render time via t() so it follows the locale.
    label: season,
    isCorrect: season === correctSeason,
    value: season,
  }));
  return rotateBy(options, targetDate.getDate());
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
  // Pick the random orientation question once on mount. date_weekday (tests +
  // catalog) is preserved exactly; "random" (demo payload) picks one of the
  // three so each launch can surface a different question.
  const [mode] = useState<OrientationMode>(() => {
    if (kind === "random") {
      return RANDOM_MODES[Math.floor(Math.random() * RANDOM_MODES.length)];
    }
    return kind;
  });
  const choices = useMemo(
    () => buildChoices(mode, targetDate, i18n.language),
    [mode, targetDate, i18n.language],
  );
  const expectedChoice = choices.find((choice) => choice.isCorrect) ?? choices[0];

  const questionText =
    mode === "month"
      ? t("exercise.cognitive.orientationMonth")
      : mode === "weekday"
        ? t("exercise.cognitive.orientationWeekday")
        : mode === "season"
          ? t("exercise.cognitive.orientationSeason")
          : prompt;

  // Season labels are stored as ids; translate them for display. Other modes
  // are already formatted via Intl in the user's locale.
  const labelFor = (choice: OrientationChoice) =>
    mode === "season" ? t(`exercise.cognitive.seasons.${choice.value}`) : choice.label;

  useEffect(() => {
    startedAtRef.current = getCurrentTimestampMs();
  }, []);

  const handleSelect = (id: string) => {
    if (globalState === "correct_feedback" || globalState === "incorrect_feedback") {
      return;
    }

    const choice = choices.find((item) => item.id === id);
    if (!choice) return;

    const matchedExpected = choice.isCorrect;
    const responseMs = Math.max(0, getCurrentTimestampMs() - startedAtRef.current);

    setSelectedId(choice.id);
    setCheckedId(choice.id);
    saveCognitiveRoutineResult({
      type: "orientation_practice",
      completed: true,
      metadata: {
        kind: mode,
        targetDateISO: toIsoDate(targetDate),
        locale: i18n.language,
        expectedOption: {
          id: expectedChoice.id,
          label: labelFor(expectedChoice),
          value: expectedChoice.value,
          offsetDays: expectedChoice.offsetDays,
          isoDate: expectedChoice.isoDate,
        },
        selectedOption: {
          id: choice.id,
          label: labelFor(choice),
          value: choice.value,
          offsetDays: choice.offsetDays,
          isoDate: choice.isoDate,
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
        <span className="text-base font-bold uppercase tracking-wide text-blue-500">
          {t("exercise.cognitive.orientation")}
        </span>
        <h2 className="text-4xl font-extrabold leading-snug text-ink">{questionText}</h2>
        <p className="text-base font-bold leading-relaxed text-gray-600">
          {t("exercise.cognitive.orientationGuide")}
        </p>
      </div>

      {mode === "date_weekday" && (
        <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-extrabold uppercase tracking-wide text-blue-600">
            {t("exercise.cognitive.orientationTodayLabel")}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-ink">
            {t("exercise.cognitive.orientationTodayHelper")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {choices.map((choice) => {
          let state: "idle" | "selected" | "correct" | "incorrect" | "disabled" = "idle";

          if (checkedId) {
            if (choice.isCorrect) {
              state = "correct";
            } else if (choice.id === checkedId) {
              state = "incorrect";
            } else {
              state = "disabled";
            }
          } else if (choice.id === selectedId) {
            state = "selected";
          }

          return (
            <ChoiceCard
              key={choice.id}
              id={choice.id}
              label={labelFor(choice)}
              state={state}
              onSelect={handleSelect}
            />
          );
        })}
      </div>
    </div>
  );
}
