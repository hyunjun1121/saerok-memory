import type { HaruWeekDay } from "@/data/haru7DayExercises";

const STORAGE_KEY = "haru:offline:progress:v1";

export interface OfflineResponseRecord {
  exerciseId: string;
  kind: "single_choice" | "button_sequence" | "voice";
  selectedIds: string[];
  responseMs: number;
  completedAt: string;
}

export interface OfflineProgress {
  schemaVersion: 1;
  activeDay: HaruWeekDay;
  completedDays: HaruWeekDay[];
  responses: OfflineResponseRecord[];
}

const initialProgress = (): OfflineProgress => ({
  schemaVersion: 1,
  activeDay: 1,
  completedDays: [],
  responses: [],
});

function resolveStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function isWeekDay(value: unknown): value is HaruWeekDay {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 7;
}

export function loadOfflineProgress(storage?: Storage): OfflineProgress {
  const target = resolveStorage(storage);
  if (!target) return initialProgress();
  try {
    const raw = target.getItem(STORAGE_KEY);
    if (!raw) return initialProgress();
    const parsed = JSON.parse(raw) as Partial<OfflineProgress>;
    if (parsed.schemaVersion !== 1 || !isWeekDay(parsed.activeDay)) return initialProgress();
    const completedDays = Array.isArray(parsed.completedDays)
      ? parsed.completedDays.filter(isWeekDay)
      : [];
    const responses = Array.isArray(parsed.responses)
      ? parsed.responses.filter((entry): entry is OfflineResponseRecord => {
          if (!entry || typeof entry !== "object") return false;
          const record = entry as Partial<OfflineResponseRecord>;
          return (
            typeof record.exerciseId === "string" &&
            (record.kind === "single_choice" || record.kind === "button_sequence" || record.kind === "voice") &&
            Array.isArray(record.selectedIds) &&
            typeof record.responseMs === "number" &&
            typeof record.completedAt === "string"
          );
        })
      : [];
    return { schemaVersion: 1, activeDay: parsed.activeDay, completedDays, responses };
  } catch {
    return initialProgress();
  }
}

export function saveOfflineProgress(
  progress: OfflineProgress,
  storage?: Storage,
): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Local persistence must never block the activity.
  }
}

export function appendOfflineResponse(
  progress: OfflineProgress,
  response: OfflineResponseRecord,
): OfflineProgress {
  return {
    ...progress,
    responses: [...progress.responses.filter((entry) => entry.exerciseId !== response.exerciseId), response],
  };
}

export function removeOfflineResponse(
  progress: OfflineProgress,
  exerciseId: string,
): OfflineProgress {
  const responses = progress.responses.filter(
    (response) => response.exerciseId !== exerciseId,
  );
  return responses.length === progress.responses.length
    ? progress
    : { ...progress, responses };
}

export function restartOfflineDay(
  progress: OfflineProgress,
  day: HaruWeekDay,
  exerciseIds: readonly string[],
): OfflineProgress {
  const dayExerciseIds = new Set(exerciseIds);
  const responses = progress.responses.filter(
    (response) => !dayExerciseIds.has(response.exerciseId),
  );
  const completedDays = progress.completedDays.filter(
    (completedDay) => completedDay !== day,
  );
  if (
    progress.activeDay === day &&
    responses.length === progress.responses.length &&
    completedDays.length === progress.completedDays.length
  ) {
    return progress;
  }
  return {
    ...progress,
    activeDay: day,
    completedDays,
    responses,
  };
}

export function completeOfflineDay(progress: OfflineProgress, day: HaruWeekDay): OfflineProgress {
  const completedDays = progress.completedDays.includes(day)
    ? progress.completedDays
    : [...progress.completedDays, day];
  const nextDay = Math.max(
    progress.activeDay,
    Math.min(7, day + 1),
  ) as HaruWeekDay;
  return { ...progress, completedDays, activeDay: nextDay };
}

export const OFFLINE_PROGRESS_STORAGE_KEY = STORAGE_KEY;
