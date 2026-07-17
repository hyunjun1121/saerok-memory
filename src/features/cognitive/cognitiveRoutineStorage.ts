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
const MAX_RESULTS = 4_000;
const RETENTION_MS = 365 * 24 * 60 * 60 * 1_000;

const ROUTINE_TYPES = new Set<RoutineType>([
  "delayed_word_recall",
  "attention_pattern",
  "digit_span_practice",
  "verbal_fluency_practice",
  "trail_switching_practice",
  "stroop_touch_practice",
  "orientation_practice",
  "shape_copy_practice",
  "speech_repeat_practice",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactPersistedValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(compactPersistedValue);
  }
  if (!isRecord(value)) {
    return value;
  }

  const compact: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, nestedValue]) => {
    // Canvas pixels and the full pointer trace are preview/debug artifacts, not
    // longitudinal routine telemetry. Their compact counters remain intact.
    if (key === "dataUrl" || key === "sampledPath") {
      return;
    }
    // Browser object URLs expire with the document and can expose local media
    // while the page is alive. Durable URLs/opaque identifiers remain allowed.
    if (
      key === "audioAssetUrl" &&
      typeof nestedValue === "string" &&
      nestedValue.startsWith("blob:")
    ) {
      return;
    }
    compact[key] = compactPersistedValue(nestedValue);
  });
  return compact;
}

function isRoutineResult(value: unknown): value is RoutineResult {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.type === "string" &&
    ROUTINE_TYPES.has(value.type as RoutineType) &&
    typeof value.timestamp === "string" &&
    Number.isFinite(Date.parse(value.timestamp)) &&
    typeof value.completed === "boolean" &&
    (value.metadata === undefined || isRecord(value.metadata))
  );
}

function compactResult(result: RoutineResult): RoutineResult {
  if (!result.metadata) return result;
  return {
    ...result,
    metadata: compactPersistedValue(result.metadata) as Record<string, unknown>,
  };
}

function retainRecentResults(results: RoutineResult[], nowMs = Date.now()): RoutineResult[] {
  const cutoffMs = nowMs - RETENTION_MS;
  return results
    .filter((result) => Date.parse(result.timestamp) >= cutoffMs)
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
    .slice(-MAX_RESULTS);
}

export function getCognitiveRoutineResults(): RoutineResult[] {
  const results = readJsonArray<unknown>(STORAGE_KEY)
    .filter(isRoutineResult)
    .map(compactResult);
  return retainRecentResults(results);
}

export function saveCognitiveRoutineResult(result: Omit<RoutineResult, "id" | "timestamp"> & Partial<Pick<RoutineResult, "timestamp">>): void {
  const results = getCognitiveRoutineResults();

  const newResult: RoutineResult = {
    id: `routine_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: result.timestamp || new Date().toISOString(),
    ...result
  };

  results.push(compactResult(newResult));

  writeJson(STORAGE_KEY, retainRecentResults(results));
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
