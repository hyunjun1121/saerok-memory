import type { HaruAdminUsageRecord } from "@/features/lessons/haruAdminUsageRecordStorage";
import { readJson, removeKey, writeJson } from "@/utils/safeStorage";

export const HARU_RAG_OUTBOX_STORAGE_KEY = "haruRagSyncOutbox";
export const HARU_RAG_DELETION_OUTBOX_STORAGE_KEY = "haruRagDeletionOutbox";
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
    removeKey(HARU_RAG_OUTBOX_STORAGE_KEY);
    return true;
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
    removeKey(HARU_RAG_DELETION_OUTBOX_STORAGE_KEY);
    return true;
  }
  return writeJson(HARU_RAG_DELETION_OUTBOX_STORAGE_KEY, entries);
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

export function clearHaruRagOutbox(): void {
  removeKey(HARU_RAG_OUTBOX_STORAGE_KEY);
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

  saveOutbox(readOutbox().filter((entry) => entryUserId(entry) !== normalizedUserId));
  dispatchOutboxUpdated();
  return true;
}

export function enqueueHaruRagRecord(
  record: HaruAdminUsageRecord,
  now = new Date(),
): boolean {
  const scopeKey = scopeFor(record);
  const entries = readOutbox().filter((entry) => entry.scopeKey !== scopeKey);

  if (!record.user.consents.longitudinal_usage_storage) {
    const deletionQueued = enqueueHaruRagUserDeletion(record.user.user_id, now);
    return saveOutbox(entries) && deletionQueued;
  }
  if (readDeletionOutbox().some((entry) => entry.userId === record.user.user_id)) {
    return saveOutbox(entries);
  }

  const payload = canonicalJson(record);
  const contentHash = haruRagContentHash(record);
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
      succeeded = response.ok;
      retryable = isRetryableStatus(response.status);
      if (response.ok && typeof response.json === "function") {
        try {
          const result = (await response.json()) as unknown;
          if (isRecord(result) && result.complete === false) {
            succeeded = false;
            retryable = true;
          }
        } catch {
          // Older/local test adapters may not expose a JSON body. A successful
          // HTTP response remains compatible; current server always returns
          // an explicit `complete` field.
        }
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

async function flushInternal(options: HaruRagSyncOptions): Promise<void> {
  await flushDeletionOutbox(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let succeeded: boolean;
    let retryable: boolean;
    let status: number | null;
    try {
      const response = await fetchImpl(`${ragApiBaseUrl()}/api/ingest/json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `haru-${entry.contentHash}`,
          "X-Haru-Content-Hash": entry.contentHash,
          ...authorizationHeaders(),
        },
        body: entry.payload,
        signal: controller.signal,
      });
      status = response.status;
      succeeded = response.ok;
      retryable = isRetryableStatus(response.status);
    } catch {
      succeeded = false;
      retryable = true;
      status = null;
    } finally {
      clearTimeout(timer);
    }

    const latest = readOutbox();
    const currentIndex = latest.findIndex(
      (candidate) =>
        candidate.scopeKey === entry.scopeKey && candidate.contentHash === entry.contentHash,
    );
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

export function startHaruRagSync(): () => void {
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
    void flushHaruRagOutbox({ force: true });
  };
  const retryDue = () => {
    void flushHaruRagOutbox();
  };
  window.addEventListener(HARU_RAG_OUTBOX_UPDATED_EVENT, flush);
  window.addEventListener("online", flush);
  const retryTimer = window.setInterval(retryDue, 15_000);
  flush();
  return () => {
    window.removeEventListener(HARU_RAG_OUTBOX_UPDATED_EVENT, flush);
    window.removeEventListener("online", flush);
    window.clearInterval(retryTimer);
  };
}
