import type { HaruAdminUsageRecord } from "@/features/lessons/haruAdminUsageRecordStorage";
import { readHaruAdminAudio } from "@/features/lessons/haruAdminAudioStorage";
import {
  extractHaruResponseFacts,
  type HaruDerivedAnnotation,
} from "@/features/lessons/haruResponseFacts";
import {
  formatSttEngine,
  transcribeStory,
  type TranscribeResult,
} from "@/features/speech/stt";
import {
  getHaruConsent,
  subscribeToHaruConsent,
} from "@/features/profile/haruConsentStorage";
import { readJson, removeKey, writeJson } from "@/utils/safeStorage";

export const HARU_STT_RETRY_OUTBOX_STORAGE_KEY = "haruSttRetryOutbox";
export const HARU_STT_RETRY_OUTBOX_UPDATED_EVENT = "haru:stt-retry-outbox-updated";

const MAX_RETRY_DELAY_MS = 60_000;
const RETRY_INTERVAL_MS = 15_000;

export interface HaruSttRetryEntry {
  key: string;
  userId: string;
  sessionDate: string;
  questionId: string;
  objectKey: string;
  consentRevision: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: number;
}

export interface HaruSttRetrySuccess {
  userId: string;
  sessionDate: string;
  questionId: string;
  objectKey: string;
  processedAt: string;
  engine: string;
  result: TranscribeResult;
  derivedAnnotations: HaruDerivedAnnotation[];
}

export type HaruSttRetryPatchResult = "patched" | "stale" | "retry";
export type HaruSttRetryPatch = (
  success: HaruSttRetrySuccess,
) => HaruSttRetryPatchResult | Promise<HaruSttRetryPatchResult>;

type AudioReader = (objectKey: string) => Promise<Blob | null>;
type Transcriber = typeof transcribeStory;

export interface HaruSttRetryOptions {
  patchResponse: HaruSttRetryPatch;
  readAudioImpl?: AudioReader;
  transcribeImpl?: Transcriber;
  now?: () => number;
  force?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRetryEntry(value: unknown): value is HaruSttRetryEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.key === "string" &&
    typeof value.userId === "string" &&
    typeof value.sessionDate === "string" &&
    typeof value.questionId === "string" &&
    typeof value.objectKey === "string" &&
    typeof value.consentRevision === "string" &&
    Number.isFinite(Date.parse(value.consentRevision)) &&
    typeof value.attempts === "number" &&
    Number.isFinite(value.attempts) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.nextAttemptAt === "number" &&
    Number.isFinite(value.nextAttemptAt)
  );
}

function retryKey(
  userId: string,
  sessionDate: string,
  questionId: string,
  objectKey: string,
  consentRevision: string,
): string {
  return JSON.stringify([
    userId,
    sessionDate,
    questionId,
    objectKey,
    consentRevision,
  ]);
}

function readOutbox(): HaruSttRetryEntry[] {
  const stored = readJson<unknown>(HARU_STT_RETRY_OUTBOX_STORAGE_KEY, []);
  return Array.isArray(stored) ? stored.filter(isRetryEntry) : [];
}

function saveOutbox(entries: HaruSttRetryEntry[]): boolean {
  if (entries.length === 0) {
    return removeKey(HARU_STT_RETRY_OUTBOX_STORAGE_KEY);
  }
  return writeJson(HARU_STT_RETRY_OUTBOX_STORAGE_KEY, entries);
}

function dispatchOutboxUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HARU_STT_RETRY_OUTBOX_UPDATED_EVENT));
}

function retryDelayMs(attempts: number): number {
  return Math.min(MAX_RETRY_DELAY_MS, 1_000 * 2 ** Math.min(attempts, 6));
}

function desiredEntries(record: HaruAdminUsageRecord): Array<{
  userId: string;
  sessionDate: string;
  questionId: string;
  objectKey: string;
  consentRevision: string;
}> {
  const consentRevision = getHaruConsent().updatedAt;
  if (
    !record.user.consents.voice_recording ||
    !record.user.consents.stt_processing ||
    !record.user.consents.longitudinal_usage_storage
  ) {
    return [];
  }

  return record.sessions.flatMap((session) =>
    session.question_records.flatMap((questionRecord) => {
      const response = questionRecord.response;
      if (
        response?.input_mode !== "voice" ||
        response.stt.status !== "failed" ||
        response.stt.no_speech === true ||
        response.audio_storage.retention_status !== "stored" ||
        response.audio_storage.object_key.trim().length === 0
      ) {
        return [];
      }
      return [
        {
          userId: record.user.user_id,
          sessionDate: session.session_date,
          questionId: questionRecord.question.question_id,
          objectKey: response.audio_storage.object_key,
          consentRevision,
        },
      ];
    }),
  );
}

export function getHaruSttRetryOutbox(): readonly HaruSttRetryEntry[] {
  return readOutbox();
}

const activeTranscriptions = new Set<AbortController>();

function hasSpeechStorageConsent(): boolean {
  const consent = getHaruConsent();
  return (
    consent.voiceRecording &&
    consent.sttProcessing &&
    consent.longitudinalUsageStorage
  );
}

function consentRevisionIsCurrent(entry: HaruSttRetryEntry): boolean {
  return getHaruConsent().updatedAt === entry.consentRevision;
}

function abortActiveTranscriptions(): void {
  for (const controller of activeTranscriptions) controller.abort();
  activeTranscriptions.clear();
}

export function clearHaruSttRetryOutbox(): boolean {
  abortActiveTranscriptions();
  return removeKey(HARU_STT_RETRY_OUTBOX_STORAGE_KEY);
}

export function reconcileHaruSttRetryOutbox(
  record: HaruAdminUsageRecord,
  now = new Date(),
): boolean {
  const existing = readOutbox();
  const existingByKey = new Map(existing.map((entry) => [entry.key, entry]));
  const timestamp = now.toISOString();
  const retainedOtherUsers = existing.filter((entry) => entry.userId !== record.user.user_id);
  const desired = desiredEntries(record).map((candidate) => {
    const key = retryKey(
      candidate.userId,
      candidate.sessionDate,
      candidate.questionId,
      candidate.objectKey,
      candidate.consentRevision,
    );
    const previous = existingByKey.get(key);
    return {
      key,
      ...candidate,
      attempts: previous?.attempts ?? 0,
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: previous?.updatedAt ?? timestamp,
      nextAttemptAt: previous?.nextAttemptAt ?? 0,
    };
  });
  const next = [...retainedOtherUsers, ...desired];
  if (JSON.stringify(next) === JSON.stringify(existing)) return true;
  const saved = saveOutbox(next);
  if (saved && desired.some((entry) => !existingByKey.has(entry.key))) {
    dispatchOutboxUpdated();
  }
  return saved;
}

function removeCurrentEntry(entry: HaruSttRetryEntry): void {
  saveOutbox(readOutbox().filter((candidate) => candidate.key !== entry.key));
}

function deferCurrentEntry(entry: HaruSttRetryEntry, now: number): void {
  const latest = readOutbox();
  const index = latest.findIndex((candidate) => candidate.key === entry.key);
  if (index < 0) return;
  const attempts = latest[index].attempts + 1;
  latest[index] = {
    ...latest[index],
    attempts,
    updatedAt: new Date(now).toISOString(),
    nextAttemptAt: now + retryDelayMs(attempts),
  };
  saveOutbox(latest);
}

let activeFlush: Promise<void> | null = null;
let flushAgain = false;
let nextFlushOptions: HaruSttRetryOptions | null = null;

async function flushInternal(options: HaruSttRetryOptions): Promise<void> {
  if (!hasSpeechStorageConsent()) {
    clearHaruSttRetryOutbox();
    return;
  }
  const readAudio = options.readAudioImpl ?? readHaruAdminAudio;
  const transcribe = options.transcribeImpl ?? transcribeStory;
  const now = options.now ?? Date.now;
  const snapshot = readOutbox();

  for (const entry of snapshot) {
    if (!hasSpeechStorageConsent()) {
      clearHaruSttRetryOutbox();
      return;
    }
    if (!consentRevisionIsCurrent(entry)) {
      removeCurrentEntry(entry);
      continue;
    }
    if (!options.force && entry.nextAttemptAt > now()) continue;

    let audio: Blob | null;
    try {
      audio = await readAudio(entry.objectKey);
    } catch {
      deferCurrentEntry(entry, now());
      continue;
    }
    if (!audio || audio.size === 0) {
      removeCurrentEntry(entry);
      continue;
    }
    if (!hasSpeechStorageConsent()) {
      clearHaruSttRetryOutbox();
      return;
    }
    if (!consentRevisionIsCurrent(entry)) {
      removeCurrentEntry(entry);
      continue;
    }

    let result: TranscribeResult | null;
    const controller = new AbortController();
    activeTranscriptions.add(controller);
    try {
      result = await transcribe(audio, { signal: controller.signal });
    } catch {
      result = null;
    } finally {
      activeTranscriptions.delete(controller);
    }
    if (!hasSpeechStorageConsent()) {
      clearHaruSttRetryOutbox();
      return;
    }
    if (!result || (!result.noSpeech && result.text.trim().length === 0)) {
      deferCurrentEntry(entry, now());
      continue;
    }
    if (
      !consentRevisionIsCurrent(entry) ||
      !readOutbox().some((candidate) => candidate.key === entry.key)
    ) {
      removeCurrentEntry(entry);
      continue;
    }

    const processedAtMs = now();
    let patchResult: HaruSttRetryPatchResult;
    try {
      patchResult = await options.patchResponse({
        userId: entry.userId,
        sessionDate: entry.sessionDate,
        questionId: entry.questionId,
        objectKey: entry.objectKey,
        processedAt: new Date(processedAtMs).toISOString(),
        engine: formatSttEngine(result),
        result,
        derivedAnnotations: result.noSpeech
          ? []
          : extractHaruResponseFacts(entry.questionId, result.text),
      });
    } catch {
      patchResult = "retry";
    }
    if (patchResult === "retry") {
      deferCurrentEntry(entry, processedAtMs);
    } else {
      removeCurrentEntry(entry);
    }
  }
}

export function flushHaruSttRetryOutbox(options: HaruSttRetryOptions): Promise<void> {
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

export function startHaruSttRetry(
  patchResponse: HaruSttRetryPatch,
  overrides: Omit<HaruSttRetryOptions, "patchResponse" | "force"> = {},
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const flush = () => {
    void flushHaruSttRetryOutbox({ ...overrides, patchResponse, force: true });
  };
  const retryDue = () => {
    void flushHaruSttRetryOutbox({ ...overrides, patchResponse });
  };
  window.addEventListener(HARU_STT_RETRY_OUTBOX_UPDATED_EVENT, flush);
  window.addEventListener("online", flush);
  const retryTimer = window.setInterval(retryDue, RETRY_INTERVAL_MS);
  const unsubscribeConsent = subscribeToHaruConsent((consent) => {
    if (
      !consent.voiceRecording ||
      !consent.sttProcessing ||
      !consent.longitudinalUsageStorage
    ) {
      clearHaruSttRetryOutbox();
    }
  });
  flush();
  return () => {
    window.removeEventListener(HARU_STT_RETRY_OUTBOX_UPDATED_EVENT, flush);
    window.removeEventListener("online", flush);
    window.clearInterval(retryTimer);
    unsubscribeConsent();
  };
}
