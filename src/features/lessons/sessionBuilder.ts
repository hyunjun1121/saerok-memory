import type { Exercise } from "../../data/mockExercises";
import type { MemoryCard } from "../memory/types";
import { generateMemoryReviewExercise } from "../memory/memoryReviewGenerator";
import { getDailyRoutinePlan } from "../../data/dailyRoutinePlan";

// Maximum exercises in a normal (non-capture) daily session. Keeps the routine
// short (SP-06: "오늘 할 것만 본다", 3-5 minute flow) without removing content
// from capture/screenshot paths.
const MAX_NORMAL_SESSION = 8;

export interface BuildSessionOptions {
  exercises: Exercise[];
  memoryCards: MemoryCard[];
  initialExerciseId?: string | null;
  now?: Date;
}

function pickReviewCard(memoryCards: MemoryCard[], nowMs: number): MemoryCard | undefined {
  if (memoryCards.length === 0) {
    return undefined;
  }

  // Due cards first (SP-06 priority); otherwise fall back to the first card so a
  // review can still happen.
  const due = memoryCards.find((card) => {
    const dueAt = card.reviewState?.dueAt;
    if (!dueAt) return false;
    const dueMs = new Date(dueAt).getTime();
    return !Number.isNaN(dueMs) && dueMs <= nowMs;
  });

  return due ?? memoryCards[0];
}

// Whether an exercise belongs to today's routine domain. An exercise matches if
// its domain equals today's theme OR today's weekday is in its recommendedDays.
// "review" days skip this filter entirely (every exercise stays, fallback order).
function matchesTodayDomain(exercise: Exercise, domain: string, weekday: number): boolean {
  if (exercise.payload.domain === domain) return true;
  return Boolean(exercise.payload.recommendedDays?.includes(weekday));
}

export function buildDailySessionExercises({
  exercises,
  memoryCards,
  initialExerciseId,
  now = new Date(),
}: BuildSessionOptions): Exercise[] {
  const session: Exercise[] = [...exercises];

  const reviewCard = pickReviewCard(memoryCards, now.getTime());
  if (reviewCard) {
    const reviewExercise = generateMemoryReviewExercise(reviewCard, "lesson_1");
    if (reviewExercise) {
      session.splice(2, 0, reviewExercise);
    }
  }

  // Capture path: when a specific exercise is requested (screenshots / deep
  // links), slice from that exercise with no cap and no weekday reorder so every
  // exercise remains reachable exactly as before.
  if (initialExerciseId) {
    const index = session.findIndex((exercise) => exercise.id === initialExerciseId);
    if (index >= 0) {
      return session.slice(index);
    }
  }

  // Normal daily flow: bring today's-domain exercises toward the front. The
  // warm-up (session[0]) always stays first; the rest is stably reordered so
  // matching items lead while non-matching keep their relative order. If today
  // is a "review" day nothing matches, so the original order is preserved.
  const todayPlan = getDailyRoutinePlan(now);
  if (todayPlan.domain !== "review" && session.length > 1) {
    const weekday = now.getDay();
    const warmUp = session[0];
    const rest = session.slice(1);
    rest.sort((a, b) => {
      const aMatch = matchesTodayDomain(a, todayPlan.domain, weekday) ? 1 : 0;
      const bMatch = matchesTodayDomain(b, todayPlan.domain, weekday) ? 1 : 0;
      return bMatch - aMatch; // matching first, stable for equal scores
    });
    return [warmUp, ...rest].slice(0, MAX_NORMAL_SESSION);
  }

  return session.slice(0, MAX_NORMAL_SESSION);
}
