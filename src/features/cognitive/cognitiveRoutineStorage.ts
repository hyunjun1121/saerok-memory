import { getHaruConsent } from "@/features/profile/haruConsentStorage";
import { readJsonArray, writeJson } from "@/utils/safeStorage";

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
export const COGNITIVE_ROUTINE_RESULTS_UPDATED_EVENT =
  "haru:cognitive-routine-results-updated";
const MAX_RESULTS = 4_000;
const RETENTION_MS = 365 * 24 * 60 * 60 * 1_000;

const VOICE_ROUTINE_TYPES = new Set<RoutineType>([
  "verbal_fluency_practice",
  "speech_repeat_practice",
]);

const VOICE_DERIVED_METADATA_KEYS = new Set([
  "entries",
  "uniquecount",
  "repetitioncount",
  "wordcount",
  "speechdurationms",
  "recognitionerror",
  "inputmode",
  "audioasseturl",
  "audioobjectkey",
  "sampleratehz",
  "channels",
  "engine",
  "model",
  "modelrevision",
  "alignermodel",
  "alignerrevision",
  "preprocessingversion",
  "segments",
  "language",
  "confidence",
  "nospeech",
  "derivedannotations",
]);

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

function scrubVoiceDerivedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubVoiceDerivedValue);
  if (!isRecord(value)) return value;

  const scrubbed: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, nestedValue]) => {
    const normalizedKey = key.toLowerCase();
    if (
      VOICE_DERIVED_METADATA_KEYS.has(normalizedKey) ||
      normalizedKey.startsWith("stt") ||
      normalizedKey.includes("transcript") ||
      normalizedKey.includes("similarity") ||
      normalizedKey.startsWith("recognized") ||
      normalizedKey.includes("pronunciation")
    ) {
      return;
    }
    scrubbed[key] = scrubVoiceDerivedValue(nestedValue);
  });
  return scrubbed;
}

function notifyRoutineResultsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COGNITIVE_ROUTINE_RESULTS_UPDATED_EVENT));
}

function clearPersistedResults(notifyWhenAlreadyEmpty = false): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const hadPersistedResults = window.localStorage.getItem(STORAGE_KEY) !== null;
    window.localStorage.removeItem(STORAGE_KEY);
    const removed = window.localStorage.getItem(STORAGE_KEY) === null;
    if (removed && (hadPersistedResults || notifyWhenAlreadyEmpty)) {
      notifyRoutineResultsChanged();
    }
    return removed;
  } catch {
    return false;
  }
}

function persistRoutineResults(results: readonly RoutineResult[]): boolean {
  const saved = writeJson(STORAGE_KEY, results);
  if (saved) notifyRoutineResultsChanged();
  return saved;
}

export function subscribeToCognitiveRoutineResults(
  listener: () => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onLocalUpdate = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(COGNITIVE_ROUTINE_RESULTS_UPDATED_EVENT, onLocalUpdate);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(COGNITIVE_ROUTINE_RESULTS_UPDATED_EVENT, onLocalUpdate);
    window.removeEventListener("storage", onStorage);
  };
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
  if (!getHaruConsent().longitudinalUsageStorage) {
    clearPersistedResults();
    return [];
  }
  const results = readJsonArray<unknown>(STORAGE_KEY)
    .filter(isRoutineResult)
    .map(compactResult);
  return retainRecentResults(results);
}

export function saveCognitiveRoutineResult(
  result: Omit<RoutineResult, "id" | "timestamp"> &
    Partial<Pick<RoutineResult, "timestamp">>,
): string | null {
  if (!getHaruConsent().longitudinalUsageStorage) {
    clearPersistedResults();
    return null;
  }
  const results = getCognitiveRoutineResults();

  const newResult: RoutineResult = {
    id: `routine_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: result.timestamp || new Date().toISOString(),
    ...result,
  };

  results.push(compactResult(newResult));

  return persistRoutineResults(retainRecentResults(results)) ? newResult.id : null;
}

/**
 * Merge background-derived metadata into one existing routine record.
 * Missing ids are deliberately not upserted: a delayed STT job must never
 * recreate a record the learner deleted while transcription was pending.
 */
export function patchCognitiveRoutineResultById(
  id: string,
  metadataPatch: Record<string, unknown>,
): boolean {
  if (!id) return false;
  if (!getHaruConsent().longitudinalUsageStorage) {
    clearPersistedResults();
    return false;
  }
  const results = getCognitiveRoutineResults();
  const index = results.findIndex((result) => result.id === id);
  if (index < 0) return false;

  results[index] = compactResult({
    ...results[index],
    metadata: {
      ...(results[index].metadata ?? {}),
      ...metadataPatch,
    },
  });
  return persistRoutineResults(retainRecentResults(results));
}

export function clearCognitiveRoutineResults(): boolean {
  return clearPersistedResults(true);
}

export function scrubCognitiveVoiceData(): boolean {
  if (!getHaruConsent().longitudinalUsageStorage) {
    return clearPersistedResults();
  }

  const results = getCognitiveRoutineResults().map((result) => {
    if (!VOICE_ROUTINE_TYPES.has(result.type) || !result.metadata) return result;
    return {
      ...result,
      metadata: scrubVoiceDerivedValue(result.metadata) as Record<string, unknown>,
    };
  });
  return persistRoutineResults(retainRecentResults(results));
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
