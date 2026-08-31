import { validateTelemetryEnvelope } from "@/features/analytics/privacy";
import type { TelemetryEnvelope } from "@/features/analytics/types";

export const TELEMETRY_OUTBOX_MAX_COUNT = 10_000;
export const TELEMETRY_OUTBOX_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
export const TELEMETRY_BATCH_MAX_EVENTS = 50;
export const TELEMETRY_BATCH_MAX_BYTES = 64 * 1_024;

export interface TelemetryOutboxRecord {
  eventId: string;
  event: TelemetryEnvelope;
  enqueuedAtMs: number;
  attempts: number;
  nextAttemptAtMs: number;
  lastErrorCode?: string;
}

export interface TelemetryOutboxStore {
  list(): Promise<TelemetryOutboxRecord[]>;
  put(record: TelemetryOutboxRecord): Promise<void>;
  remove(eventIds: readonly string[]): Promise<void>;
  clear(): Promise<void>;
}

export interface TelemetryOutboxOptions {
  maxCount?: number;
  maxRetentionMs?: number;
  now?: () => number;
  retryDelay?: (attempt: number) => number;
}

export class MemoryOutboxStore implements TelemetryOutboxStore {
  private readonly records = new Map<string, TelemetryOutboxRecord>();

  async list(): Promise<TelemetryOutboxRecord[]> {
    return Array.from(this.records.values(), (record) => ({ ...record }));
  }

  async put(record: TelemetryOutboxRecord): Promise<void> {
    this.records.set(record.eventId, { ...record });
  }

  async remove(eventIds: readonly string[]): Promise<void> {
    for (const eventId of eventIds) this.records.delete(eventId);
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}

function requestResult<Result>(request: IDBRequest<Result>): Promise<Result> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export class IndexedDbOutboxStore implements TelemetryOutboxStore {
  private readonly databasePromise: Promise<IDBDatabase>;
  private readonly storeName: string;

  constructor(
    indexedDb: IDBFactory,
    databaseName = "haru-telemetry",
    storeName = "events",
  ) {
    this.storeName = storeName;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDb.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(this.storeName)) {
          database.createObjectStore(this.storeName, { keyPath: "eventId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
      request.onblocked = () => reject(new Error("IndexedDB open was blocked"));
    });
  }

  async list(): Promise<TelemetryOutboxRecord[]> {
    const database = await this.databasePromise;
    const transaction = database.transaction(this.storeName, "readonly");
    const result = await requestResult(
      transaction.objectStore(this.storeName).getAll() as IDBRequest<TelemetryOutboxRecord[]>,
    );
    await transactionComplete(transaction);
    return result;
  }

  async put(record: TelemetryOutboxRecord): Promise<void> {
    const database = await this.databasePromise;
    const transaction = database.transaction(this.storeName, "readwrite");
    transaction.objectStore(this.storeName).put(record);
    await transactionComplete(transaction);
  }

  async remove(eventIds: readonly string[]): Promise<void> {
    if (eventIds.length === 0) return;
    const database = await this.databasePromise;
    const transaction = database.transaction(this.storeName, "readwrite");
    const store = transaction.objectStore(this.storeName);
    for (const eventId of eventIds) store.delete(eventId);
    await transactionComplete(transaction);
  }

  async clear(): Promise<void> {
    const database = await this.databasePromise;
    const transaction = database.transaction(this.storeName, "readwrite");
    transaction.objectStore(this.storeName).clear();
    await transactionComplete(transaction);
  }
}

class ResilientOutboxStore implements TelemetryOutboxStore {
  private readonly primary: TelemetryOutboxStore;
  private readonly fallback: TelemetryOutboxStore;

  constructor(
    primary: TelemetryOutboxStore,
    fallback: TelemetryOutboxStore,
  ) {
    this.primary = primary;
    this.fallback = fallback;
  }

  async list(): Promise<TelemetryOutboxRecord[]> {
    try {
      const [primaryRecords, fallbackRecords] = await Promise.all([
        this.primary.list(),
        this.fallback.list(),
      ]);
      const records = new Map(
        [...fallbackRecords, ...primaryRecords].map((record) => [record.eventId, record]),
      );
      await Promise.all(Array.from(records.values(), (record) => this.fallback.put(record)));
      return Array.from(records.values());
    } catch {
      return this.fallback.list();
    }
  }

  async put(record: TelemetryOutboxRecord): Promise<void> {
    await this.fallback.put(record);
    try {
      await this.primary.put(record);
    } catch {
      // In-memory mirror remains usable when IndexedDB is unavailable.
    }
  }

  async remove(eventIds: readonly string[]): Promise<void> {
    await this.fallback.remove(eventIds);
    try {
      await this.primary.remove(eventIds);
    } catch {
      // Failed primary is intentionally ignored after fallback succeeds.
    }
  }

  async clear(): Promise<void> {
    await this.fallback.clear();
    try {
      await this.primary.clear();
    } catch {
      // Failed primary is intentionally ignored after fallback succeeds.
    }
  }
}

function utf8Size(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function getTelemetryRetryDelayMs(
  attempt: number,
  options: { baseMs?: number; maxMs?: number; jitterRatio?: number; random?: () => number } = {},
): number {
  const baseMs = Math.max(1, options.baseMs ?? 1_000);
  const maxMs = Math.max(baseMs, options.maxMs ?? 60_000);
  const jitterRatio = Math.min(1, Math.max(0, options.jitterRatio ?? 0.2));
  const random = options.random ?? Math.random;
  const exponent = Math.max(0, Math.min(16, Math.trunc(attempt) - 1));
  const rawDelay = Math.min(maxMs, baseMs * 2 ** exponent);
  const jitterMultiplier = 1 - jitterRatio + random() * jitterRatio * 2;
  return Math.max(1, Math.round(rawDelay * jitterMultiplier));
}

export class TelemetryOutbox {
  private readonly store: TelemetryOutboxStore;
  private readonly maxCount: number;
  private readonly maxRetentionMs: number;
  private readonly now: () => number;
  private readonly retryDelay: (attempt: number) => number;

  constructor(
    store: TelemetryOutboxStore,
    options: TelemetryOutboxOptions = {},
  ) {
    this.store = store;
    this.maxCount = Math.max(1, Math.trunc(options.maxCount ?? TELEMETRY_OUTBOX_MAX_COUNT));
    this.maxRetentionMs = Math.max(1, options.maxRetentionMs ?? TELEMETRY_OUTBOX_RETENTION_MS);
    this.now = options.now ?? Date.now;
    this.retryDelay = options.retryDelay ?? getTelemetryRetryDelayMs;
  }

  async enqueue(event: TelemetryEnvelope): Promise<void> {
    const validation = validateTelemetryEnvelope(event);
    if (!validation.ok) {
      throw new Error(`Telemetry privacy validation failed: ${validation.reason}`);
    }

    const now = this.now();
    const existing = (await this.store.list()).find((record) => record.eventId === event.eventId);
    await this.store.put(
      existing ?? {
        eventId: event.eventId,
        event: validation.event,
        enqueuedAtMs: now,
        attempts: 0,
        nextAttemptAtMs: now,
      },
    );
    await this.prune(now);
  }

  async prune(atMs = this.now()): Promise<void> {
    const records = await this.store.list();
    const cutoff = atMs - this.maxRetentionMs;
    const expired = records.filter((record) => record.enqueuedAtMs < cutoff);
    const retained = records
      .filter((record) => record.enqueuedAtMs >= cutoff)
      .sort((left, right) =>
        left.enqueuedAtMs === right.enqueuedAtMs
          ? left.event.sequence - right.event.sequence
          : left.enqueuedAtMs - right.enqueuedAtMs,
      );
    const overflowCount = Math.max(0, retained.length - this.maxCount);
    const overflow = retained.slice(0, overflowCount);
    await this.store.remove([...expired, ...overflow].map(({ eventId }) => eventId));
  }

  async peekBatch(
    options: { maxEvents?: number; maxBytes?: number; atMs?: number } = {},
  ): Promise<TelemetryOutboxRecord[]> {
    const atMs = options.atMs ?? this.now();
    await this.prune(atMs);
    const maxEvents = Math.min(
      TELEMETRY_BATCH_MAX_EVENTS,
      Math.max(1, Math.trunc(options.maxEvents ?? TELEMETRY_BATCH_MAX_EVENTS)),
    );
    const maxBytes = Math.min(
      TELEMETRY_BATCH_MAX_BYTES,
      Math.max(2, Math.trunc(options.maxBytes ?? TELEMETRY_BATCH_MAX_BYTES)),
    );
    const eligible = (await this.store.list())
      .filter((record) => record.nextAttemptAtMs <= atMs)
      .sort((left, right) =>
        left.enqueuedAtMs === right.enqueuedAtMs
          ? left.event.sequence - right.event.sequence
          : left.enqueuedAtMs - right.enqueuedAtMs,
      );

    const batch: TelemetryOutboxRecord[] = [];
    for (const record of eligible) {
      if (batch.length >= maxEvents) break;
      const candidate = [...batch.map(({ event }) => event), record.event];
      if (utf8Size(candidate) > maxBytes) break;
      batch.push(record);
    }
    return batch;
  }

  async acknowledge(eventIds: readonly string[]): Promise<void> {
    await this.store.remove(eventIds);
  }

  async discard(eventIds: readonly string[]): Promise<void> {
    await this.store.remove(eventIds);
  }

  async markRetry(eventIds: readonly string[], errorCode = "transport_error"): Promise<void> {
    const targets = new Set(eventIds);
    const safeErrorCode = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,63}$/.test(errorCode)
      ? errorCode
      : "transport_error";
    const now = this.now();
    for (const record of await this.store.list()) {
      if (!targets.has(record.eventId)) continue;
      const attempts = record.attempts + 1;
      await this.store.put({
        ...record,
        attempts,
        nextAttemptAtMs: now + this.retryDelay(attempts),
        lastErrorCode: safeErrorCode,
      });
    }
  }

  async count(): Promise<number> {
    return (await this.store.list()).length;
  }

  async listEvents(): Promise<TelemetryEnvelope[]> {
    const atMs = this.now();
    await this.prune(atMs);
    return (await this.store.list())
      .sort((left, right) =>
        left.event.sequence === right.event.sequence
          ? left.enqueuedAtMs - right.enqueuedAtMs
          : left.event.sequence - right.event.sequence,
      )
      .map(({ event }) => ({ ...event } as TelemetryEnvelope));
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }
}

export function createTelemetryOutbox(
  options: TelemetryOutboxOptions & { indexedDb?: IDBFactory | null; databaseName?: string } = {},
): TelemetryOutbox {
  let indexedDb = options.indexedDb;
  if (indexedDb === undefined) {
    try {
      indexedDb = typeof window !== "undefined" ? window.indexedDB : null;
    } catch {
      indexedDb = null;
    }
  }

  const memoryStore = new MemoryOutboxStore();
  const store = indexedDb
    ? new ResilientOutboxStore(
        new IndexedDbOutboxStore(indexedDb, options.databaseName),
        memoryStore,
      )
    : memoryStore;
  return new TelemetryOutbox(store, options);
}
