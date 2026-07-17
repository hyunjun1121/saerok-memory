import {
  HARU_WEEK_PLAN,
  getHaruWeekPlan,
  type HaruWeekDay,
} from "@/data/haru7DayExercises";
import type { Exercise } from "@/data/mockExercises";

export interface BuildSessionOptions {
  exercises: Exercise[];
  initialExerciseId?: string | null;
  dayOverride?: HaruWeekDay;
  now?: Date;
}

const KOREA_TIME_ZONE = "Asia/Seoul";

// Normal routine retained outside the authored July 20–26 demo period. The
// persona week contains fixed weekday/month answers, so serving it forever by
// weekday would eventually show factually wrong prompts.
export const DEMO_ROUTINE_IDS = [
  "ex_orientation",
  "ex_recall_dining",
  "ex_market_money",
  "ex_number_pattern",
  "ex_stroop_touch",
  "ex_verbal_fluency",
  "ex_audio",
  "ex_shape",
  "ex_proverb",
  "ex_mood_voice",
  "ex_6",
];

export function parseHaruWeekDay(value: string | null | undefined): HaruWeekDay | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 7
    ? (parsed as HaruWeekDay)
    : undefined;
}

function getKoreaDateISO(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getHaruDemoDay(date = new Date()): HaruWeekDay | undefined {
  const dateISO = getKoreaDateISO(date);
  return HARU_WEEK_PLAN.find((plan) => plan.dateISO === dateISO)?.day;
}

export function buildDailySessionExercises({
  exercises,
  initialExerciseId,
  dayOverride,
  now,
}: BuildSessionOptions): Exercise[] {
  // Capture / deeplink path: start at the requested exercise with no cap, so
  // every authored exercise remains reachable exactly as authored.
  if (initialExerciseId) {
    const index = exercises.findIndex((exercise) => exercise.id === initialExerciseId);
    if (index >= 0) {
      return exercises.slice(index);
    }
  }

  const demoDay = dayOverride ?? getHaruDemoDay(now);
  const selectedIds = demoDay
    ? getHaruWeekPlan(demoDay).exerciseIds
    : DEMO_ROUTINE_IDS;

  return selectedIds
    .map((id) => exercises.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is Exercise => Boolean(exercise));
}
