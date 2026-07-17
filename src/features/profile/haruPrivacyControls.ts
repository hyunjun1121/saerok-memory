import {
  clearCognitiveRoutineResults,
  scrubCognitiveVoiceData,
} from "@/features/cognitive/cognitiveRoutineStorage";
import {
  HARU_ADMIN_USER_ID,
  clearHaruAdminUsageRecords,
  refreshHaruAdminUsageConsent,
  scrubHaruAdminVoiceData,
} from "@/features/lessons/haruAdminUsageRecordStorage";
import {
  clearHaruDemoSessions,
  scrubHaruDemoVoiceData,
} from "@/features/lessons/haruDemoSessionStorage";
import { authorizeHaruRagReenrollment } from "@/features/lessons/haruRagSync";
import { clearHaruSttRetryOutbox } from "@/features/lessons/haruSttRetry";
import {
  clearMemoryCards,
  scrubMemoryVoiceData,
} from "@/features/memory/memoryCardStorage";
import { clearSttJobQueue } from "@/features/speech/sttJobQueue";
import {
  getHaruConsent,
  updateHaruConsent,
  type HaruConsentPermissions,
  type HaruConsentState,
} from "@/features/profile/haruConsentStorage";
import { removeKey, writeJson } from "@/utils/safeStorage";

export const HARU_PRIVACY_CLEANUP_PENDING_KEY = "haruPrivacyCleanupPending";

interface HaruPrivacyCleanupIntent {
  longitudinalDeletion: boolean;
  voiceScrub: boolean;
  requestedAt: string;
  requestId: string;
}

interface PersistedCleanupIntent {
  key: string;
  intent: HaruPrivacyCleanupIntent;
}

const PERMISSION_KEYS: Array<keyof HaruConsentPermissions> = [
  "voiceRecording",
  "sttProcessing",
  "longitudinalUsageStorage",
  "personalizedQuestionUse",
];

let privacyOperationChain: Promise<void> = Promise.resolve();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function createRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Restricted browsers use a local opaque fallback.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function isCleanupMarkerKey(key: string): boolean {
  return (
    key === HARU_PRIVACY_CLEANUP_PENDING_KEY ||
    key.startsWith(`${HARU_PRIVACY_CLEANUP_PENDING_KEY}:`)
  );
}

function normalizeCleanupIntent(
  value: unknown,
  fallbackRequestId: string,
): HaruPrivacyCleanupIntent | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.longitudinalDeletion !== "boolean" ||
    typeof value.voiceScrub !== "boolean" ||
    typeof value.requestedAt !== "string" ||
    !Number.isFinite(Date.parse(value.requestedAt))
  ) {
    return null;
  }
  return {
    longitudinalDeletion: value.longitudinalDeletion,
    voiceScrub: value.voiceScrub,
    requestedAt: value.requestedAt,
    requestId:
      typeof value.requestId === "string" && value.requestId.trim().length > 0
        ? value.requestId.trim()
        : fallbackRequestId,
  };
}

function malformedCleanupIntent(key: string): HaruPrivacyCleanupIntent {
  return {
    longitudinalDeletion: true,
    voiceScrub: true,
    requestedAt: new Date(0).toISOString(),
    requestId: `malformed-${key}`,
  };
}

function readPendingCleanups(): PersistedCleanupIntent[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && isCleanupMarkerKey(key)) keys.push(key);
    }
    return keys.sort().map((key) => {
      const fallbackRequestId = key.slice(HARU_PRIVACY_CLEANUP_PENDING_KEY.length + 1);
      try {
        const raw = window.localStorage.getItem(key);
        const parsed = raw === null ? null : (JSON.parse(raw) as unknown);
        return {
          key,
          intent:
            normalizeCleanupIntent(parsed, fallbackRequestId || "legacy") ??
            malformedCleanupIntent(key),
        };
      } catch {
        return { key, intent: malformedCleanupIntent(key) };
      }
    });
  } catch {
    return [];
  }
}

function cleanupIntentForConsent(
  consent: HaruConsentState,
): HaruPrivacyCleanupIntent | null {
  const longitudinalDeletion = !consent.longitudinalUsageStorage;
  const voiceScrub = !consent.voiceRecording || !consent.sttProcessing;
  if (!longitudinalDeletion && !voiceScrub) return null;
  return {
    longitudinalDeletion,
    voiceScrub,
    requestedAt: new Date().toISOString(),
    requestId: createRequestId(),
  };
}

function persistCleanupIntent(intent: HaruPrivacyCleanupIntent): PersistedCleanupIntent {
  const key = `${HARU_PRIVACY_CLEANUP_PENDING_KEY}:${intent.requestId}`;
  if (!writeJson(key, intent)) {
    throw new Error("haru-privacy-cleanup-marker-write-failed");
  }
  return { key, intent };
}

function runBooleanCleanup(operation: () => boolean): boolean {
  try {
    return operation();
  } catch {
    return false;
  }
}

async function runAsyncCleanup(
  operation: () => Promise<void | boolean>,
): Promise<boolean> {
  try {
    return (await operation()) !== false;
  } catch {
    return false;
  }
}

async function executeCleanup(intent: HaruPrivacyCleanupIntent): Promise<void> {
  const results: boolean[] = [];

  if (intent.longitudinalDeletion) {
    results.push(await runAsyncCleanup(clearHaruAdminUsageRecords));
    results.push(runBooleanCleanup(clearHaruDemoSessions));
    results.push(runBooleanCleanup(clearCognitiveRoutineResults));
    results.push(runBooleanCleanup(clearMemoryCards));
  }

  if (intent.voiceScrub) {
    results.push(await runAsyncCleanup(scrubHaruAdminVoiceData));
    results.push(runBooleanCleanup(scrubHaruDemoVoiceData));
    results.push(runBooleanCleanup(scrubCognitiveVoiceData));
    results.push(runBooleanCleanup(scrubMemoryVoiceData));
    results.push(await runAsyncCleanup(clearSttJobQueue));
    results.push(runBooleanCleanup(clearHaruSttRetryOutbox));
  }

  if (results.some((result) => !result)) {
    throw new Error("haru-privacy-cleanup-failed");
  }
}

async function executePersistedCleanup(marker: PersistedCleanupIntent): Promise<void> {
  await executeCleanup(marker.intent);
  if (!removeKey(marker.key)) {
    throw new Error("haru-privacy-cleanup-marker-remove-failed");
  }
}

async function drainPendingCleanups(): Promise<void> {
  while (true) {
    const pending = readPendingCleanups();
    if (pending.length === 0) return;
    for (const marker of pending) {
      await executePersistedCleanup(marker);
    }
  }
}

async function resumePrivacyCleanupInternal(): Promise<void> {
  if (readPendingCleanups().length === 0) {
    const currentIntent = cleanupIntentForConsent(getHaruConsent());
    if (currentIntent) persistCleanupIntent(currentIntent);
  }
  await drainPendingCleanups();
}

function serializePrivacyOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = privacyOperationChain.then(operation);
  privacyOperationChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function desiredPermissions(
  current: HaruConsentState,
  update: Partial<HaruConsentPermissions>,
): HaruConsentPermissions {
  const desired: HaruConsentPermissions = {
    voiceRecording: current.voiceRecording,
    sttProcessing: current.sttProcessing,
    longitudinalUsageStorage: current.longitudinalUsageStorage,
    personalizedQuestionUse: current.personalizedQuestionUse,
  };
  for (const key of PERMISSION_KEYS) {
    if (typeof update[key] === "boolean") desired[key] = update[key];
  }
  return desired;
}

function permissionsDiffer(
  consent: HaruConsentState,
  desired: HaruConsentPermissions,
): boolean {
  return PERMISSION_KEYS.some((key) => consent[key] !== desired[key]);
}

async function applyConsentChangeInternal(
  update: Partial<HaruConsentPermissions>,
): Promise<HaruConsentState> {
  const previous = getHaruConsent();
  const desired = desiredPermissions(previous, update);
  const immediateDenials: Partial<HaruConsentPermissions> = {};
  for (const key of PERMISSION_KEYS) {
    if (previous[key] && desired[key] === false) immediateDenials[key] = false;
  }

  let cleanupConsent = previous;
  if (Object.keys(immediateDenials).length > 0) {
    cleanupConsent = updateHaruConsent(immediateDenials);
  }

  const hadPendingCleanup = readPendingCleanups().length > 0;
  const cleanupRequired = Boolean(
    hadPendingCleanup || cleanupIntentForConsent(cleanupConsent),
  );
  if (cleanupRequired) {
    await resumePrivacyCleanupInternal();
  }

  const current = getHaruConsent();
  if (!current.longitudinalUsageStorage && desired.longitudinalUsageStorage) {
    if (!authorizeHaruRagReenrollment(HARU_ADMIN_USER_ID)) {
      throw new Error("haru-rag-reenrollment-write-failed");
    }
  }

  const next = permissionsDiffer(current, desired)
    ? updateHaruConsent(desired)
    : current;

  const finalConsentNeedsSync =
    !cleanupRequired || permissionsDiffer(cleanupConsent, desired);
  if (finalConsentNeedsSync && !refreshHaruAdminUsageConsent()) {
    throw new Error("haru-admin-consent-sync-failed");
  }
  return next;
}

export function resumeHaruPrivacyCleanup(): Promise<void> {
  return serializePrivacyOperation(resumePrivacyCleanupInternal);
}

export function applyHaruConsentChange(
  update: Partial<HaruConsentPermissions>,
): Promise<HaruConsentState> {
  return serializePrivacyOperation(() => applyConsentChangeInternal(update));
}
