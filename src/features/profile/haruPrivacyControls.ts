import {
  clearCognitiveRoutineResults,
  scrubCognitiveVoiceData,
} from "@/features/cognitive/cognitiveRoutineStorage";
import {
  HARU_ADMIN_USER_ID,
  clearHaruAdminUsageRecords,
  refreshHaruAdminUsageConsent,
  scrubHaruAdminAudioData,
  scrubHaruAdminTranscriptData,
  scrubHaruAdminVoiceData,
} from "@/features/lessons/haruAdminUsageRecordStorage";
import {
  clearHaruDemoSessions,
  scrubHaruDemoVoiceData,
} from "@/features/lessons/haruDemoSessionStorage";
import {
  authorizeHaruRagReenrollment,
  clearHaruRagOutbox,
  enqueueHaruRagUserDeletion,
} from "@/features/lessons/haruRagSync";
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
import { clearHaruTelemetry } from "@/features/analytics/client";
import { getRuntimeMarketConfig } from "@/config/market";
import { submitHaruConsentReceipt } from "@/features/profile/haruDataApi";

export const HARU_PRIVACY_CLEANUP_PENDING_KEY = "haruPrivacyCleanupPending";

interface HaruPrivacyCleanupIntent {
  longitudinalDeletion: boolean;
  personalizationDeletion: boolean;
  analyticsDeletion: boolean;
  processingCancellation: boolean;
  transcriptScrub: boolean;
  audioScrub: boolean;
  requestedAt: string;
  requestId: string;
}

interface PersistedCleanupIntent {
  key: string;
  intent: HaruPrivacyCleanupIntent;
}

const PERMISSION_KEYS: Array<keyof HaruConsentPermissions> = [
  "usageAnalytics",
  "voiceRecording",
  "sttProcessing",
  "transcriptStorage",
  "audioStorage",
  "longitudinalUsageStorage",
  "personalizedQuestionUse",
  "familySharing",
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
    typeof value.requestedAt !== "string" ||
    !Number.isFinite(Date.parse(value.requestedAt))
  ) {
    return null;
  }
  const legacyVoiceScrub = value.voiceScrub === true;
  return {
    longitudinalDeletion: value.longitudinalDeletion,
    personalizationDeletion:
      typeof value.personalizationDeletion === "boolean"
        ? value.personalizationDeletion
        : value.longitudinalDeletion,
    analyticsDeletion:
      typeof value.analyticsDeletion === "boolean"
        ? value.analyticsDeletion
        : value.longitudinalDeletion,
    processingCancellation:
      typeof value.processingCancellation === "boolean"
        ? value.processingCancellation
        : legacyVoiceScrub,
    transcriptScrub:
      typeof value.transcriptScrub === "boolean"
        ? value.transcriptScrub
        : legacyVoiceScrub,
    audioScrub:
      typeof value.audioScrub === "boolean"
        ? value.audioScrub
        : legacyVoiceScrub,
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
    personalizationDeletion: true,
    analyticsDeletion: true,
    processingCancellation: true,
    transcriptScrub: true,
    audioScrub: true,
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
  const personalizationDeletion =
    !consent.personalizedQuestionUse || longitudinalDeletion;
  const analyticsDeletion = !consent.usageAnalytics || longitudinalDeletion;
  const processingCancellation =
    !consent.voiceRecording ||
    !consent.sttProcessing ||
    !consent.transcriptStorage ||
    !consent.audioStorage ||
    longitudinalDeletion;
  const transcriptScrub = !consent.transcriptStorage || longitudinalDeletion;
  const audioScrub = !consent.audioStorage || longitudinalDeletion;
  if (
    !longitudinalDeletion &&
    !personalizationDeletion &&
    !analyticsDeletion &&
    !processingCancellation &&
    !transcriptScrub &&
    !audioScrub
  ) {
    return null;
  }
  return {
    longitudinalDeletion,
    personalizationDeletion,
    analyticsDeletion,
    processingCancellation,
    transcriptScrub,
    audioScrub,
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

  if (intent.personalizationDeletion) {
    results.push(runBooleanCleanup(clearHaruRagOutbox));
    results.push(
      runBooleanCleanup(() => enqueueHaruRagUserDeletion(HARU_ADMIN_USER_ID)),
    );
  }

  if (intent.analyticsDeletion) {
    results.push(await runAsyncCleanup(clearHaruTelemetry));
  }

  if (intent.transcriptScrub && intent.audioScrub) {
    results.push(await runAsyncCleanup(scrubHaruAdminVoiceData));
  } else if (intent.transcriptScrub) {
    results.push(await runAsyncCleanup(scrubHaruAdminTranscriptData));
  } else if (intent.audioScrub) {
    results.push(await runAsyncCleanup(scrubHaruAdminAudioData));
  }

  if (intent.transcriptScrub) {
    results.push(runBooleanCleanup(scrubHaruDemoVoiceData));
    results.push(runBooleanCleanup(scrubCognitiveVoiceData));
    results.push(runBooleanCleanup(scrubMemoryVoiceData));
  }

  if (
    intent.processingCancellation ||
    intent.transcriptScrub ||
    intent.audioScrub
  ) {
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
    usageAnalytics: current.usageAnalytics,
    voiceRecording: current.voiceRecording,
    sttProcessing: current.sttProcessing,
    transcriptStorage: current.transcriptStorage,
    audioStorage: current.audioStorage,
    longitudinalUsageStorage: current.longitudinalUsageStorage,
    personalizedQuestionUse: current.personalizedQuestionUse,
    familySharing: current.familySharing,
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
  if (
    desired.longitudinalUsageStorage &&
    desired.personalizedQuestionUse &&
    (!current.longitudinalUsageStorage || !current.personalizedQuestionUse)
  ) {
    if (!authorizeHaruRagReenrollment(HARU_ADMIN_USER_ID)) {
      throw new Error("haru-rag-reenrollment-write-failed");
    }
  }

  const next = permissionsDiffer(current, desired)
    ? updateHaruConsent(desired)
    : current;

  const finalConsentNeedsSync =
    current.longitudinalUsageStorage ||
    !cleanupRequired ||
    permissionsDiffer(cleanupConsent, desired);
  if (finalConsentNeedsSync && !refreshHaruAdminUsageConsent()) {
    throw new Error("haru-admin-consent-sync-failed");
  }
  void submitHaruConsentReceipt(next, {
    market: getRuntimeMarketConfig().market,
  });
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
