import {
  HARU_WEEK_PLAN,
  HARU_WEEK_QUESTION_META,
  haru7DayExercises,
  type HaruQuestionResponseType,
  type HaruWeekDay,
} from "@/data/haru7DayExercises";
import type { Exercise } from "@/data/mockExercises";

const exerciseById = new Map(haru7DayExercises.map((exercise) => [exercise.id, exercise]));
const metaById = new Map(HARU_WEEK_QUESTION_META.map((meta) => [meta.exerciseId, meta]));

export interface OfflineQuestion {
  exercise: Exercise;
  responseType: HaruQuestionResponseType;
  day: HaruWeekDay;
  order: number;
  scored: boolean;
}

export function getOfflineQuestionsForDay(day: HaruWeekDay): OfflineQuestion[] {
  const plan = HARU_WEEK_PLAN.find((entry) => entry.day === day);
  if (!plan) return [];
  return plan.exerciseIds.map((exerciseId) => {
    const exercise = exerciseById.get(exerciseId);
    const meta = metaById.get(exerciseId);
    if (!exercise || !meta) throw new Error(`Offline question data missing: ${exerciseId}`);
    return {
      exercise,
      responseType: meta.responseType,
      day: meta.day,
      order: meta.order,
      scored: meta.scored,
    };
  });
}

export function getOfflineQuestion(exerciseId: string): OfflineQuestion | undefined {
  const exercise = exerciseById.get(exerciseId);
  const meta = metaById.get(exerciseId);
  if (!exercise || !meta) return undefined;
  return {
    exercise,
    responseType: meta.responseType,
    day: meta.day,
    order: meta.order,
    scored: meta.scored,
  };
}

export function isChoiceAnswerCorrect(exercise: Exercise, selectedId: string): boolean | null {
  if (typeof exercise.correctAnswer !== "string") return null;
  return exercise.correctAnswer === selectedId;
}

export function isSequenceAnswerCorrect(exercise: Exercise, selectedIds: readonly string[]): boolean | null {
  if (!Array.isArray(exercise.correctAnswer)) return null;
  return exercise.correctAnswer.length === selectedIds.length &&
    exercise.correctAnswer.every((id, index) => id === selectedIds[index]);
}
