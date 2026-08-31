import { getMarketStorageKey, type MarketCode } from "@/config/market";
import {
  clearHaruTelemetry,
  stopHaruTelemetry,
} from "@/features/analytics/client";
import { clearCognitiveRoutineResults } from "@/features/cognitive/cognitiveRoutineStorage";
import { clearCaregiverObservationRecords } from "@/features/family/caregiverObservationStorage";
import { resetWeeklyRewardState } from "@/features/gamification/weeklyRewards";
import { clearHaruAdminUsageRecords } from "@/features/lessons/haruAdminUsageRecordStorage";
import { clearHaruDemoSessions } from "@/features/lessons/haruDemoSessionStorage";
import { clearHaruRagOutbox } from "@/features/lessons/haruRagSync";
import { clearHaruSttRetryOutbox } from "@/features/lessons/haruSttRetry";
import { clearMemoryCards } from "@/features/memory/memoryCardStorage";
import { HARU_CONSENT_STORAGE_KEY } from "@/features/profile/haruConsentStorage";
import { clearSttJobQueue } from "@/features/speech/sttJobQueue";
import { removeKey } from "@/utils/safeStorage";

export type HaruLocalDeletionSubsystem =
  | "adminRecords"
  | "backgroundSpeech"
  | "ragUploadQueue"
  | "demoSessions"
  | "cognitiveRoutines"
  | "memoryCards"
  | "caregiverObservations"
  | "telemetry"
  | "profile"
  | "gamification";

export type HaruLocalDeletionStepResult =
  | { status: "cleared" }
  | {
      status: "failed";
      reason: "exception" | "reported_failure" | "verification_failed";
    };

export interface HaruLocalDataDeletionResult {
  complete: boolean;
  subsystems: Record<HaruLocalDeletionSubsystem, HaruLocalDeletionStepResult>;
  preserved: {
    consent: boolean;
    enrollment: boolean;
  };
}

export interface HaruLocalDataDeletionOptions {
  market: MarketCode;
}

const PROFILE_STORAGE_KEY = "learnerProfile";
const LANGUAGE_STORAGE_KEY = "memoryGardenLang";
const CAREGIVER_STORAGE_KEY = "caregiverObservationRecords";
const GAMIFICATION_STORAGE_KEYS = [
  "streakState",
  "gardenState",
  "weeklyRewardState",
] as const;

function readRawStorage(key: string): string | null | undefined {
  try {
    return typeof window === "undefined" || !window.localStorage
      ? undefined
      : window.localStorage.getItem(key);
  } catch {
    return undefined;
  }
}

function isRemoved(key: string): boolean {
  return readRawStorage(key) === null;
}

async function runDeletionStep(
  operation: () => void | boolean | Promise<void | boolean>,
  verify?: () => boolean,
): Promise<HaruLocalDeletionStepResult> {
  let reported: void | boolean;
  try {
    reported = await operation();
  } catch {
    return { status: "failed", reason: "exception" };
  }
  if (reported === false) {
    return { status: "failed", reason: "reported_failure" };
  }
  if (verify && !verify()) {
    return { status: "failed", reason: "verification_failed" };
  }
  return { status: "cleared" };
}

function snapshotPreservedStorage(): {
  consent: string | null | undefined;
  enrollments: Record<MarketCode, string | null | undefined>;
} {
  return {
    consent: readRawStorage(HARU_CONSENT_STORAGE_KEY),
    enrollments: {
      kr: readRawStorage(getMarketStorageKey("enrollment", "kr")),
      jp: readRawStorage(getMarketStorageKey("enrollment", "jp")),
    },
  };
}

export async function clearHaruLocalParticipantData(
  options: HaruLocalDataDeletionOptions,
): Promise<HaruLocalDataDeletionResult> {
  const preservedBefore = snapshotPreservedStorage();
  const launchKey = getMarketStorageKey("analytics:launched", options.market);
  const subsystems = {} as Record<
    HaruLocalDeletionSubsystem,
    HaruLocalDeletionStepResult
  >;

  subsystems.adminRecords = await runDeletionStep(clearHaruAdminUsageRecords);
  subsystems.backgroundSpeech = await runDeletionStep(async () => {
    const queueCleared = await clearSttJobQueue();
    const retryCleared = clearHaruSttRetryOutbox();
    return queueCleared !== false && retryCleared;
  });
  subsystems.ragUploadQueue = await runDeletionStep(clearHaruRagOutbox);
  subsystems.demoSessions = await runDeletionStep(clearHaruDemoSessions);
  subsystems.cognitiveRoutines = await runDeletionStep(
    clearCognitiveRoutineResults,
  );
  subsystems.memoryCards = await runDeletionStep(clearMemoryCards);
  subsystems.caregiverObservations = await runDeletionStep(
    () => {
      clearCaregiverObservationRecords();
      return removeKey(CAREGIVER_STORAGE_KEY);
    },
    () => isRemoved(CAREGIVER_STORAGE_KEY),
  );
  subsystems.telemetry = await runDeletionStep(
    async () => {
      stopHaruTelemetry();
      await clearHaruTelemetry();
      return removeKey(launchKey);
    },
    () => isRemoved(launchKey),
  );
  subsystems.profile = await runDeletionStep(
    () =>
      [PROFILE_STORAGE_KEY, LANGUAGE_STORAGE_KEY].every((key) =>
        removeKey(key),
      ),
    () =>
      [PROFILE_STORAGE_KEY, LANGUAGE_STORAGE_KEY].every((key) =>
        isRemoved(key),
      ),
  );
  subsystems.gamification = await runDeletionStep(
    () => {
      resetWeeklyRewardState();
      return GAMIFICATION_STORAGE_KEYS.every((key) => removeKey(key));
    },
    () => GAMIFICATION_STORAGE_KEYS.every(isRemoved),
  );

  const preservedAfter = snapshotPreservedStorage();
  const preserved = {
    consent:
      preservedBefore.consent !== undefined &&
      preservedBefore.consent === preservedAfter.consent,
    enrollment: (["kr", "jp"] as const).every(
      (market) =>
        preservedBefore.enrollments[market] !== undefined &&
        preservedBefore.enrollments[market] ===
          preservedAfter.enrollments[market],
    ),
  };
  const complete =
    Object.values(subsystems).every((result) => result.status === "cleared") &&
    preserved.consent &&
    preserved.enrollment;

  return { complete, subsystems, preserved };
}
