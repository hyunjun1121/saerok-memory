import {
  deleteHaruAdminAudio,
  readHaruAdminAudio,
  storeHaruAdminAudio,
  type HaruAdminAudioRetentionStatus,
} from "@/features/lessons/haruAdminAudioStorage";
import { hasHaruAdminDeletionFence } from "@/features/lessons/haruAdminDeletionFenceStorage";
import {
  getCognitiveRoutineResults,
  patchCognitiveRoutineResultById,
  type RoutineResult,
} from "@/features/cognitive/cognitiveRoutineStorage";
import {
  getMemoryCardById,
  patchMemoryCueCardById,
} from "@/features/memory/memoryCardStorage";
import {
  extractMemoryStoryCues,
  summarizeMemoryStory,
} from "@/features/memory/memoryStory";
import {
  getHaruConsent,
  subscribeToHaruConsent,
} from "@/features/profile/haruConsentStorage";
import {
  formatSttEngine,
  transcribeStory,
  type TranscribeResult,
} from "@/features/speech/stt";
import { readJson, removeKey, writeJson } from "@/utils/safeStorage";

export const STT_JOB_OUTBOX_STORAGE_KEY = "haruBackgroundSttJobs";
export const STT_JOB_OUTBOX_UPDATED_EVENT = "haru:background-stt-jobs-updated";
export const STT_JOB_QUEUE_EPOCH_STORAGE_KEY = "haruBackgroundSttQueueEpoch";
export const STT_JOB_TARGET_EPOCH_STORAGE_KEY =
  "haruBackgroundSttTargetEpochs";
export const STT_JOB_TARGET_CLEAR_FENCE_STORAGE_PREFIX =
  "haruBackgroundSttTargetClearFence:";
export const STT_JOB_ENQUEUE_INTENT_STORAGE_PREFIX =
  "haruBackgroundSttEnqueueIntent:";
export const STT_JOB_GLOBAL_CLEAR_FENCE_STORAGE_KEY =
  "haruBackgroundSttGlobalClearFence";

const RETRY_INTERVAL_MS = 15_000;
const MAX_RETRY_DELAY_MS = 60_000;
const AUDIO_OBJECT_PREFIX = "haru-stt-job/";
const TARGET_CLEAR_FENCE_LEASE_MS = 60_000;
const ENQUEUE_INTENT_LEASE_MS = 60_000;
const REMOTE_INTENT_DRAIN_TIMEOUT_MS = 2_000;
const REMOTE_INTENT_POLL_MS = 20;
let volatileQueueEpoch = 0;

export type SttJobTarget =
  | { kind: "memory-story"; memoryCardId: string }
  | { kind: "verbal-fluency"; routineResultId: string }
  | { kind: "speech-repeat"; routineResultId: string };
export type SttJobTargetKind = SttJobTarget["kind"];

const STT_JOB_TARGET_KINDS = new Set<SttJobTargetKind>([
  "memory-story",
  "verbal-fluency",
  "speech-repeat",
]);
const volatileTargetEpochs: Record<SttJobTargetKind, number> = {
  "memory-story": 0,
  "verbal-fluency": 0,
  "speech-repeat": 0,
};

interface PendingTargetWrite {
  objectKey: string;
  settled: Promise<void>;
}

interface TargetClearFence {
  version: 1;
  token: string;
  kind: SttJobTargetKind;
  state: "active" | "blocked";
  startedAt: number;
  expiresAt: number;
}

interface GlobalClearFence {
  version: 1;
  token: string;
  state: "active" | "blocked";
  startedAt: number;
  expiresAt: number;
}

interface SttEnqueueIntent {
  version: 1;
  token: string;
  kind: SttJobTargetKind;
  objectKey: string;
  state: "writing" | "stored";
  startedAt: number;
  updatedAt: number;
  expiresAt: number;
}

interface ObservedEnqueueIntent {
  key: string;
  raw: string;
  objectKey: string;
  marker: SttEnqueueIntent | null;
  stale: boolean;
}

const pendingTargetWrites: Record<
  SttJobTargetKind,
  Set<PendingTargetWrite>
> = {
  "memory-story": new Set(),
  "verbal-fluency": new Set(),
  "speech-repeat": new Set(),
};
const activeTargetClearCounts: Record<SttJobTargetKind, number> = {
  "memory-story": 0,
  "verbal-fluency": 0,
  "speech-repeat": 0,
};
let scopedClearTail: Promise<void> = Promise.resolve();

function registerPendingTargetWrite(
  kind: SttJobTargetKind,
  objectKey: string,
): () => void {
  let resolveSettled: () => void = () => undefined;
  const pending: PendingTargetWrite = {
    objectKey,
    settled: new Promise<void>((resolve) => {
      resolveSettled = resolve;
    }),
  };
  pendingTargetWrites[kind].add(pending);
  return () => {
    pendingTargetWrites[kind].delete(pending);
    resolveSettled();
  };
}

function withScopedClearLock<T>(work: () => Promise<T>): Promise<T> {
  const previous = scopedClearTail;
  let release: () => void = () => undefined;
  scopedClearTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  return previous.then(work).finally(release);
}

export interface SttJobEntry {
  id: string;
  objectKey: string;
  target: SttJobTarget;
  phase: "transcribe" | "cleanup";
  attempts: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: number;
}

type AudioWriter = (
  objectKey: string,
  blob: Blob,
  storedAt: string,
) => Promise<HaruAdminAudioRetentionStatus>;
type AudioReader = (objectKey: string) => Promise<Blob | null>;
type AudioDeleter = (objectKey: string) => Promise<void>;
type Transcriber = typeof transcribeStory;

interface QueueClockOptions {
  now?: () => number;
}

export interface EnqueueSttJobOptions extends QueueClockOptions {
  createId?: () => string;
  storeAudioImpl?: AudioWriter;
  deleteAudioImpl?: AudioDeleter;
}

export interface FlushSttJobQueueOptions extends QueueClockOptions {
  force?: boolean;
  readAudioImpl?: AudioReader;
  deleteAudioImpl?: AudioDeleter;
  transcribeImpl?: Transcriber;
  isOnline?: () => boolean;
}

interface ParsedOutbox {
  entries: SttJobEntry[];
  invalidObjectKeys: string[];
  dirty: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeTarget(value: unknown): SttJobTarget | null {
  if (!isRecord(value) || !isNonEmptyString(value.kind)) return null;
  if (value.kind === "memory-story") {
    return isNonEmptyString(value.memoryCardId)
      ? { kind: value.kind, memoryCardId: value.memoryCardId.trim() }
      : null;
  }
  if (value.kind === "verbal-fluency" || value.kind === "speech-repeat") {
    return isNonEmptyString(value.routineResultId)
      ? { kind: value.kind, routineResultId: value.routineResultId.trim() }
      : null;
  }
  return null;
}

function rawTargetKind(value: unknown): SttJobTargetKind | null {
  if (!isRecord(value) || !isNonEmptyString(value.kind)) return null;
  const kind = value.kind as SttJobTargetKind;
  return STT_JOB_TARGET_KINDS.has(kind) ? kind : null;
}

function getLocalStorage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : null;
  } catch {
    return null;
  }
}

function writeStorageJsonVerified(key: string, value: unknown): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    const serialized = JSON.stringify(value);
    storage.setItem(key, serialized);
    return storage.getItem(key) === serialized;
  } catch {
    return false;
  }
}

function parseTargetClearFence(
  value: unknown,
  kind: SttJobTargetKind,
): TargetClearFence | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isNonEmptyString(value.token) ||
    value.kind !== kind ||
    (value.state !== "active" && value.state !== "blocked") ||
    typeof value.startedAt !== "number" ||
    !Number.isFinite(value.startedAt) ||
    typeof value.expiresAt !== "number" ||
    !Number.isFinite(value.expiresAt)
  ) {
    return null;
  }
  return {
    version: 1,
    token: value.token,
    kind,
    state: value.state,
    startedAt: value.startedAt,
    expiresAt: value.expiresAt,
  };
}

function targetClearFenceKey(kind: SttJobTargetKind): string {
  return `${STT_JOB_TARGET_CLEAR_FENCE_STORAGE_PREFIX}${kind}`;
}

function readTargetClearFence(kind: SttJobTargetKind): {
  raw: string | null;
  fence: TargetClearFence | null;
} | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(targetClearFenceKey(kind));
    if (raw === null) return { raw, fence: null };
    try {
      return { raw, fence: parseTargetClearFence(JSON.parse(raw), kind) };
    } catch {
      return { raw, fence: null };
    }
  } catch {
    return null;
  }
}

function hasDurableTargetClearFence(kind: SttJobTargetKind): boolean {
  const observed = readTargetClearFence(kind);
  // Storage unavailability and malformed markers both fail closed.
  return observed === null || observed.raw !== null;
}

function parseGlobalClearFence(value: unknown): GlobalClearFence | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isNonEmptyString(value.token) ||
    (value.state !== "active" && value.state !== "blocked") ||
    typeof value.startedAt !== "number" ||
    !Number.isFinite(value.startedAt) ||
    typeof value.expiresAt !== "number" ||
    !Number.isFinite(value.expiresAt)
  ) {
    return null;
  }
  return {
    version: 1,
    token: value.token,
    state: value.state,
    startedAt: value.startedAt,
    expiresAt: value.expiresAt,
  };
}

function readGlobalClearFence(): {
  raw: string | null;
  fence: GlobalClearFence | null;
} | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STT_JOB_GLOBAL_CLEAR_FENCE_STORAGE_KEY);
    if (raw === null) return { raw, fence: null };
    try {
      return { raw, fence: parseGlobalClearFence(JSON.parse(raw)) };
    } catch {
      return { raw, fence: null };
    }
  } catch {
    return null;
  }
}

function hasDurableGlobalClearFence(): boolean {
  const observed = readGlobalClearFence();
  return observed === null || observed.raw !== null;
}

function ownsGlobalClearFence(fence: GlobalClearFence): boolean {
  const persisted = readGlobalClearFence()?.fence;
  return persisted?.token === fence.token && persisted.state === "active";
}

function acquireGlobalClearFence(now: number): GlobalClearFence | null {
  const observed = readGlobalClearFence();
  if (!observed) return null;
  if (
    observed.fence?.state === "active" &&
    observed.fence.expiresAt > now
  ) {
    return null;
  }
  const fence: GlobalClearFence = {
    version: 1,
    token: defaultCreateId(),
    state: "active",
    startedAt: now,
    expiresAt: now + TARGET_CLEAR_FENCE_LEASE_MS,
  };
  if (!writeStorageJsonVerified(STT_JOB_GLOBAL_CLEAR_FENCE_STORAGE_KEY, fence)) {
    return null;
  }
  return ownsGlobalClearFence(fence) ? fence : null;
}

function blockGlobalClearFence(fence: GlobalClearFence): boolean {
  if (!ownsGlobalClearFence(fence)) return false;
  return writeStorageJsonVerified(STT_JOB_GLOBAL_CLEAR_FENCE_STORAGE_KEY, {
    ...fence,
    state: "blocked",
    expiresAt: Date.now() + TARGET_CLEAR_FENCE_LEASE_MS,
  } satisfies GlobalClearFence);
}

function releaseGlobalClearFence(fence: GlobalClearFence): boolean {
  const storage = getLocalStorage();
  if (!storage || !ownsGlobalClearFence(fence)) return false;
  try {
    storage.removeItem(STT_JOB_GLOBAL_CLEAR_FENCE_STORAGE_KEY);
    return storage.getItem(STT_JOB_GLOBAL_CLEAR_FENCE_STORAGE_KEY) === null;
  } catch {
    return false;
  }
}

function sttEnqueueIsBlocked(kind: SttJobTargetKind): boolean {
  return (
    activeTargetClearCounts[kind] > 0 ||
    hasDurableTargetClearFence(kind) ||
    hasDurableGlobalClearFence() ||
    hasHaruAdminDeletionFence()
  );
}

function acquireTargetClearFence(
  kind: SttJobTargetKind,
  token: string,
  now: number,
): TargetClearFence | null {
  const observed = readTargetClearFence(kind);
  if (!observed) return null;
  if (
    observed.fence?.state === "active" &&
    observed.fence.expiresAt > now
  ) {
    return null;
  }
  const fence: TargetClearFence = {
    version: 1,
    token,
    kind,
    state: "active",
    startedAt: now,
    expiresAt: now + TARGET_CLEAR_FENCE_LEASE_MS,
  };
  if (!writeStorageJsonVerified(targetClearFenceKey(kind), fence)) return null;
  const verified = readTargetClearFence(kind)?.fence;
  return verified?.token === token && verified.state === "active" ? fence : null;
}

function ownsTargetClearFence(
  kind: SttJobTargetKind,
  token: string,
): boolean {
  const fence = readTargetClearFence(kind)?.fence;
  return fence?.token === token && fence.state === "active";
}

function renewTargetClearFence(
  fence: TargetClearFence,
  now: number,
): boolean {
  if (!ownsTargetClearFence(fence.kind, fence.token)) return false;
  return writeStorageJsonVerified(targetClearFenceKey(fence.kind), {
    ...fence,
    expiresAt: now + TARGET_CLEAR_FENCE_LEASE_MS,
  } satisfies TargetClearFence);
}

function blockTargetClearFence(
  fence: TargetClearFence,
  now: number,
): boolean {
  if (!ownsTargetClearFence(fence.kind, fence.token)) return false;
  return writeStorageJsonVerified(targetClearFenceKey(fence.kind), {
    ...fence,
    state: "blocked",
    expiresAt: now + TARGET_CLEAR_FENCE_LEASE_MS,
  } satisfies TargetClearFence);
}

function releaseTargetClearFence(fence: TargetClearFence): boolean {
  const storage = getLocalStorage();
  if (!storage || !ownsTargetClearFence(fence.kind, fence.token)) return false;
  try {
    storage.removeItem(targetClearFenceKey(fence.kind));
    return storage.getItem(targetClearFenceKey(fence.kind)) === null;
  } catch {
    return false;
  }
}

function enqueueIntentKey(kind: SttJobTargetKind, id: string): string {
  return `${STT_JOB_ENQUEUE_INTENT_STORAGE_PREFIX}${kind}:${encodeURIComponent(id)}`;
}

function parseEnqueueIntent(
  value: unknown,
  kind: SttJobTargetKind,
  objectKey: string,
): SttEnqueueIntent | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isNonEmptyString(value.token) ||
    value.kind !== kind ||
    value.objectKey !== objectKey ||
    (value.state !== "writing" && value.state !== "stored") ||
    typeof value.startedAt !== "number" ||
    !Number.isFinite(value.startedAt) ||
    typeof value.updatedAt !== "number" ||
    !Number.isFinite(value.updatedAt) ||
    typeof value.expiresAt !== "number" ||
    !Number.isFinite(value.expiresAt)
  ) {
    return null;
  }
  return {
    version: 1,
    token: value.token,
    kind,
    objectKey,
    state: value.state,
    startedAt: value.startedAt,
    updatedAt: value.updatedAt,
    expiresAt: value.expiresAt,
  };
}

function writeEnqueueIntent(markerKey: string, marker: SttEnqueueIntent): boolean {
  return writeStorageJsonVerified(markerKey, marker);
}

function readOwnedEnqueueIntent(
  markerKey: string,
  marker: SttEnqueueIntent,
): SttEnqueueIntent | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(markerKey);
    if (raw === null) return null;
    const parsed = parseEnqueueIntent(
      JSON.parse(raw),
      marker.kind,
      marker.objectKey,
    );
    return parsed?.token === marker.token ? parsed : null;
  } catch {
    return null;
  }
}

function updateOwnedEnqueueIntent(
  markerKey: string,
  marker: SttEnqueueIntent,
  update: Pick<SttEnqueueIntent, "state" | "updatedAt" | "expiresAt">,
): SttEnqueueIntent | null {
  if (!readOwnedEnqueueIntent(markerKey, marker)) return null;
  const updated = { ...marker, ...update };
  return writeEnqueueIntent(markerKey, updated) ? updated : null;
}

function removeObservedIntent(
  observed: Pick<ObservedEnqueueIntent, "key" | "raw">,
): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    const current = storage.getItem(observed.key);
    if (current === null) return true;
    if (current !== observed.raw) return false;
    storage.removeItem(observed.key);
    return storage.getItem(observed.key) === null;
  } catch {
    return false;
  }
}

function removeOwnedEnqueueIntent(
  markerKey: string,
  marker: SttEnqueueIntent,
): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    const raw = storage.getItem(markerKey);
    if (raw === null) return true;
    const owned = readOwnedEnqueueIntent(markerKey, marker);
    if (!owned) return false;
    return removeObservedIntent({ key: markerKey, raw });
  } catch {
    return false;
  }
}

function intentKeyDetails(
  key: string,
  kind: SttJobTargetKind,
): { id: string; objectKey: string } | null {
  const prefix = `${STT_JOB_ENQUEUE_INTENT_STORAGE_PREFIX}${kind}:`;
  if (!key.startsWith(prefix)) return null;
  try {
    const id = decodeURIComponent(key.slice(prefix.length));
    return id ? { id, objectKey: `${AUDIO_OBJECT_PREFIX}${id}` } : null;
  } catch {
    return null;
  }
}

function listEnqueueIntents(
  kind: SttJobTargetKind,
  now: number,
): ObservedEnqueueIntent[] | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    const keys = Array.from({ length: storage.length }, (_, index) =>
      storage.key(index),
    ).filter((key): key is string => key !== null);
    const observed: ObservedEnqueueIntent[] = [];
    keys.forEach((key) => {
      const details = intentKeyDetails(key, kind);
      if (!details) return;
      const raw = storage.getItem(key);
      if (raw === null) return;
      let marker: SttEnqueueIntent | null = null;
      try {
        marker = parseEnqueueIntent(JSON.parse(raw), kind, details.objectKey);
      } catch {
        // Malformed markers still identify an object key through their key.
      }
      observed.push({
        key,
        raw,
        objectKey: details.objectKey,
        marker,
        stale: !marker || marker.expiresAt <= now,
      });
    });
    return observed;
  } catch {
    return null;
  }
}

async function waitForRemoteWritingIntents(
  kind: SttJobTargetKind,
  fenceToken: string,
): Promise<boolean> {
  const deadline = Date.now() + REMOTE_INTENT_DRAIN_TIMEOUT_MS;
  while (ownsTargetClearFence(kind, fenceToken)) {
    const intents = listEnqueueIntents(kind, Date.now());
    if (!intents) return false;
    if (
      !intents.some(
        (intent) => intent.marker?.state === "writing" && !intent.stale,
      )
    ) {
      return true;
    }
    if (Date.now() >= deadline) return false;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, REMOTE_INTENT_POLL_MS);
    });
  }
  return false;
}

async function sweepEnqueueIntents(
  kind: SttJobTargetKind,
  deleteAudio: AudioDeleter,
): Promise<boolean> {
  const intents = listEnqueueIntents(kind, Date.now());
  if (!intents) return false;
  const results = await Promise.all(
    intents.map(async (intent) => {
      const liveWriting =
        intent.marker?.state === "writing" && !intent.stale;
      try {
        await deleteAudio(intent.objectKey);
      } catch {
        return false;
      }
      if (liveWriting) return false;
      return removeObservedIntent(intent);
    }),
  );
  return results.every(Boolean);
}

function normalizeEntry(value: unknown): SttJobEntry | null {
  if (!isRecord(value)) return null;
  const target = normalizeTarget(value.target);
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.objectKey) ||
    !value.objectKey.startsWith(AUDIO_OBJECT_PREFIX) ||
    !target ||
    (value.phase !== "transcribe" && value.phase !== "cleanup") ||
    typeof value.attempts !== "number" ||
    !Number.isInteger(value.attempts) ||
    value.attempts < 0 ||
    !isNonEmptyString(value.createdAt) ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !isNonEmptyString(value.updatedAt) ||
    !Number.isFinite(Date.parse(value.updatedAt)) ||
    typeof value.nextAttemptAt !== "number" ||
    !Number.isFinite(value.nextAttemptAt)
  ) {
    return null;
  }
  return {
    id: value.id.trim(),
    objectKey: value.objectKey.trim(),
    target,
    phase: value.phase,
    attempts: value.attempts,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    nextAttemptAt: value.nextAttemptAt,
  };
}

function readOutbox(): ParsedOutbox {
  const raw = readJson<unknown>(STT_JOB_OUTBOX_STORAGE_KEY, []);
  if (!Array.isArray(raw)) {
    return { entries: [], invalidObjectKeys: [], dirty: true };
  }

  const entries: SttJobEntry[] = [];
  const invalidObjectKeys: string[] = [];
  const ids = new Set<string>();
  raw.forEach((candidate) => {
    const entry = normalizeEntry(candidate);
    if (entry && !ids.has(entry.id)) {
      ids.add(entry.id);
      entries.push(entry);
      return;
    }
    if (
      isRecord(candidate) &&
      isNonEmptyString(candidate.objectKey) &&
      candidate.objectKey.startsWith(AUDIO_OBJECT_PREFIX)
    ) {
      invalidObjectKeys.push(candidate.objectKey);
    }
  });
  const validObjectKeys = new Set(entries.map((entry) => entry.objectKey));
  return {
    entries,
    invalidObjectKeys: [...new Set(invalidObjectKeys)].filter(
      (objectKey) => !validObjectKeys.has(objectKey),
    ),
    dirty:
      entries.length !== raw.length ||
      JSON.stringify(entries) !== JSON.stringify(raw),
  };
}

function saveOutbox(entries: readonly SttJobEntry[]): boolean {
  if (entries.length === 0) {
    return removeKey(STT_JOB_OUTBOX_STORAGE_KEY);
  }
  return writeJson(STT_JOB_OUTBOX_STORAGE_KEY, entries);
}

function persistedQueueEpoch(): number {
  const value = readJson<unknown>(STT_JOB_QUEUE_EPOCH_STORAGE_KEY, 0);
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function persistedTargetEpochs(): Record<SttJobTargetKind, number> {
  const value = readJson<unknown>(STT_JOB_TARGET_EPOCH_STORAGE_KEY, {});
  const epochs: Record<SttJobTargetKind, number> = {
    "memory-story": 0,
    "verbal-fluency": 0,
    "speech-repeat": 0,
  };
  if (!isRecord(value)) return epochs;
  STT_JOB_TARGET_KINDS.forEach((kind) => {
    const candidate = value[kind];
    if (
      typeof candidate === "number" &&
      Number.isSafeInteger(candidate) &&
      candidate >= 0
    ) {
      epochs[kind] = candidate;
    }
  });
  return epochs;
}

function currentQueueEpoch(kind: SttJobTargetKind): string {
  return `${persistedQueueEpoch()}:${volatileQueueEpoch}:${persistedTargetEpochs()[kind]}:${volatileTargetEpochs[kind]}`;
}

function advanceQueueEpoch(): boolean {
  const next = persistedQueueEpoch() + 1;
  volatileQueueEpoch += 1;
  return (
    writeJson(STT_JOB_QUEUE_EPOCH_STORAGE_KEY, next) &&
    persistedQueueEpoch() === next
  );
}

function advanceTargetEpoch(kind: SttJobTargetKind): boolean {
  const current = persistedTargetEpochs();
  const next = current[kind] + 1;
  volatileTargetEpochs[kind] += 1;
  const updated = { ...current, [kind]: next };
  return (
    writeJson(STT_JOB_TARGET_EPOCH_STORAGE_KEY, updated) &&
    persistedTargetEpochs()[kind] === next
  );
}

function hasDeferredSttConsent(): boolean {
  const consent = getHaruConsent();
  return (
    consent.voiceRecording &&
    consent.sttProcessing &&
    consent.transcriptStorage &&
    consent.audioStorage &&
    consent.longitudinalUsageStorage
  );
}

function dispatchQueueUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STT_JOB_OUTBOX_UPDATED_EVENT));
}

function defaultCreateId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Older or restricted browsers fall back to a local opaque identifier.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function defaultIsOnline(): boolean {
  try {
    return typeof navigator === "undefined" || navigator.onLine !== false;
  } catch {
    return true;
  }
}

function retryDelayMs(attempts: number): number {
  return Math.min(
    MAX_RETRY_DELAY_MS,
    1_000 * 2 ** Math.min(Math.max(0, attempts - 1), 6),
  );
}

function getRoutineTarget(
  id: string,
  expectedType: RoutineResult["type"],
): RoutineResult | null {
  return (
    getCognitiveRoutineResults().find(
      (result) => result.id === id && result.type === expectedType,
    ) ?? null
  );
}

function targetExists(target: SttJobTarget): boolean {
  if (target.kind === "memory-story") {
    return getMemoryCardById(target.memoryCardId)?.source === "daily_lesson";
  }
  if (target.kind === "verbal-fluency") {
    return Boolean(
      getRoutineTarget(target.routineResultId, "verbal_fluency_practice"),
    );
  }
  const routine = getRoutineTarget(
    target.routineResultId,
    "speech_repeat_practice",
  );
  return isNonEmptyString(routine?.metadata?.phrase);
}

function provenance(result: TranscribeResult): Record<string, unknown> {
  return {
    sttStatus: result.noSpeech ? "failed" : "completed",
    sttNoSpeech: result.noSpeech,
    sttEngine: formatSttEngine(result),
    sttModel: result.model,
    sttModelRevision: result.modelRevision,
    sttAlignerModel: result.alignerModel,
    sttAlignerRevision: result.alignerRevision,
    sttPreprocessingVersion: result.preprocessingVersion,
    sttLanguage: result.language,
    sttConfidence: result.confidence,
    sttDurationSec: result.durationSec,
    sttSegments: result.noSpeech ? [] : result.segments,
  };
}

function verbalEntries(transcript: string): string[] {
  return transcript
    .split(/[\s,，、]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function pronunciationSimilarity(target: string, transcript: string): number {
  const tokenize = (value: string) =>
    value
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter(Boolean);
  const targetTokens = new Set(tokenize(target));
  const transcriptTokens = new Set(tokenize(transcript));
  if (targetTokens.size === 0) return 0;
  let overlap = 0;
  targetTokens.forEach((token) => {
    if (transcriptTokens.has(token)) overlap += 1;
  });
  return overlap / targetTokens.size;
}

function patchTarget(target: SttJobTarget, result: TranscribeResult): boolean {
  const transcript = result.noSpeech ? "" : result.text.trim();
  const common = {
    transcript,
    inputMode: transcript ? "speech" : "skipped",
    recognitionError: result.noSpeech ? "no-speech" : null,
    ...provenance(result),
  };

  if (target.kind === "memory-story") {
    return patchMemoryCueCardById(target.memoryCardId, {
      originalTranscript: transcript,
      textSummary: transcript ? summarizeMemoryStory(transcript) : "",
      storyCues: transcript ? extractMemoryStoryCues(transcript) : {},
      inputMode: transcript ? "speech" : "skipped",
      recognitionError: result.noSpeech ? "no-speech" : null,
      sttStatus: result.noSpeech ? "failed" : "completed",
      sttNoSpeech: result.noSpeech,
      sttEngine: formatSttEngine(result),
      sttModel: result.model,
      sttModelRevision: result.modelRevision,
      sttAlignerModel: result.alignerModel,
      sttAlignerRevision: result.alignerRevision,
      sttPreprocessingVersion: result.preprocessingVersion,
      sttLanguage: result.language,
      sttConfidence: result.confidence,
      sttSegments: result.noSpeech ? [] : result.segments,
    });
  }

  if (target.kind === "verbal-fluency") {
    const entries = verbalEntries(transcript);
    const uniqueCount = new Set(entries).size;
    return patchCognitiveRoutineResultById(target.routineResultId, {
      ...common,
      entries,
      uniqueCount,
      repetitionCount: Math.max(0, entries.length - uniqueCount),
    });
  }

  const routine = getRoutineTarget(
    target.routineResultId,
    "speech_repeat_practice",
  );
  const phrase = routine?.metadata?.phrase;
  if (!isNonEmptyString(phrase)) return false;
  return patchCognitiveRoutineResultById(target.routineResultId, {
    ...common,
    pronunciationSimilarity: transcript
      ? pronunciationSimilarity(phrase, transcript)
      : null,
  });
}

function updateCurrentEntry(
  entry: SttJobEntry,
  update: Partial<SttJobEntry>,
): boolean {
  const latest = readOutbox().entries;
  const index = latest.findIndex((candidate) => candidate.id === entry.id);
  if (index < 0) return false;
  latest[index] = { ...latest[index], ...update };
  return saveOutbox(latest);
}

function removeCurrentEntry(entry: SttJobEntry): void {
  saveOutbox(readOutbox().entries.filter((candidate) => candidate.id !== entry.id));
}

function deferCurrentEntry(entry: SttJobEntry, now: number): void {
  const current = readOutbox().entries.find((candidate) => candidate.id === entry.id);
  if (!current) return;
  const attempts = current.attempts + 1;
  updateCurrentEntry(current, {
    attempts,
    updatedAt: new Date(now).toISOString(),
    nextAttemptAt: now + retryDelayMs(attempts),
  });
}

async function finishWithAudioCleanup(
  entry: SttJobEntry,
  deleteAudio: AudioDeleter,
  now: number,
): Promise<void> {
  const current = readOutbox().entries.find((candidate) => candidate.id === entry.id);
  if (!current) {
    try {
      await deleteAudio(entry.objectKey);
    } catch {
      // Queue was cleared while work was active; no metadata remains to retry.
    }
    return;
  }

  const cleanupEntry = { ...current, phase: "cleanup" as const };
  if (
    current.phase !== "cleanup" &&
    !updateCurrentEntry(current, {
      phase: "cleanup",
      updatedAt: new Date(now).toISOString(),
      nextAttemptAt: 0,
    })
  ) {
    return;
  }

  try {
    await deleteAudio(cleanupEntry.objectKey);
    removeCurrentEntry(cleanupEntry);
  } catch {
    deferCurrentEntry(cleanupEntry, now);
  }
}

export function getSttJobQueue(): readonly SttJobEntry[] {
  return readOutbox().entries;
}

async function cleanupEnqueueIntentAudio(
  markerKey: string,
  marker: SttEnqueueIntent,
  deleteAudio: AudioDeleter,
): Promise<boolean> {
  try {
    await deleteAudio(marker.objectKey);
  } catch {
    const cleanupMarker: SttEnqueueIntent = {
      ...marker,
      state: "stored",
      updatedAt: Date.now(),
      expiresAt: Date.now() + ENQUEUE_INTENT_LEASE_MS,
    };
    if (readOwnedEnqueueIntent(markerKey, marker)) {
      updateOwnedEnqueueIntent(markerKey, marker, cleanupMarker);
    } else {
      try {
        const storage = getLocalStorage();
        if (storage?.getItem(markerKey) === null) {
          writeEnqueueIntent(markerKey, cleanupMarker);
        }
      } catch {
        // Storage unavailability leaves cleanup unverified and returns false.
      }
    }
    return false;
  }
  return removeOwnedEnqueueIntent(markerKey, marker);
}

export async function enqueueSttJob(
  blob: Blob,
  target: SttJobTarget,
  options: EnqueueSttJobOptions = {},
): Promise<string | null> {
  const normalizedTarget = normalizeTarget(target);
  if (
    !(blob instanceof Blob) ||
    blob.size <= 0 ||
    !normalizedTarget ||
    !hasDeferredSttConsent() ||
    sttEnqueueIsBlocked(normalizedTarget.kind)
  ) {
    return null;
  }
  const now = options.now ?? Date.now;
  const createId = options.createId ?? defaultCreateId;
  const storeAudio = options.storeAudioImpl ?? storeHaruAdminAudio;
  const deleteAudio = options.deleteAudioImpl ?? deleteHaruAdminAudio;
  const id = createId().trim();
  if (!id) return null;
  const objectKey = `${AUDIO_OBJECT_PREFIX}${id}`;
  const timestamp = new Date(now()).toISOString();
  const enqueueEpoch = currentQueueEpoch(normalizedTarget.kind);
  const intentStartedAt = Date.now();
  let intent: SttEnqueueIntent = {
    version: 1,
    token: defaultCreateId(),
    kind: normalizedTarget.kind,
    objectKey,
    state: "writing",
    startedAt: intentStartedAt,
    updatedAt: intentStartedAt,
    expiresAt: intentStartedAt + ENQUEUE_INTENT_LEASE_MS,
  };
  const markerKey = enqueueIntentKey(normalizedTarget.kind, id);
  if (!writeEnqueueIntent(markerKey, intent)) return null;
  if (
    sttEnqueueIsBlocked(normalizedTarget.kind) ||
    enqueueEpoch !== currentQueueEpoch(normalizedTarget.kind) ||
    !hasDeferredSttConsent()
  ) {
    removeOwnedEnqueueIntent(markerKey, intent);
    return null;
  }
  const finishPendingWrite = registerPendingTargetWrite(
    normalizedTarget.kind,
    objectKey,
  );

  try {
    let retentionStatus: HaruAdminAudioRetentionStatus;
    try {
      // Audio must be durable before metadata can reference it.
      retentionStatus = await storeAudio(
        objectKey,
        blob,
        timestamp,
      );
    } catch {
      await cleanupEnqueueIntentAudio(markerKey, intent, deleteAudio);
      return null;
    }
    if (retentionStatus !== "stored") {
      await cleanupEnqueueIntentAudio(markerKey, intent, deleteAudio);
      return null;
    }
    const storedIntent = updateOwnedEnqueueIntent(markerKey, intent, {
      state: "stored",
      updatedAt: Date.now(),
      expiresAt: Date.now() + ENQUEUE_INTENT_LEASE_MS,
    });
    if (!storedIntent) {
      await cleanupEnqueueIntentAudio(markerKey, intent, deleteAudio);
      return null;
    }
    intent = storedIntent;
    if (
      enqueueEpoch !== currentQueueEpoch(normalizedTarget.kind) ||
      !hasDeferredSttConsent() ||
      sttEnqueueIsBlocked(normalizedTarget.kind)
    ) {
      await cleanupEnqueueIntentAudio(markerKey, intent, deleteAudio);
      return null;
    }

    const parsed = readOutbox();
    for (const invalidObjectKey of parsed.invalidObjectKeys) {
      try {
        await deleteAudio(invalidObjectKey);
      } catch {
        // Invalid metadata cannot safely retain a cleanup retry.
      }
    }
    const current = parsed.entries.filter((entry) => entry.id !== id);
    const entry: SttJobEntry = {
      id,
      objectKey,
      target: normalizedTarget,
      phase: "transcribe",
      attempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      nextAttemptAt: 0,
    };
    if (!saveOutbox([...current, entry])) {
      await cleanupEnqueueIntentAudio(markerKey, intent, deleteAudio);
      return null;
    }
    if (
      enqueueEpoch !== currentQueueEpoch(normalizedTarget.kind) ||
      sttEnqueueIsBlocked(normalizedTarget.kind) ||
      !hasDeferredSttConsent()
    ) {
      removeCurrentEntry(entry);
      await cleanupEnqueueIntentAudio(markerKey, intent, deleteAudio);
      return null;
    }
    removeOwnedEnqueueIntent(markerKey, intent);
    dispatchQueueUpdated();
    return id;
  } finally {
    finishPendingWrite();
  }
}

async function flushInternal(options: FlushSttJobQueueOptions): Promise<void> {
  const isOnline = options.isOnline ?? defaultIsOnline;
  if (!isOnline()) return;
  const now = options.now ?? Date.now;
  const readAudio = options.readAudioImpl ?? readHaruAdminAudio;
  const deleteAudio = options.deleteAudioImpl ?? deleteHaruAdminAudio;
  const transcribe = options.transcribeImpl ?? transcribeStory;
  if (!hasDeferredSttConsent()) {
    await clearSttJobQueue({ deleteAudioImpl: deleteAudio });
    return;
  }
  const parsed = readOutbox();

  if (parsed.dirty) saveOutbox(parsed.entries);
  for (const objectKey of parsed.invalidObjectKeys) {
    try {
      await deleteAudio(objectKey);
    } catch {
      // Malformed metadata cannot safely carry a durable cleanup retry.
    }
  }

  for (const snapshotEntry of parsed.entries) {
    if (!hasDeferredSttConsent()) {
      await clearSttJobQueue({ deleteAudioImpl: deleteAudio });
      return;
    }
    const entry = readOutbox().entries.find(
      (candidate) => candidate.id === snapshotEntry.id,
    );
    if (!entry || (!options.force && entry.nextAttemptAt > now())) continue;

    if (entry.phase === "cleanup") {
      await finishWithAudioCleanup(entry, deleteAudio, now());
      continue;
    }

    if (!targetExists(entry.target)) {
      await finishWithAudioCleanup(entry, deleteAudio, now());
      continue;
    }

    let blob: Blob | null;
    try {
      blob = await readAudio(entry.objectKey);
    } catch {
      deferCurrentEntry(entry, now());
      continue;
    }
    if (!blob || blob.size <= 0) {
      removeCurrentEntry(entry);
      continue;
    }
    if (!hasDeferredSttConsent()) {
      await clearSttJobQueue({ deleteAudioImpl: deleteAudio });
      return;
    }

    let result: TranscribeResult | null;
    const controller = new AbortController();
    activeTranscriptions.set(controller, entry.target.kind);
    try {
      result = await transcribe(blob, { signal: controller.signal });
    } catch {
      result = null;
    } finally {
      activeTranscriptions.delete(controller);
    }
    if (!hasDeferredSttConsent()) {
      await clearSttJobQueue({ deleteAudioImpl: deleteAudio });
      return;
    }
    if (!result || (!result.noSpeech && result.text.trim().length === 0)) {
      deferCurrentEntry(entry, now());
      continue;
    }

    // Deletion/clear wins over an already-running network request.
    const stillQueued = readOutbox().entries.some(
      (candidate) => candidate.id === entry.id && candidate.phase === "transcribe",
    );
    if (!stillQueued) {
      try {
        await deleteAudio(entry.objectKey);
      } catch {
        // No queue metadata remains after explicit deletion.
      }
      continue;
    }

    const patched = patchTarget(entry.target, result);
    if (!patched && targetExists(entry.target)) {
      // Target still exists, so persistence likely failed (quota/private mode).
      deferCurrentEntry(entry, now());
      continue;
    }
    await finishWithAudioCleanup(entry, deleteAudio, now());
  }
}

let activeFlush: Promise<void> | null = null;
let flushAgain = false;
let nextFlushOptions: FlushSttJobQueueOptions | null = null;
const activeTranscriptions = new Map<AbortController, SttJobTargetKind>();

function abortActiveTranscriptions(kind?: SttJobTargetKind): void {
  for (const [controller, targetKind] of activeTranscriptions) {
    if (kind && targetKind !== kind) continue;
    controller.abort();
    activeTranscriptions.delete(controller);
  }
}

export function flushSttJobQueue(
  options: FlushSttJobQueueOptions = {},
): Promise<void> {
  if (activeFlush) {
    flushAgain = true;
    nextFlushOptions = options;
    return activeFlush;
  }
  activeFlush = (async () => {
    let currentOptions = options;
    do {
      flushAgain = false;
      nextFlushOptions = null;
      await flushInternal(currentOptions);
      currentOptions = nextFlushOptions ?? currentOptions;
    } while (flushAgain);
  })().finally(() => {
    activeFlush = null;
    nextFlushOptions = null;
  });
  return activeFlush;
}

export async function clearSttJobQueue(
  options: Pick<FlushSttJobQueueOptions, "deleteAudioImpl"> = {},
): Promise<boolean> {
  const globalFence = acquireGlobalClearFence(Date.now());
  if (!globalFence) return false;
  const deleteAudio = options.deleteAudioImpl ?? deleteHaruAdminAudio;
  const failClosed = (): false => {
    blockGlobalClearFence(globalFence);
    return false;
  };
  try {
    abortActiveTranscriptions();
    const scopedResults: boolean[] = [];
    for (const kind of STT_JOB_TARGET_KINDS) {
      scopedResults.push(
        await clearSttJobsByTargetKind(kind, { deleteAudioImpl: deleteAudio }),
      );
    }
    if (!scopedResults.every(Boolean) || !ownsGlobalClearFence(globalFence)) {
      return failClosed();
    }

    // The global epoch also invalidates older clients that predate per-target
    // intent markers. Malformed/unknown metadata is swept after typed drains.
    const epochSaved = advanceQueueEpoch();
    const parsed = readOutbox();
    const metadataRemoved = removeKey(STT_JOB_OUTBOX_STORAGE_KEY);
    const objectKeys = new Set([
      ...parsed.entries.map((entry) => entry.objectKey),
      ...parsed.invalidObjectKeys,
    ]);
    const audioRemoved = await Promise.all(
      [...objectKeys].map(async (objectKey) => {
        try {
          await deleteAudio(objectKey);
          return true;
        } catch {
          return false;
        }
      }),
    );
    const intentsVerified = [...STT_JOB_TARGET_KINDS].every(
      (kind) => listEnqueueIntents(kind, Date.now())?.length === 0,
    );
    const metadataVerified = readRawOutbox()?.length === 0;
    const cleared =
      epochSaved &&
      metadataRemoved &&
      metadataVerified &&
      intentsVerified &&
      audioRemoved.every(Boolean) &&
      ownsGlobalClearFence(globalFence);
    if (!cleared) return failClosed();
    if (!releaseGlobalClearFence(globalFence)) return failClosed();
    return true;
  } catch {
    return failClosed();
  }
}

function readRawOutbox(): unknown[] | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(STT_JOB_OUTBOX_STORAGE_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveRawOutboxVerified(entries: readonly unknown[]): boolean {
  if (entries.length === 0) return removeKey(STT_JOB_OUTBOX_STORAGE_KEY);
  if (!writeJson(STT_JOB_OUTBOX_STORAGE_KEY, entries)) return false;
  const persisted = readRawOutbox();
  return persisted !== null && JSON.stringify(persisted) === JSON.stringify(entries);
}

/**
 * Delete queued work and retained audio for one response family only.
 * Other queue entry values remain intact. A per-target epoch prevents
 * an enqueue already awaiting IndexedDB from publishing after this deletion.
 */
export async function clearSttJobsByTargetKind(
  kind: SttJobTargetKind,
  options: Pick<FlushSttJobQueueOptions, "deleteAudioImpl"> = {},
): Promise<boolean> {
  if (!STT_JOB_TARGET_KINDS.has(kind)) return false;
  activeTargetClearCounts[kind] += 1;
  // Capture synchronously. A write may settle while this request waits for
  // another scoped deletion, but its object key must remain discoverable.
  const pendingWrites = [...pendingTargetWrites[kind]];
  try {
    return await withScopedClearLock(async () => {
      const deleteAudio = options.deleteAudioImpl ?? deleteHaruAdminAudio;
      const fence = acquireTargetClearFence(kind, defaultCreateId(), Date.now());
      if (!fence) return false;

      const failClosed = (): false => {
        blockTargetClearFence(fence, Date.now());
        return false;
      };

      try {
        abortActiveTranscriptions(kind);
        const epochSaved = advanceTargetEpoch(kind);

        // A scoped deletion cannot report success while an earlier IndexedDB
        // write may still materialize a new retained audio object.
        await Promise.all(pendingWrites.map((pending) => pending.settled));
        if (!renewTargetClearFence(fence, Date.now())) return failClosed();

        const remoteWritesDrained = await waitForRemoteWritingIntents(
          kind,
          fence.token,
        );
        if (!ownsTargetClearFence(kind, fence.token)) return false;
        const firstIntentSweep = await sweepEnqueueIntents(kind, deleteAudio);

        const rawEntries = readRawOutbox();
        if (rawEntries === null) return failClosed();

        const matchingObjectKeys = new Set(
          pendingWrites.map((pending) => pending.objectKey),
        );
        let matchingEntryCount = 0;
        const remainingEntries = rawEntries.filter((candidate) => {
          if (!isRecord(candidate) || rawTargetKind(candidate.target) !== kind) {
            return true;
          }
          matchingEntryCount += 1;
          if (
            isNonEmptyString(candidate.objectKey) &&
            candidate.objectKey.startsWith(AUDIO_OBJECT_PREFIX)
          ) {
            matchingObjectKeys.add(candidate.objectKey);
          }
          return false;
        });
        const metadataSaved =
          matchingEntryCount === 0 || saveRawOutboxVerified(remainingEntries);
        const audioRemoved = await Promise.all(
          [...matchingObjectKeys].map(async (objectKey) => {
            try {
              await deleteAudio(objectKey);
              return true;
            } catch {
              return false;
            }
          }),
        );

        // One last sweep catches an intent registered by another realm after
        // our fence write but before that realm observed the fence.
        const secondIntentSweep = await sweepEnqueueIntents(kind, deleteAudio);
        const finalIntents = listEnqueueIntents(kind, Date.now());
        const verifiedEntries = readRawOutbox();
        const metadataVerified =
          verifiedEntries !== null &&
          verifiedEntries.every(
            (candidate) =>
              !isRecord(candidate) ||
              rawTargetKind(candidate.target) !== kind,
          );
        const cleared =
          epochSaved &&
          remoteWritesDrained &&
          firstIntentSweep &&
          secondIntentSweep &&
          finalIntents?.length === 0 &&
          metadataSaved &&
          metadataVerified &&
          audioRemoved.every(Boolean) &&
          ownsTargetClearFence(kind, fence.token);
        if (!cleared) return failClosed();
        if (!releaseTargetClearFence(fence)) return failClosed();
        return true;
      } catch {
        return failClosed();
      }
    });
  } finally {
    activeTargetClearCounts[kind] -= 1;
  }
}

export function startSttJobQueue(
  overrides: Omit<FlushSttJobQueueOptions, "force"> = {},
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const flushNow = () => {
    void flushSttJobQueue({ ...overrides, force: true });
  };
  const flushDue = () => {
    void flushSttJobQueue(overrides);
  };
  window.addEventListener(STT_JOB_OUTBOX_UPDATED_EVENT, flushDue);
  window.addEventListener("online", flushNow);
  const timer = window.setInterval(flushDue, RETRY_INTERVAL_MS);
  const unsubscribeConsent = subscribeToHaruConsent((consent) => {
    if (
      !consent.voiceRecording ||
      !consent.sttProcessing ||
      !consent.transcriptStorage ||
      !consent.audioStorage ||
      !consent.longitudinalUsageStorage
    ) {
      void clearSttJobQueue({ deleteAudioImpl: overrides.deleteAudioImpl });
    }
  });
  flushDue();
  return () => {
    window.removeEventListener(STT_JOB_OUTBOX_UPDATED_EVENT, flushDue);
    window.removeEventListener("online", flushNow);
    window.clearInterval(timer);
    unsubscribeConsent();
  };
}
