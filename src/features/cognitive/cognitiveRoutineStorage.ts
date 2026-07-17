import { readJsonArray, removeKey, writeJson } from "@/utils/safeStorage";

export type RoutineType =
  | "delayed_word_recall"
  | "attention_pattern"
  | "digit_span_practice"
  | "verbal_fluency_practice"
  | "trail_switching_practice"
  | "stroop_touch_practice"
  | "orientation_practice"
  | "shape_copy_practice"
  | "speech_repeat_practice";

export interface RoutineResult {
  id: string;
  type: RoutineType;
  timestamp: string; // ISO string
  completed: boolean;
  metadata?: Record<string, unknown>;
}

const STORAGE_KEY = "cognitiveRoutineResults";

export function getCognitiveRoutineResults(): RoutineResult[] {
  return readJsonArray<RoutineResult>(STORAGE_KEY);
}

export function saveCognitiveRoutineResult(result: Omit<RoutineResult, "id" | "timestamp"> & Partial<Pick<RoutineResult, "timestamp">>): void {
  const results = getCognitiveRoutineResults();

  const newResult: RoutineResult = {
    id: `routine_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: result.timestamp || new Date().toISOString(),
    ...result
  };

  results.push(newResult);

  writeJson(STORAGE_KEY, results);
}

export function clearCognitiveRoutineResults(): void {
  removeKey(STORAGE_KEY);
}

/**
 * Whether the learner already completed a routine today (local date).
 * Used by the launch auto-start gate: skip 0-tap entry once today is done.
 */
export function isTodayRoutineCompleted(now: Date = new Date()): boolean {
  const today = now.toDateString();
  return getCognitiveRoutineResults().some(
    (r) => r.completed && new Date(r.timestamp).toDateString() === today,
  );
}
