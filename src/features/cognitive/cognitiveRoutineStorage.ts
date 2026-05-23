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

export function getCognitiveRoutineResults(): RoutineResult[] {
  try {
    const data = localStorage.getItem("cognitiveRoutineResults");
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to parse cognitiveRoutineResults", error);
    return [];
  }
}

export function saveCognitiveRoutineResult(result: Omit<RoutineResult, "id" | "timestamp"> & Partial<Pick<RoutineResult, "timestamp">>): void {
  const results = getCognitiveRoutineResults();

  const newResult: RoutineResult = {
    id: `routine_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: result.timestamp || new Date().toISOString(),
    ...result
  };

  results.push(newResult);

  try {
    localStorage.setItem("cognitiveRoutineResults", JSON.stringify(results));
  } catch (error) {
    console.error("Failed to save cognitiveRoutineResults", error);
  }
}

export function clearCognitiveRoutineResults(): void {
  try {
    localStorage.removeItem("cognitiveRoutineResults");
  } catch (error) {
    console.error("Failed to clear cognitiveRoutineResults", error);
  }
}
