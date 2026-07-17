import {
  HARU_WEEK_QUESTION_META,
  getHaruWeekPlan,
  type HaruWeekDay,
  type HaruWeekQuestionMeta,
} from "@/data/haru7DayExercises";
import {
  completeHaruDemoSession,
  recordHaruDemoResponse,
  startHaruDemoSession,
  type HaruDemoResponse,
  type HaruDemoSession,
} from "@/features/lessons/haruDemoSessionStorage";

export function canonicalHaruResponse(
  question: HaruWeekQuestionMeta,
  overrides: Partial<HaruDemoResponse> = {},
): HaruDemoResponse {
  const recorded = question.recordedResponse;
  return {
    questionId: question.exerciseId,
    responseType: question.responseType,
    responseTimeMs: recorded.responseTimeMs,
    isCorrect: recorded.isCorrect,
    ...(recorded.selectedOptionId
      ? { selectedOptionId: recorded.selectedOptionId }
      : {}),
    ...(recorded.submittedSequence
      ? { submittedSequence: [...recorded.submittedSequence] }
      : {}),
    ...(question.responseType === "voice"
      ? {
          voiceDurationSeconds: recorded.voiceDurationSeconds ?? 0,
          sttStatus: recorded.sttStatus ?? "failed",
        }
      : {}),
    ...overrides,
  };
}

interface SeedCompletedHaruDayOptions {
  completionMessage?: string;
  endedAt?: Date;
  responseOverrides?: Readonly<
    Partial<Record<string, Partial<HaruDemoResponse>>>
  >;
  startedAt?: Date;
}

export function seedCompletedHaruDemoDay(
  day: HaruWeekDay,
  options: SeedCompletedHaruDayOptions = {},
): HaruDemoSession | null {
  const plan = getHaruWeekPlan(day);
  startHaruDemoSession(day, plan.exerciseIds, options.startedAt);

  HARU_WEEK_QUESTION_META.filter((question) => question.day === day).forEach(
    (question) => {
      recordHaruDemoResponse(
        day,
        canonicalHaruResponse(
          question,
          options.responseOverrides?.[question.exerciseId],
        ),
      );
    },
  );

  return completeHaruDemoSession(
    day,
    options.completionMessage ?? "완료",
    options.endedAt,
  );
}
