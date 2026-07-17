import type { HaruAdminUsageRecord } from "@/features/lessons/haruAdminUsageRecordStorage";
import {
  getHaruConsent,
  subscribeToHaruConsent,
  type HaruConsentState,
} from "@/features/profile/haruConsentStorage";
import { readJson, removeKey, writeJson } from "@/utils/safeStorage";

export const HARU_RAG_OUTBOX_STORAGE_KEY = "haruRagSyncOutbox";
export const HARU_RAG_DELETION_OUTBOX_STORAGE_KEY = "haruRagDeletionOutbox";
export const HARU_RAG_SYNC_GENERATION_STORAGE_KEY = "haruRagSyncGenerations";
export const HARU_RAG_OUTBOX_UPDATED_EVENT = "haru:rag-outbox-updated";

const DEFAULT_RAG_API_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;
const MAX_RETRY_DELAY_MS = 60_000;

interface HaruRagOutboxEntry {
  scopeKey: string;
  contentHash: string;
  payload: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: number;
  blockedReason?: string;
}

interface HaruRagDeletionEntry {
  userId: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: number;
  blockedReason?: string;
}

export interface HaruRagSyncGeneration {
  userId: string;
  generation: number;
  generationConfirmed: boolean;
  deletionConfirmed: boolean;
  reenrollmentAuthorized: boolean;
  updatedAt: string;
}

interface HaruRagSyncOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
  force?: boolean;
  timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isOutboxEntry(value: unknown): value is HaruRagOutboxEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.scopeKey === "string" &&
    typeof value.contentHash === "string" &&
    typeof value.payload === "string" &&
    typeof value.attempts === "number" &&
    Number.isFinite(value.attempts) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.nextAttemptAt === "number" &&
    Number.isFinite(value.nextAttemptAt)
  );
}

function readOutbox(): HaruRagOutboxEntry[] {
  const stored = readJson<unknown>(HARU_RAG_OUTBOX_STORAGE_KEY, []);
  return Array.isArray(stored) ? stored.filter(isOutboxEntry) : [];
}

function saveOutbox(entries: HaruRagOutboxEntry[]): boolean {
  if (entries.length === 0) {
    return removeKey(HARU_RAG_OUTBOX_STORAGE_KEY);
  }
  return writeJson(HARU_RAG_OUTBOX_STORAGE_KEY, entries);
}

function isDeletionEntry(value: unknown): value is HaruRagDeletionEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.userId === "string" &&
    value.userId.trim().length > 0 &&
    typeof value.attempts === "number" &&
    Number.isFinite(value.attempts) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.nextAttemptAt === "number" &&
    Number.isFinite(value.nextAttemptAt)
  );
}

function readDeletionOutbox(): HaruRagDeletionEntry[] {
  const stored = readJson<unknown>(HARU_RAG_DELETION_OUTBOX_STORAGE_KEY, []);
  return Array.isArray(stored) ? stored.filter(isDeletionEntry) : [];
}

function saveDeletionOutbox(entries: HaruRagDeletionEntry[]): boolean {
  if (entries.length === 0) {
    return removeKey(HARU_RAG_DELETION_OUTBOX_STORAGE_KEY);
  }
  return writeJson(HARU_RAG_DELETION_OUTBOX_STORAGE_KEY, entries);
}

function isSyncGeneration(value: unknown): value is HaruRagSyncGeneration {
  if (!isRecord(value)) return false;
  return (
    typeof value.userId === "string" &&
    value.userId.trim().length > 0 &&
    typeof value.generation === "number" &&
    Number.isSafeInteger(value.generation) &&
    value.generation >= 0 &&
    typeof value.generationConfirmed === "boolean" &&
    typeof value.deletionConfirmed === "boolean" &&
    typeof value.reenrollmentAuthorized === "boolean" &&
    typeof value.updatedAt === "string" &&
    Number.isFinite(Date.parse(value.updatedAt))
  );
}

function readSyncGenerations(): HaruRagSyncGeneration[] {
  const stored = readJson<unknown>(HARU_RAG_SYNC_GENERATION_STORAGE_KEY, []);
  return Array.isArray(stored) ? stored.filter(isSyncGeneration) : [];
}

function saveSyncGenerations(entries: HaruRagSyncGeneration[]): boolean {
  if (entries.length === 0) {
    return removeKey(HARU_RAG_SYNC_GENERATION_STORAGE_KEY);
  }
  return writeJson(HARU_RAG_SYNC_GENERATION_STORAGE_KEY, entries);
}

function saveSyncGeneration(entry: HaruRagSyncGeneration): boolean {
  return saveSyncGenerations([
    ...readSyncGenerations().filter((candidate) => candidate.userId !== entry.userId),
    entry,
  ]);
}

function entryUserId(entry: HaruRagOutboxEntry): string | null {
  try {
    const payload = JSON.parse(entry.payload) as unknown;
    return isRecord(payload) && isRecord(payload.user) && typeof payload.user.user_id === "string"
      ? payload.user.user_id
      : null;
  } catch {
    return null;
  }
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item ?? null)).join(",")}]`;
  }
  if (isRecord(value)) {
    const pairs = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${pairs.join(",")}}`;
  }
  return "null";
}

function fnv1a(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function haruRagContentHash(value: unknown): string {
  const canonical = canonicalJson(value);
  const first = fnv1a(canonical, 0x811c9dc5).toString(16).padStart(8, "0");
  const second = fnv1a(canonical, 0x9e3779b1).toString(16).padStart(8, "0");
  return `fnv1a64-${first}${second}`;
}

function scopeFor(record: HaruAdminUsageRecord): string {
  return `${record.dataset.dataset_id}:${record.user.user_id}`;
}

function isVoiceQuestionRecord(
  questionRecord: HaruAdminUsageRecord["sessions"][number]["question_records"][number],
): boolean {
  const response = questionRecord.response;
  return (
    questionRecord.question.response_type === "voice" ||
    response?.input_mode === "voice" ||
    (response !== null && "stt" in response)
  );
}

function payloadForCurrentConsent(
  record: HaruAdminUsageRecord,
  runtimeConsent: HaruConsentState = getHaruConsent(),
): HaruAdminUsageRecord {
  const voiceRecording =
    record.user.consents.voice_recording && runtimeConsent.voiceRecording;
  const sttProcessing =
    record.user.consents.stt_processing && runtimeConsent.sttProcessing;
  const syncRecord: HaruAdminUsageRecord = {
    ...record,
    user: {
      ...record.user,
      consents: {
        ...record.user.consents,
        voice_recording: voiceRecording,
        stt_processing: sttProcessing,
        longitudinal_usage_storage:
          record.user.consents.longitudinal_usage_storage &&
          runtimeConsent.longitudinalUsageStorage,
        personalized_question_use:
          record.user.consents.personalized_question_use &&
          runtimeConsent.personalizedQuestionUse,
      },
    },
  };
  if (voiceRecording && sttProcessing) return syncRecord;
  return {
    ...syncRecord,
    sessions: syncRecord.sessions.map((session) => ({
      ...session,
      question_records: session.question_records.filter(
        (questionRecord) => !isVoiceQuestionRecord(questionRecord),
      ),
    })),
  };
}

function dispatchOutboxUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HARU_RAG_OUTBOX_UPDATED_EVENT));
}

export function getHaruRagOutbox(): readonly HaruRagOutboxEntry[] {
  return readOutbox();
}

export function getHaruRagDeletionOutbox(): readonly HaruRagDeletionEntry[] {
  return readDeletionOutbox();
}

export function getHaruRagSyncGeneration(userId: string): HaruRagSyncGeneration | null {
  const normalizedUserId = userId.trim();
  return (
    readSyncGenerations().find((entry) => entry.userId === normalizedUserId) ?? null
  );
}

export function authorizeHaruRagReenrollment(
  userId: string,
  now = new Date(),
): boolean {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return false;
  const existing = getHaruRagSyncGeneration(normalizedUserId);
  if (!existing && !readDeletionOutbox().some((entry) => entry.userId === normalizedUserId)) {
    return true;
  }
  return saveSyncGeneration({
    userId: normalizedUserId,
    generation: existing?.generation ?? 0,
    generationConfirmed: existing?.generationConfirmed ?? false,
    deletionConfirmed: existing?.deletionConfirmed ?? false,
    reenrollmentAuthorized: true,
    updatedAt: now.toISOString(),
  });
}

export function clearHaruRagOutbox(): boolean {
  return removeKey(HARU_RAG_OUTBOX_STORAGE_KEY);
}

export function enqueueHaruRagUserDeletion(userId: string, now = new Date()): boolean {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) return false;
  const timestamp = now.toISOString();
  const existing = readDeletionOutbox().find((entry) => entry.userId === normalizedUserId);
  const entries = readDeletionOutbox().filter((entry) => entry.userId !== normalizedUserId);
  const saved = saveDeletionOutbox([
    ...entries,
    {
      userId: normalizedUserId,
      attempts: existing?.attempts ?? 0,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      nextAttemptAt: existing?.nextAttemptAt ?? 0,
      blockedReason: undefined,
    },
  ]);
  if (!saved) return false;

  const priorGeneration = getHaruRagSyncGeneration(normalizedUserId);
  const generationSaved = saveSyncGeneration({
    userId: normalizedUserId,
    generation: priorGeneration?.generation ?? 0,
    generationConfirmed: false,
    deletionConfirmed: false,
    reenrollmentAuthorized: false,
    updatedAt: timestamp,
  });

  const payloadOutboxPurged = saveOutbox(
    readOutbox().filter((entry) => entryUserId(entry) !== normalizedUserId),
  );
  dispatchOutboxUpdated();
  return generationSaved && payloadOutboxPurged;
}

export function enqueueHaruRagRecord(
  record: HaruAdminUsageRecord,
  now = new Date(),
): boolean {
  const scopeKey = scopeFor(record);
  const entries = readOutbox().filter((entry) => entry.scopeKey !== scopeKey);
  const syncRecord = payloadForCurrentConsent(record);

  if (!syncRecord.user.consents.longitudinal_usage_storage) {
    // enqueueHaruRagUserDeletion removes every queued snapshot for this user.
    // Do not write the pre-deletion `entries` snapshot afterwards: it may still
    // contain another dataset scope and would resurrect withdrawn data.
    return enqueueHaruRagUserDeletion(record.user.user_id, now);
  }
  if (readDeletionOutbox().some((entry) => entry.userId === record.user.user_id)) {
    saveOutbox(entries);
    return false;
  }
  const generation = getHaruRagSyncGeneration(record.user.user_id);
  if (
    generation &&
    (!generation.generationConfirmed ||
      (generation.deletionConfirmed && !generation.reenrollmentAuthorized))
  ) {
    saveOutbox(entries);
    return false;
  }

  const payload = canonicalJson(syncRecord);
  const contentHash = haruRagContentHash(syncRecord);
  const existing = readOutbox().find((entry) => entry.scopeKey === scopeKey);
  const timestamp = now.toISOString();
  const saved = saveOutbox([
    ...entries,
    {
      scopeKey,
      contentHash,
      payload,
      attempts: 0,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      nextAttemptAt: 0,
      blockedReason: undefined,
    },
  ]);
  if (saved) dispatchOutboxUpdated();
  return saved;
}

export function ragApiBaseUrl(): string {
  const raw = import.meta.env.VITE_RAG_API_BASE_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/+$/, "") : DEFAULT_RAG_API_BASE_URL;
}

function authorizationHeaders(): Record<string, string> {
  const token = import.meta.env.VITE_RAG_API_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function retryDelayMs(attempts: number): number {
  return Math.min(MAX_RETRY_DELAY_MS, 1_000 * 2 ** Math.min(attempts, 6));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function flushDeletionOutbox(options: HaruRagSyncOptions): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const snapshot = readDeletionOutbox();

  for (const entry of snapshot) {
    if (entry.blockedReason) continue;
    if (!options.force && entry.nextAttemptAt > now()) continue;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let succeeded: boolean;
    let retryable: boolean;
    let status: number | null;
    try {
      const response = await fetchImpl(
        `${ragApiBaseUrl()}/api/users/${encodeURIComponent(entry.userId)}`,
        {
          method: "DELETE",
          headers: authorizationHeaders(),
          signal: controller.signal,
        },
      );
      status = response.status;
      succeeded = false;
      retryable = isRetryableStatus(response.status);
      if (response.ok && typeof response.json === "function") {
        try {
          const result = (await response.json()) as unknown;
          const generation = isRecord(result) ? result.generation : null;
          if (
            isRecord(result) &&
            result.complete === true &&
            typeof generation === "number" &&
            Number.isSafeInteger(generation) &&
            generation >= 1
          ) {
            const priorGeneration = getHaruRagSyncGeneration(entry.userId);
            succeeded = saveSyncGeneration({
              userId: entry.userId,
              generation,
              generationConfirmed: true,
              deletionConfirmed: true,
              reenrollmentAuthorized: priorGeneration?.reenrollmentAuthorized ?? false,
              updatedAt: new Date(now()).toISOString(),
            });
          } else {
            succeeded = false;
          }
          retryable = !succeeded;
        } catch {
          // Remote deletion is privacy-sensitive. Keep the tombstone until the
          // server explicitly proves every configured store completed cleanup.
          succeeded = false;
          retryable = true;
        }
      } else if (response.ok) {
        retryable = true;
      }
    } catch {
      succeeded = false;
      retryable = true;
      status = null;
    } finally {
      clearTimeout(timer);
    }

    const latest = readDeletionOutbox();
    const currentIndex = latest.findIndex((candidate) => candidate.userId === entry.userId);
    if (currentIndex < 0) continue;
    if (succeeded) {
      latest.splice(currentIndex, 1);
    } else if (retryable) {
      const attempts = latest[currentIndex].attempts + 1;
      latest[currentIndex] = {
        ...latest[currentIndex],
        attempts,
        nextAttemptAt: now() + retryDelayMs(attempts),
      };
    } else {
      latest[currentIndex] = {
        ...latest[currentIndex],
        attempts: latest[currentIndex].attempts + 1,
        nextAttemptAt: Number.MAX_SAFE_INTEGER,
        blockedReason: `http-${status ?? "unknown"}`,
      };
    }
    saveDeletionOutbox(latest);
  }
}

let activeFlush: Promise<void> | null = null;
let flushAgain = false;
let nextFlushOptions: HaruRagSyncOptions | null = null;
const activeIngestRequests = new Set<AbortController>();

function abortActiveIngestRequests(): void {
  for (const controller of activeIngestRequests) controller.abort();
  activeIngestRequests.clear();
}

function reconcileOutboxWithCurrentConsent(now: number): void {
  const runtimeConsent = getHaruConsent();
  const timestamp = new Date(now).toISOString();
  const retained: HaruRagOutboxEntry[] = [];
  const deletionUserIds = new Set<string>();

  for (const entry of readOutbox()) {
    let record: HaruAdminUsageRecord;
    try {
      const parsed = JSON.parse(entry.payload) as unknown;
      if (!isRecord(parsed) || !isRecord(parsed.user)) continue;
      record = parsed as unknown as HaruAdminUsageRecord;
    } catch {
      continue;
    }
    const syncRecord = payloadForCurrentConsent(record, runtimeConsent);
    if (!syncRecord.user.consents.longitudinal_usage_storage) {
      deletionUserIds.add(syncRecord.user.user_id);
      continue;
    }
    const payload = canonicalJson(syncRecord);
    const contentHash = haruRagContentHash(syncRecord);
    retained.push(
      payload === entry.payload && contentHash === entry.contentHash
        ? entry
        : {
            ...entry,
            payload,
            contentHash,
            attempts: 0,
            updatedAt: timestamp,
            nextAttemptAt: 0,
            blockedReason: undefined,
          },
    );
  }

  saveOutbox(retained);
  for (const userId of deletionUserIds) {
    enqueueHaruRagUserDeletion(userId, new Date(now));
  }
}

async function flushInternal(options: HaruRagSyncOptions): Promise<void> {
  const now = options.now ?? Date.now;
  reconcileOutboxWithCurrentConsent(now());
  await flushDeletionOutbox(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const snapshot = readOutbox();
  const pendingDeletionUserIds = new Set(readDeletionOutbox().map((entry) => entry.userId));

  for (const entry of snapshot) {
    if (entry.blockedReason) continue;
    const userId = entryUserId(entry);
    if (userId && pendingDeletionUserIds.has(userId)) continue;
    if (!options.force && entry.nextAttemptAt > now()) continue;

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(entry.payload) as unknown;
    } catch {
      saveOutbox(
        readOutbox().filter(
          (candidate) =>
            candidate.scopeKey !== entry.scopeKey || candidate.contentHash !== entry.contentHash,
        ),
      );
      continue;
    }
    if (
      !isRecord(parsedPayload) ||
      !isRecord(parsedPayload.user) ||
      !isRecord(parsedPayload.user.consents) ||
      parsedPayload.user.consents.longitudinal_usage_storage !== true
    ) {
      saveOutbox(
        readOutbox().filter(
          (candidate) =>
            candidate.scopeKey !== entry.scopeKey || candidate.contentHash !== entry.contentHash,
        ),
      );
      continue;
    }
    const requestRecord = payloadForCurrentConsent(
      parsedPayload as unknown as HaruAdminUsageRecord,
    );
    if (!requestRecord.user.consents.longitudinal_usage_storage) {
      enqueueHaruRagUserDeletion(requestRecord.user.user_id, new Date(now()));
      continue;
    }
    const requestPayload = canonicalJson(requestRecord);
    const requestContentHash = haruRagContentHash(requestRecord);

    const controller = new AbortController();
    activeIngestRequests.add(controller);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let succeeded: boolean;
    let retryable: boolean;
    let status: number | null;
    const generation = userId ? getHaruRagSyncGeneration(userId) : null;
    const isReenrollment = Boolean(
      generation?.generationConfirmed &&
        generation.deletionConfirmed &&
        generation.reenrollmentAuthorized,
    );
    try {
      const response = await fetchImpl(`${ragApiBaseUrl()}/api/ingest/json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `haru-${requestContentHash}`,
          "X-Haru-Content-Hash": requestContentHash,
          ...(generation?.generationConfirmed
            ? { "X-Haru-Sync-Generation": String(generation.generation) }
            : {}),
          ...(isReenrollment ? { "X-Haru-Reenroll": "true" } : {}),
          ...authorizationHeaders(),
        },
        body: requestPayload,
        signal: controller.signal,
      });
      status = response.status;
      succeeded = response.ok;
      retryable = isRetryableStatus(response.status);
      if (succeeded && isReenrollment) {
        if (typeof response.json !== "function") {
          succeeded = false;
          retryable = true;
        } else {
          try {
            const result = (await response.json()) as unknown;
            succeeded =
              isRecord(result) && result.sync_generation === generation?.generation;
            retryable = !succeeded;
          } catch {
            succeeded = false;
            retryable = true;
          }
        }
      }
    } catch {
      succeeded = false;
      retryable = true;
      status = null;
    } finally {
      clearTimeout(timer);
      activeIngestRequests.delete(controller);
    }

    const recordAfterRequest = payloadForCurrentConsent(
      parsedPayload as unknown as HaruAdminUsageRecord,
    );
    if (
      !recordAfterRequest.user.consents.longitudinal_usage_storage ||
      haruRagContentHash(recordAfterRequest) !== requestContentHash
    ) {
      reconcileOutboxWithCurrentConsent(now());
      continue;
    }

    const latest = readOutbox();
    const currentIndex = latest.findIndex(
      (candidate) =>
        candidate.scopeKey === entry.scopeKey &&
        candidate.contentHash === requestContentHash,
    );
    if (currentIndex < 0) continue;
    if (succeeded && isReenrollment && generation && userId) {
      succeeded = saveSyncGeneration({
        ...generation,
        deletionConfirmed: false,
        reenrollmentAuthorized: false,
        updatedAt: new Date(now()).toISOString(),
      });
      if (!succeeded) retryable = true;
    }
    if (succeeded) {
      latest.splice(currentIndex, 1);
    } else if (retryable) {
      const attempts = latest[currentIndex].attempts + 1;
      latest[currentIndex] = {
        ...latest[currentIndex],
        attempts,
        nextAttemptAt: now() + retryDelayMs(attempts),
      };
    } else {
      latest[currentIndex] = {
        ...latest[currentIndex],
        attempts: latest[currentIndex].attempts + 1,
        nextAttemptAt: Number.MAX_SAFE_INTEGER,
        blockedReason: `http-${status ?? "unknown"}`,
      };
    }
    saveOutbox(latest);
  }
}

export function flushHaruRagOutbox(options: HaruRagSyncOptions = {}): Promise<void> {
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

export function startHaruRagSync(
  overrides: Omit<HaruRagSyncOptions, "force"> = {},
): () => void {
  if (typeof window === "undefined") return () => undefined;
  saveOutbox(
    readOutbox().map((entry) => ({
      ...entry,
      blockedReason: undefined,
      nextAttemptAt: 0,
    })),
  );
  saveDeletionOutbox(
    readDeletionOutbox().map((entry) => ({
      ...entry,
      blockedReason: undefined,
      nextAttemptAt: 0,
    })),
  );
  const flush = () => {
    void flushHaruRagOutbox({ ...overrides, force: true });
  };
  const retryDue = () => {
    void flushHaruRagOutbox(overrides);
  };
  window.addEventListener(HARU_RAG_OUTBOX_UPDATED_EVENT, flush);
  window.addEventListener("online", flush);
  const retryTimer = window.setInterval(retryDue, 15_000);
  const unsubscribeConsent = subscribeToHaruConsent(() => {
    abortActiveIngestRequests();
    reconcileOutboxWithCurrentConsent(Date.now());
    flush();
  });
  flush();
  return () => {
    window.removeEventListener(HARU_RAG_OUTBOX_UPDATED_EVENT, flush);
    window.removeEventListener("online", flush);
    window.clearInterval(retryTimer);
    unsubscribeConsent();
    abortActiveIngestRequests();
  };
}
