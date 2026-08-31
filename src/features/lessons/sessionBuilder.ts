import {
  HARU_WEEK_PLAN,
  getHaruWeekPlan,
  type HaruWeekDay,
} from "@/data/haru7DayExercises";
import type { Exercise } from "@/data/mockExercises";
import {
  getMarketConfig,
  getRuntimeMarketConfig,
  type MarketCode,
} from "@/config/market";

export interface BuildSessionOptions {
  exercises: Exercise[];
  initialExerciseId?: string | null;
  dayOverride?: HaruWeekDay;
  market?: MarketCode;
  now?: Date;
}

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

function getMarketDateISO(date: Date, market: MarketCode): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: getMarketConfig(market).timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getHaruDemoDay(
  date = new Date(),
  market: MarketCode = getRuntimeMarketConfig().market,
): HaruWeekDay | undefined {
  const dateISO = getMarketDateISO(date, market);
  return HARU_WEEK_PLAN.find(
    (plan) => plan.dateISOByMarket[market] === dateISO,
  )?.day;
}

export function buildDailySessionExercises({
  exercises,
  initialExerciseId,
  dayOverride,
  market = getRuntimeMarketConfig().market,
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

  const demoDay = dayOverride ?? getHaruDemoDay(now, market);
  const selectedIds = demoDay
    ? getHaruWeekPlan(demoDay, market).exerciseIds
    : DEMO_ROUTINE_IDS;

  return selectedIds
    .map((id) => exercises.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is Exercise => Boolean(exercise));
}
