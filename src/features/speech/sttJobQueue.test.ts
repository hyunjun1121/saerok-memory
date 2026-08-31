import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSttJobsByTargetKind,
  clearSttJobQueue,
  enqueueSttJob,
  flushSttJobQueue,
  getSttJobQueue,
  startSttJobQueue,
  STT_JOB_ENQUEUE_INTENT_STORAGE_PREFIX,
  STT_JOB_GLOBAL_CLEAR_FENCE_STORAGE_KEY,
  STT_JOB_OUTBOX_STORAGE_KEY,
  STT_JOB_OUTBOX_UPDATED_EVENT,
  STT_JOB_TARGET_CLEAR_FENCE_STORAGE_PREFIX,
  STT_JOB_TARGET_EPOCH_STORAGE_KEY,
} from "@/features/speech/sttJobQueue";
import { HARU_ADMIN_DELETION_FENCE_STORAGE_KEY } from "@/features/lessons/haruAdminDeletionFenceStorage";
import {
  getCognitiveRoutineResults,
  saveCognitiveRoutineResult,
} from "@/features/cognitive/cognitiveRoutineStorage";
import {
  clearMemoryCards,
  getMemoryCards,
  upsertMemoryCueCard,
} from "@/features/memory/memoryCardStorage";
import type { TranscribeResult } from "@/features/speech/stt";
import { updateHaruConsent } from "@/features/profile/haruConsentStorage";

function audio(): Blob {
  return new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
}

function qwenResult(overrides: Partial<TranscribeResult> = {}): TranscribeResult {
  return {
    text: "오늘 딸과 공원에 갔어요.",
    noSpeech: false,
    language: "ko-KR",
    durationSec: 3.4,
    confidence: null,
    engine: "qwen3-asr",
    model: "Qwen/Qwen3-ASR-1.7B",
    modelRevision: "model-revision",
    alignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
    alignerRevision: "aligner-revision",
    preprocessingVersion: "haru-dc-hp80-rms-v2",
    segments: [{ id: 0, start: 0, end: 3.4, text: "오늘 딸과 공원에 갔어요." }],
    ...overrides,
  };
}

function fakeAudioStore() {
  const blobs = new Map<string, Blob>();
  const calls: string[] = [];
  return {
    blobs,
    calls,
    storeAudioImpl: vi.fn(async (key: string, blob: Blob) => {
      calls.push(`store:${key}`);
      blobs.set(key, blob);
      return "stored" as const;
    }),
    readAudioImpl: vi.fn(async (key: string) => blobs.get(key) ?? null),
    deleteAudioImpl: vi.fn(async (key: string) => {
      calls.push(`delete:${key}`);
      blobs.delete(key);
    }),
  };
}

function intentStorageKey(kind: string, id: string): string {
  return `${STT_JOB_ENQUEUE_INTENT_STORAGE_PREFIX}${kind}:${encodeURIComponent(id)}`;
}

function fenceStorageKey(kind: string): string {
  return `${STT_JOB_TARGET_CLEAR_FENCE_STORAGE_PREFIX}${kind}`;
}

describe("durable background STT job queue", () => {
  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("persists audio before metadata and never puts blob, transcript, or token data in localStorage", async () => {
    const store = fakeAudioStore();
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    const jobId = await enqueueSttJob(
      audio(),
      {
        kind: "memory-story",
        memoryCardId: "daily_memory",
        transcript: "must-never-persist",
        token: "must-never-persist",
      } as Parameters<typeof enqueueSttJob>[1],
      {
        now: () => Date.parse("2026-07-18T00:00:00.000Z"),
        createId: () => "job-one",
        storeAudioImpl: store.storeAudioImpl,
      },
    );

    expect(jobId).toBe("job-one");
    expect(store.calls[0]).toBe("store:haru-stt-job/job-one");
    expect(setItem).toHaveBeenCalledWith(
      STT_JOB_OUTBOX_STORAGE_KEY,
      expect.any(String),
    );
    const raw = localStorage.getItem(STT_JOB_OUTBOX_STORAGE_KEY) ?? "";
    expect(raw).toContain("daily_memory");
    expect(raw).not.toContain("오늘 딸");
    expect(raw).not.toContain("must-never-persist");
    expect(raw).not.toContain("Blob");
    expect(raw.toLocaleLowerCase()).not.toContain("token");
    expect(getSttJobQueue()).toHaveLength(1);
  });

  it("deletes persisted audio when local queue metadata cannot be saved", async () => {
    const store = fakeAudioStore();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === STT_JOB_OUTBOX_STORAGE_KEY) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      originalSetItem.call(this, key, value);
    });

    const jobId = await enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: "daily_memory" },
      {
        createId: () => "quota-job",
        storeAudioImpl: store.storeAudioImpl,
        deleteAudioImpl: store.deleteAudioImpl,
      },
    );

    expect(jobId).toBeNull();
    expect(store.storeAudioImpl).toHaveBeenCalledTimes(1);
    expect(store.deleteAudioImpl).toHaveBeenCalledWith("haru-stt-job/quota-job");
    expect(store.blobs.size).toBe(0);
  });

  it("does not retain audio when voice or STT consent is absent", async () => {
    const store = fakeAudioStore();
    updateHaruConsent({ sttProcessing: false });

    const jobId = await enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: "no-consent" },
      {
        createId: () => "no-consent-job",
        storeAudioImpl: store.storeAudioImpl,
        deleteAudioImpl: store.deleteAudioImpl,
      },
    );

    expect(jobId).toBeNull();
    expect(store.storeAudioImpl).not.toHaveBeenCalled();
    expect(getSttJobQueue()).toEqual([]);
  });

  it("does not persist deferred STT without longitudinal target storage", async () => {
    const store = fakeAudioStore();
    updateHaruConsent({ longitudinalUsageStorage: false });

    const jobId = await enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: "no-storage-consent" },
      {
        createId: () => "no-storage-consent-job",
        storeAudioImpl: store.storeAudioImpl,
        deleteAudioImpl: store.deleteAudioImpl,
      },
    );

    expect(jobId).toBeNull();
    expect(store.storeAudioImpl).not.toHaveBeenCalled();
    expect(getSttJobQueue()).toEqual([]);
  });

  it.each(["audioStorage", "transcriptStorage"] as const)(
    "does not persist deferred STT work without %s consent",
    async (permission) => {
      const store = fakeAudioStore();
      updateHaruConsent({ [permission]: false });

      const jobId = await enqueueSttJob(
        audio(),
        { kind: "memory-story", memoryCardId: `no-${permission}` },
        {
          createId: () => `no-${permission}-job`,
          storeAudioImpl: store.storeAudioImpl,
          deleteAudioImpl: store.deleteAudioImpl,
        },
      );

      expect(jobId).toBeNull();
      expect(store.storeAudioImpl).not.toHaveBeenCalled();
      expect(getSttJobQueue()).toEqual([]);
    },
  );

  it("does not persist a transcript when transcript consent is withdrawn in flight", async () => {
    const store = fakeAudioStore();
    const cardId = upsertMemoryCueCard({
      linkedConceptId: "transcript-race",
      originalTranscript: "",
      recognitionError: "stt-pending",
    });
    await enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: cardId! },
      { createId: () => "transcript-race", storeAudioImpl: store.storeAudioImpl },
    );
    let resolveTranscription: ((result: TranscribeResult) => void) | null = null;
    const transcribeImpl = vi.fn(
      () =>
        new Promise<TranscribeResult>((resolve) => {
          resolveTranscription = resolve;
        }),
    );
    const flushing = flushSttJobQueue({
      force: true,
      isOnline: () => true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl: store.deleteAudioImpl,
      transcribeImpl,
    });
    await vi.waitFor(() => expect(transcribeImpl).toHaveBeenCalledTimes(1));

    updateHaruConsent({ transcriptStorage: false });
    resolveTranscription!(qwenResult({ text: "철회 뒤 저장 금지" }));
    await flushing;

    expect(getSttJobQueue()).toEqual([]);
    expect(getMemoryCards()[0]).toMatchObject({
      originalTranscript: "",
      recognitionError: "stt-pending",
    });
    expect(store.deleteAudioImpl).toHaveBeenCalledWith(
      "haru-stt-job/transcript-race",
    );
  });

  it("rejects enqueue admission while another tab owns the target clear fence", async () => {
    const store = fakeAudioStore();
    localStorage.setItem(
      fenceStorageKey("memory-story"),
      JSON.stringify({
        version: 1,
        token: "remote-clear",
        kind: "memory-story",
        state: "active",
        startedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
    );

    await expect(
      enqueueSttJob(
        audio(),
        { kind: "memory-story", memoryCardId: "blocked-by-remote" },
        {
          createId: () => "blocked-by-remote",
          storeAudioImpl: store.storeAudioImpl,
          deleteAudioImpl: store.deleteAudioImpl,
        },
      ),
    ).resolves.toBeNull();

    expect(store.storeAudioImpl).not.toHaveBeenCalled();
    expect(store.blobs.size).toBe(0);
  });

  it("rejects enqueue admission while another tab owns the admin deletion fence", async () => {
    const store = fakeAudioStore();
    localStorage.setItem(
      HARU_ADMIN_DELETION_FENCE_STORAGE_KEY,
      JSON.stringify({ token: "remote-admin-clear" }),
    );

    await expect(
      enqueueSttJob(
        audio(),
        { kind: "speech-repeat", routineResultId: "admin-clear-blocked" },
        {
          createId: () => "admin-clear-blocked",
          storeAudioImpl: store.storeAudioImpl,
          deleteAudioImpl: store.deleteAudioImpl,
        },
      ),
    ).resolves.toBeNull();

    expect(store.storeAudioImpl).not.toHaveBeenCalled();
    expect(getSttJobQueue()).toEqual([]);
  });

  it("lets queue deletion win while audio persistence is still in flight", async () => {
    const store = fakeAudioStore();
    let finishStore: ((status: "stored") => void) | null = null;
    const storeAudioImpl = vi.fn(
      (key: string, blob: Blob) =>
        new Promise<"stored">((resolve) => {
          store.blobs.set(key, blob);
          finishStore = resolve;
        }),
    );

    const enqueueing = enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: "clear-race" },
      {
        createId: () => "clear-race-job",
        storeAudioImpl,
        deleteAudioImpl: store.deleteAudioImpl,
      },
    );
    await vi.waitFor(() => expect(storeAudioImpl).toHaveBeenCalledTimes(1));

    let deletionSettled = false;
    const deleting = clearSttJobQueue({
      deleteAudioImpl: store.deleteAudioImpl,
    }).then((deleted) => {
      deletionSettled = true;
      return deleted;
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(deletionSettled).toBe(false);
    finishStore!("stored");

    await expect(enqueueing).resolves.toBeNull();
    await expect(deleting).resolves.toBe(true);
    expect(getSttJobQueue()).toEqual([]);
    expect(store.deleteAudioImpl).toHaveBeenCalledWith(
      "haru-stt-job/clear-race-job",
    );
  });

  it("purges queued audio without transcription after consent withdrawal", async () => {
    const store = fakeAudioStore();
    const cardId = upsertMemoryCueCard({ linkedConceptId: "withdrawn" });
    await enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: cardId! },
      { createId: () => "withdrawn-job", storeAudioImpl: store.storeAudioImpl },
    );
    updateHaruConsent({ voiceRecording: false });
    const transcribeImpl = vi.fn(async () => qwenResult());

    await flushSttJobQueue({
      force: true,
      isOnline: () => true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl: store.deleteAudioImpl,
      transcribeImpl,
    });

    expect(transcribeImpl).not.toHaveBeenCalled();
    expect(getSttJobQueue()).toEqual([]);
    expect(store.deleteAudioImpl).toHaveBeenCalledWith(
      "haru-stt-job/withdrawn-job",
    );
  });

  it("aborts active Qwen work when runtime consent is withdrawn", async () => {
    const store = fakeAudioStore();
    const resultId = saveCognitiveRoutineResult({
      type: "verbal_fluency_practice",
      completed: true,
      metadata: { category: "동물", sttStatus: "pending" },
    });
    await enqueueSttJob(
      audio(),
      { kind: "verbal-fluency", routineResultId: resultId! },
      { createId: () => "abort-job", storeAudioImpl: store.storeAudioImpl },
    );
    let observedSignal: AbortSignal | undefined;
    const transcribeImpl = vi.fn(
      (_blob: Blob, options?: { signal?: AbortSignal }) =>
        new Promise<TranscribeResult | null>((resolve) => {
          observedSignal = options?.signal;
          options?.signal?.addEventListener("abort", () => resolve(null), {
            once: true,
          });
        }),
    );

    const stop = startSttJobQueue({
      isOnline: () => true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl: store.deleteAudioImpl,
      transcribeImpl,
    });
    await vi.waitFor(() => expect(transcribeImpl).toHaveBeenCalledTimes(1));

    updateHaruConsent({ sttProcessing: false });

    await vi.waitFor(() => expect(observedSignal?.aborted).toBe(true));
    await vi.waitFor(() => expect(getSttJobQueue()).toEqual([]));
    expect(getCognitiveRoutineResults()[0].metadata?.transcript).toBeUndefined();
    stop();
  });

  it("patches a memory story with summary, cues, no raw audio, and full Qwen provenance", async () => {
    const store = fakeAudioStore();
    const cardId = upsertMemoryCueCard({
      linkedConceptId: "memory-target",
      originalTranscript: "",
      recognitionError: "stt-pending",
      sttStatus: "failed",
    });
    await enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: cardId! },
      { createId: () => "memory-job", storeAudioImpl: store.storeAudioImpl },
    );

    await flushSttJobQueue({
      force: true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl: store.deleteAudioImpl,
      transcribeImpl: vi.fn(async () => qwenResult()),
      isOnline: () => true,
    });

    expect(getSttJobQueue()).toEqual([]);
    expect(store.deleteAudioImpl).toHaveBeenCalledWith("haru-stt-job/memory-job");
    const [card] = getMemoryCards();
    expect(card).toMatchObject({
      linkedConceptId: "memory-target",
      originalTranscript: "오늘 딸과 공원에 갔어요.",
      textSummary: "오늘 딸과 공원에 갔어요.",
      storyCues: { people: ["딸"], places: ["공원"] },
      inputMode: "speech",
      recognitionError: null,
      sttStatus: "completed",
      sttNoSpeech: false,
      sttEngine: "qwen3-asr:Qwen/Qwen3-ASR-1.7B@model-revision",
      sttModel: "Qwen/Qwen3-ASR-1.7B",
      sttModelRevision: "model-revision",
      sttAlignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
      sttAlignerRevision: "aligner-revision",
      sttPreprocessingVersion: "haru-dc-hp80-rms-v2",
      sttLanguage: "ko-KR",
      sttConfidence: null,
      sttSegments: [{ id: 0, start: 0, end: 3.4, text: "오늘 딸과 공원에 갔어요." }],
    });
    expect(JSON.stringify(card)).not.toContain("audio/webm");
  });

  it("never applies deleted-card audio to a recreated card with the same concept", async () => {
    const store = fakeAudioStore();
    const deletedCardId = upsertMemoryCueCard({
      linkedConceptId: "recreated-concept",
      originalTranscript: "",
      recognitionError: "stt-pending",
    });
    await enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: deletedCardId! },
      { createId: () => "deleted-card-job", storeAudioImpl: store.storeAudioImpl },
    );
    expect(clearMemoryCards()).toBe(true);
    const replacementCardId = upsertMemoryCueCard({
      linkedConceptId: "recreated-concept",
      originalTranscript: "",
    });
    expect(replacementCardId).not.toBe(deletedCardId);
    const transcribeImpl = vi.fn(async () => qwenResult());

    await flushSttJobQueue({
      force: true,
      isOnline: () => true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl: store.deleteAudioImpl,
      transcribeImpl,
    });

    expect(transcribeImpl).not.toHaveBeenCalled();
    expect(getMemoryCards()).toEqual([
      expect.objectContaining({ id: replacementCardId, originalTranscript: "" }),
    ]);
    expect(getSttJobQueue()).toEqual([]);
    expect(store.deleteAudioImpl).toHaveBeenCalledWith(
      "haru-stt-job/deleted-card-job",
    );
  });

  it("derives verbal-fluency entries and counts on the same routine result", async () => {
    const store = fakeAudioStore();
    const resultId = saveCognitiveRoutineResult({
      type: "verbal_fluency_practice",
      completed: true,
      metadata: { category: "과일", transcript: "", sttStatus: "pending" },
    });
    await enqueueSttJob(
      audio(),
      { kind: "verbal-fluency", routineResultId: resultId! },
      { createId: () => "fluency-job", storeAudioImpl: store.storeAudioImpl },
    );

    await flushSttJobQueue({
      force: true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl: store.deleteAudioImpl,
      transcribeImpl: vi.fn(async () =>
        qwenResult({ text: "사과 배 사과", segments: [] }),
      ),
      isOnline: () => true,
    });

    expect(getCognitiveRoutineResults()).toHaveLength(1);
    expect(getCognitiveRoutineResults()[0]).toMatchObject({
      id: resultId,
      metadata: {
        category: "과일",
        transcript: "사과 배 사과",
        entries: ["사과", "배", "사과"],
        uniqueCount: 2,
        repetitionCount: 1,
        inputMode: "speech",
        recognitionError: null,
        sttStatus: "completed",
        sttModelRevision: "model-revision",
      },
    });
  });

  it("derives speech-repeat similarity from the phrase stored on the target result", async () => {
    const store = fakeAudioStore();
    const resultId = saveCognitiveRoutineResult({
      type: "speech_repeat_practice",
      completed: true,
      metadata: {
        phrase: "오늘 날씨가 좋습니다",
        transcript: "",
        sttStatus: "pending",
      },
    });
    await enqueueSttJob(
      audio(),
      { kind: "speech-repeat", routineResultId: resultId! },
      { createId: () => "repeat-job", storeAudioImpl: store.storeAudioImpl },
    );

    await flushSttJobQueue({
      force: true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl: store.deleteAudioImpl,
      transcribeImpl: vi.fn(async () =>
        qwenResult({ text: "오늘 날씨가 좋습니다", segments: [] }),
      ),
      isOnline: () => true,
    });

    expect(getCognitiveRoutineResults()[0]).toMatchObject({
      id: resultId,
      metadata: {
        transcript: "오늘 날씨가 좋습니다",
        pronunciationSimilarity: 1,
        sttStatus: "completed",
      },
    });
  });

  it("treats Qwen no-speech as terminal and patches empty derived metadata", async () => {
    const store = fakeAudioStore();
    const resultId = saveCognitiveRoutineResult({
      type: "verbal_fluency_practice",
      completed: true,
      metadata: { category: "동물", sttStatus: "pending" },
    });
    await enqueueSttJob(
      audio(),
      { kind: "verbal-fluency", routineResultId: resultId! },
      { createId: () => "silent-job", storeAudioImpl: store.storeAudioImpl },
    );

    await flushSttJobQueue({
      force: true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl: store.deleteAudioImpl,
      transcribeImpl: vi.fn(async () =>
        qwenResult({ text: "", noSpeech: true, segments: [] }),
      ),
      isOnline: () => true,
    });

    expect(getCognitiveRoutineResults()[0].metadata).toMatchObject({
      transcript: "",
      entries: [],
      uniqueCount: 0,
      repetitionCount: 0,
      inputMode: "skipped",
      recognitionError: "no-speech",
      sttStatus: "failed",
      sttNoSpeech: true,
      sttModel: "Qwen/Qwen3-ASR-1.7B",
    });
    expect(getSttJobQueue()).toEqual([]);
  });

  it("retries audio deletion without retranscribing an already-patched result", async () => {
    const store = fakeAudioStore();
    const resultId = saveCognitiveRoutineResult({
      type: "verbal_fluency_practice",
      completed: true,
      metadata: { category: "동물", sttStatus: "pending" },
    });
    await enqueueSttJob(
      audio(),
      { kind: "verbal-fluency", routineResultId: resultId! },
      { createId: () => "cleanup-job", storeAudioImpl: store.storeAudioImpl },
    );
    const transcribeImpl = vi.fn(async () => qwenResult({ text: "고양이" }));
    const deleteAudioImpl = vi
      .fn<(key: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("indexeddb busy"))
      .mockImplementation(async (key: string) => {
        store.blobs.delete(key);
      });

    await flushSttJobQueue({
      force: true,
      now: () => 20_000,
      isOnline: () => true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl,
      transcribeImpl,
    });
    expect(getSttJobQueue()[0]).toMatchObject({
      phase: "cleanup",
      attempts: 1,
      nextAttemptAt: 21_000,
    });
    expect(getCognitiveRoutineResults()[0].metadata?.transcript).toBe("고양이");

    await flushSttJobQueue({
      force: true,
      now: () => 21_000,
      isOnline: () => true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl,
      transcribeImpl,
    });
    expect(getSttJobQueue()).toEqual([]);
    expect(transcribeImpl).toHaveBeenCalledTimes(1);
    expect(deleteAudioImpl).toHaveBeenCalledTimes(2);
  });

  it("skips work offline and applies bounded exponential retry timing", async () => {
    const store = fakeAudioStore();
    const resultId = saveCognitiveRoutineResult({
      type: "verbal_fluency_practice",
      completed: true,
      metadata: { category: "동물", sttStatus: "pending" },
    });
    await enqueueSttJob(
      audio(),
      { kind: "verbal-fluency", routineResultId: resultId! },
      {
        now: () => 10_000,
        createId: () => "retry-job",
        storeAudioImpl: store.storeAudioImpl,
      },
    );
    const transcribeImpl = vi.fn(async () => null);

    await flushSttJobQueue({
      force: true,
      now: () => 10_000,
      isOnline: () => false,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl: store.deleteAudioImpl,
      transcribeImpl,
    });
    expect(transcribeImpl).not.toHaveBeenCalled();
    expect(getSttJobQueue()[0]).toMatchObject({ attempts: 0, nextAttemptAt: 0 });

    await flushSttJobQueue({
      force: true,
      now: () => 10_000,
      isOnline: () => true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl: store.deleteAudioImpl,
      transcribeImpl,
    });
    expect(getSttJobQueue()[0]).toMatchObject({ attempts: 1, nextAttemptAt: 11_000 });

    await flushSttJobQueue({
      now: () => 10_999,
      isOnline: () => true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl: store.deleteAudioImpl,
      transcribeImpl,
    });
    expect(transcribeImpl).toHaveBeenCalledTimes(1);

    await flushSttJobQueue({
      now: () => 11_000,
      isOnline: () => true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl: store.deleteAudioImpl,
      transcribeImpl,
    });
    expect(getSttJobQueue()[0]).toMatchObject({ attempts: 2, nextAttemptAt: 13_000 });
  });

  it("removes malformed and stale targets without transcription", async () => {
    const store = fakeAudioStore();
    await enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: "missing-card" },
      { createId: () => "stale-job", storeAudioImpl: store.storeAudioImpl },
    );
    store.blobs.set("haru-stt-job/malformed", audio());
    const existing = JSON.parse(
      localStorage.getItem(STT_JOB_OUTBOX_STORAGE_KEY) ?? "[]",
    ) as unknown[];
    localStorage.setItem(
      STT_JOB_OUTBOX_STORAGE_KEY,
      JSON.stringify([
        ...existing,
        {
          id: "malformed",
          objectKey: "haru-stt-job/malformed",
          target: { kind: "speech-repeat" },
        },
      ]),
    );
    const transcribeImpl = vi.fn(async () => qwenResult());

    await flushSttJobQueue({
      force: true,
      isOnline: () => true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl: store.deleteAudioImpl,
      transcribeImpl,
    });

    expect(transcribeImpl).not.toHaveBeenCalled();
    expect(getSttJobQueue()).toEqual([]);
    expect(store.deleteAudioImpl).toHaveBeenCalledWith("haru-stt-job/malformed");
    expect(store.deleteAudioImpl).toHaveBeenCalledWith("haru-stt-job/stale-job");
  });

  it("flushes at worker start and on queue update events", async () => {
    const store = fakeAudioStore();
    const resultId = saveCognitiveRoutineResult({
      type: "verbal_fluency_practice",
      completed: true,
      metadata: { category: "동물", sttStatus: "pending" },
    });
    await enqueueSttJob(
      audio(),
      { kind: "verbal-fluency", routineResultId: resultId! },
      { createId: () => "start-job", storeAudioImpl: store.storeAudioImpl },
    );
    const transcribeImpl = vi.fn(async () => qwenResult({ text: "고양이" }));

    const stop = startSttJobQueue({
      isOnline: () => true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl: store.deleteAudioImpl,
      transcribeImpl,
    });
    window.dispatchEvent(new Event(STT_JOB_OUTBOX_UPDATED_EVENT));
    await vi.waitFor(() => expect(getSttJobQueue()).toEqual([]));
    expect(transcribeImpl).toHaveBeenCalledTimes(1);
    stop();
  });

  it("lets explicit queue deletion win over an in-flight transcription", async () => {
    const store = fakeAudioStore();
    const cardId = upsertMemoryCueCard({
      linkedConceptId: "cancelled-memory",
      originalTranscript: "",
      recognitionError: "stt-pending",
    });
    await enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: cardId! },
      { createId: () => "cancelled-job", storeAudioImpl: store.storeAudioImpl },
    );
    let resolveTranscription: ((result: TranscribeResult) => void) | null = null;
    const transcribeImpl = vi.fn(
      () =>
        new Promise<TranscribeResult>((resolve) => {
          resolveTranscription = resolve;
        }),
    );
    const flushing = flushSttJobQueue({
      force: true,
      isOnline: () => true,
      readAudioImpl: store.readAudioImpl,
      deleteAudioImpl: store.deleteAudioImpl,
      transcribeImpl,
    });
    await vi.waitFor(() => expect(transcribeImpl).toHaveBeenCalledTimes(1));

    await clearSttJobQueue({ deleteAudioImpl: store.deleteAudioImpl });
    resolveTranscription!(qwenResult());
    await flushing;

    expect(getSttJobQueue()).toEqual([]);
    expect(getMemoryCards()[0]).toMatchObject({
      linkedConceptId: "cancelled-memory",
      originalTranscript: "",
      recognitionError: "stt-pending",
    });
  });

  it("clears queued metadata and every retained audio object", async () => {
    const store = fakeAudioStore();
    await enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: "one" },
      { createId: () => "one", storeAudioImpl: store.storeAudioImpl },
    );
    await enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: "two" },
      { createId: () => "two", storeAudioImpl: store.storeAudioImpl },
    );

    await expect(
      clearSttJobQueue({ deleteAudioImpl: store.deleteAudioImpl }),
    ).resolves.toBe(true);

    expect(getSttJobQueue()).toEqual([]);
    expect(localStorage.getItem(STT_JOB_OUTBOX_STORAGE_KEY)).toBeNull();
    expect(store.deleteAudioImpl).toHaveBeenCalledTimes(2);
  });

  it("keeps the global fence until a remote writing intent is drained", async () => {
    const store = fakeAudioStore();
    const objectKey = "haru-stt-job/global-remote-writing";
    const markerKey = intentStorageKey(
      "verbal-fluency",
      "global-remote-writing",
    );
    store.blobs.set(objectKey, audio());
    localStorage.setItem(
      markerKey,
      JSON.stringify({
        version: 1,
        token: "global-remote-tab",
        kind: "verbal-fluency",
        objectKey,
        state: "writing",
        startedAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
    );

    let deletionSettled = false;
    const deleting = clearSttJobQueue({
      deleteAudioImpl: store.deleteAudioImpl,
    }).then((deleted) => {
      deletionSettled = true;
      return deleted;
    });
    await vi.waitFor(() =>
      expect(
        localStorage.getItem(STT_JOB_GLOBAL_CLEAR_FENCE_STORAGE_KEY),
      ).not.toBeNull(),
    );
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(deletionSettled).toBe(false);

    localStorage.setItem(
      markerKey,
      JSON.stringify({
        version: 1,
        token: "global-remote-tab",
        kind: "verbal-fluency",
        objectKey,
        state: "stored",
        startedAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
    );

    await expect(deleting).resolves.toBe(true);
    expect(store.deleteAudioImpl).toHaveBeenCalledWith(objectKey);
    expect(store.blobs.has(objectKey)).toBe(false);
    expect(localStorage.getItem(markerKey)).toBeNull();
    expect(
      localStorage.getItem(STT_JOB_GLOBAL_CLEAR_FENCE_STORAGE_KEY),
    ).toBeNull();
    expect(getSttJobQueue()).toEqual([]);
  });

  it("clears only memory-story jobs and audio while preserving routine voice work", async () => {
    const store = fakeAudioStore();
    await enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: "memory-one" },
      { createId: () => "memory-one", storeAudioImpl: store.storeAudioImpl },
    );
    await enqueueSttJob(
      audio(),
      { kind: "verbal-fluency", routineResultId: "fluency-one" },
      { createId: () => "fluency-one", storeAudioImpl: store.storeAudioImpl },
    );
    await enqueueSttJob(
      audio(),
      { kind: "speech-repeat", routineResultId: "repeat-one" },
      { createId: () => "repeat-one", storeAudioImpl: store.storeAudioImpl },
    );

    await expect(
      clearSttJobsByTargetKind("memory-story", {
        deleteAudioImpl: store.deleteAudioImpl,
      }),
    ).resolves.toBe(true);

    expect(getSttJobQueue().map((entry) => entry.target.kind)).toEqual([
      "verbal-fluency",
      "speech-repeat",
    ]);
    expect(store.deleteAudioImpl).toHaveBeenCalledTimes(1);
    expect(store.deleteAudioImpl).toHaveBeenCalledWith(
      "haru-stt-job/memory-one",
    );
    expect(store.blobs.has("haru-stt-job/fluency-one")).toBe(true);
    expect(store.blobs.has("haru-stt-job/repeat-one")).toBe(true);
  });

  it("reports scoped audio deletion failure without deleting unrelated jobs", async () => {
    const store = fakeAudioStore();
    await enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: "blocked-memory" },
      { createId: () => "blocked-memory", storeAudioImpl: store.storeAudioImpl },
    );
    await enqueueSttJob(
      audio(),
      { kind: "speech-repeat", routineResultId: "keep-repeat" },
      { createId: () => "keep-repeat", storeAudioImpl: store.storeAudioImpl },
    );

    await expect(
      clearSttJobsByTargetKind("memory-story", {
        deleteAudioImpl: vi.fn(async () => {
          throw new Error("indexeddb blocked");
        }),
      }),
    ).resolves.toBe(false);

    expect(getSttJobQueue()).toHaveLength(1);
    expect(getSttJobQueue()[0].target.kind).toBe("speech-repeat");
  });

  it("reports scoped metadata verification failure without deleting unrelated metadata", async () => {
    const store = fakeAudioStore();
    await enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: "metadata-memory" },
      { createId: () => "metadata-memory", storeAudioImpl: store.storeAudioImpl },
    );
    await enqueueSttJob(
      audio(),
      { kind: "verbal-fluency", routineResultId: "metadata-fluency" },
      { createId: () => "metadata-fluency", storeAudioImpl: store.storeAudioImpl },
    );
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === STT_JOB_OUTBOX_STORAGE_KEY) return;
      originalSetItem.call(this, key, value);
    });

    await expect(
      clearSttJobsByTargetKind("memory-story", {
        deleteAudioImpl: store.deleteAudioImpl,
      }),
    ).resolves.toBe(false);

    expect(getSttJobQueue().map((entry) => entry.target.kind)).toEqual([
      "memory-story",
      "verbal-fluency",
    ]);
  });

  it("removes malformed memory metadata without touching malformed routine metadata", async () => {
    const deleteAudioImpl = vi.fn(async () => undefined);
    localStorage.setItem(
      STT_JOB_OUTBOX_STORAGE_KEY,
      JSON.stringify([
        {
          objectKey: "haru-stt-job/malformed-memory",
          target: { kind: "memory-story" },
        },
        {
          objectKey: "haru-stt-job/malformed-repeat",
          target: { kind: "speech-repeat", routineResultId: "repeat-result" },
        },
      ]),
    );

    await expect(
      clearSttJobsByTargetKind("memory-story", { deleteAudioImpl }),
    ).resolves.toBe(true);

    expect(deleteAudioImpl).toHaveBeenCalledWith(
      "haru-stt-job/malformed-memory",
    );
    expect(JSON.parse(localStorage.getItem(STT_JOB_OUTBOX_STORAGE_KEY) ?? "[]"))
      .toEqual([
        expect.objectContaining({
          objectKey: "haru-stt-job/malformed-repeat",
          target: expect.objectContaining({ kind: "speech-repeat" }),
        }),
      ]);
  });

  it("waits for an in-flight memory enqueue before scoped deletion succeeds", async () => {
    const store = fakeAudioStore();
    let finishStore: (() => void) | null = null;
    const enqueueing = enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: "late-memory" },
      {
        createId: () => "late-memory",
        storeAudioImpl: vi.fn(async (key, blob) => {
          await new Promise<void>((resolve) => {
            finishStore = resolve;
          });
          store.blobs.set(key, blob);
          return "stored" as const;
        }),
        deleteAudioImpl: store.deleteAudioImpl,
      },
    );
    await vi.waitFor(() => expect(finishStore).not.toBeNull());

    let deletionSettled = false;
    const deleting = clearSttJobsByTargetKind("memory-story", {
      deleteAudioImpl: store.deleteAudioImpl,
    }).then((deleted) => {
      deletionSettled = true;
      return deleted;
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const settledBeforeWrite = deletionSettled;
    expect(localStorage.getItem(STT_JOB_TARGET_EPOCH_STORAGE_KEY)).not.toBeNull();
    finishStore!();

    await expect(enqueueing).resolves.toBeNull();
    await expect(deleting).resolves.toBe(true);
    expect(settledBeforeWrite).toBe(false);
    expect(getSttJobQueue()).toEqual([]);
    expect(store.deleteAudioImpl).toHaveBeenCalledWith(
      "haru-stt-job/late-memory",
    );
    expect(store.blobs.has("haru-stt-job/late-memory")).toBe(false);
  });

  it("fails scoped deletion when an in-flight epoch-mismatched audio object cannot be removed", async () => {
    const store = fakeAudioStore();
    let finishStore: (() => void) | null = null;
    const enqueueing = enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: "orphan-memory" },
      {
        createId: () => "orphan-memory",
        storeAudioImpl: vi.fn(async (key, blob) => {
          await new Promise<void>((resolve) => {
            finishStore = resolve;
          });
          store.blobs.set(key, blob);
          return "stored" as const;
        }),
        deleteAudioImpl: vi.fn(async () => {
          throw new Error("indexeddb blocked");
        }),
      },
    );
    await vi.waitFor(() => expect(finishStore).not.toBeNull());
    const deleteAudioImpl = vi.fn(async () => {
      throw new Error("indexeddb blocked");
    });

    const deleting = clearSttJobsByTargetKind("memory-story", {
      deleteAudioImpl,
    });
    finishStore!();

    await expect(enqueueing).resolves.toBeNull();
    await expect(deleting).resolves.toBe(false);
    expect(deleteAudioImpl).toHaveBeenCalledWith(
      "haru-stt-job/orphan-memory",
    );
    expect(store.blobs.has("haru-stt-job/orphan-memory")).toBe(true);
    expect(
      localStorage.getItem(intentStorageKey("memory-story", "orphan-memory")),
    ).not.toBeNull();
    expect(localStorage.getItem(fenceStorageKey("memory-story"))).toContain(
      '"state":"blocked"',
    );

    await expect(
      clearSttJobsByTargetKind("memory-story", {
        deleteAudioImpl: store.deleteAudioImpl,
      }),
    ).resolves.toBe(true);
    expect(store.blobs.has("haru-stt-job/orphan-memory")).toBe(false);
    expect(
      localStorage.getItem(intentStorageKey("memory-story", "orphan-memory")),
    ).toBeNull();
    expect(localStorage.getItem(fenceStorageKey("memory-story"))).toBeNull();
  });

  it("does not report scoped success until a remote writing intent settles and is drained", async () => {
    const store = fakeAudioStore();
    const objectKey = "haru-stt-job/remote-writing";
    const markerKey = intentStorageKey("memory-story", "remote-writing");
    store.blobs.set(objectKey, audio());
    localStorage.setItem(
      markerKey,
      JSON.stringify({
        version: 1,
        token: "remote-writer",
        kind: "memory-story",
        objectKey,
        state: "writing",
        startedAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
    );

    let deletionSettled = false;
    const deleting = clearSttJobsByTargetKind("memory-story", {
      deleteAudioImpl: store.deleteAudioImpl,
    }).then((deleted) => {
      deletionSettled = true;
      return deleted;
    });
    await vi.waitFor(() =>
      expect(localStorage.getItem(fenceStorageKey("memory-story"))).not.toBeNull(),
    );
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(deletionSettled).toBe(false);

    localStorage.setItem(
      markerKey,
      JSON.stringify({
        version: 1,
        token: "remote-writer",
        kind: "memory-story",
        objectKey,
        state: "stored",
        startedAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
    );

    await expect(deleting).resolves.toBe(true);
    expect(store.deleteAudioImpl).toHaveBeenCalledWith(objectKey);
    expect(store.blobs.has(objectKey)).toBe(false);
    expect(localStorage.getItem(markerKey)).toBeNull();
    expect(localStorage.getItem(fenceStorageKey("memory-story"))).toBeNull();
  });

  it("drains an other-tab intent registered immediately after fence acquisition", async () => {
    const store = fakeAudioStore();
    const objectKey = "haru-stt-job/post-fence-remote";
    const markerKey = intentStorageKey("memory-story", "post-fence-remote");
    store.blobs.set(objectKey, audio());
    const originalSetItem = Storage.prototype.setItem;
    let injected = false;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      originalSetItem.call(this, key, value);
      if (key === fenceStorageKey("memory-story") && !injected) {
        injected = true;
        originalSetItem.call(
          this,
          markerKey,
          JSON.stringify({
            version: 1,
            token: "remote-after-fence",
            kind: "memory-story",
            objectKey,
            state: "stored",
            startedAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: Date.now() + 60_000,
          }),
        );
      }
    });

    await expect(
      clearSttJobsByTargetKind("memory-story", {
        deleteAudioImpl: store.deleteAudioImpl,
      }),
    ).resolves.toBe(true);

    expect(injected).toBe(true);
    expect(store.deleteAudioImpl).toHaveBeenCalledWith(objectKey);
    expect(localStorage.getItem(markerKey)).toBeNull();
  });

  it("fails closed by sweeping stale and malformed remote intent markers", async () => {
    const store = fakeAudioStore();
    const staleKey = intentStorageKey("memory-story", "stale-remote");
    const malformedKey = intentStorageKey("memory-story", "malformed-remote");
    store.blobs.set("haru-stt-job/stale-remote", audio());
    store.blobs.set("haru-stt-job/malformed-remote", audio());
    localStorage.setItem(
      staleKey,
      JSON.stringify({
        version: 1,
        token: "crashed-tab",
        kind: "memory-story",
        objectKey: "haru-stt-job/stale-remote",
        state: "writing",
        startedAt: Date.now() - 120_000,
        updatedAt: Date.now() - 120_000,
        expiresAt: Date.now() - 60_000,
      }),
    );
    localStorage.setItem(malformedKey, "{not-json");

    await expect(
      clearSttJobsByTargetKind("memory-story", {
        deleteAudioImpl: store.deleteAudioImpl,
      }),
    ).resolves.toBe(true);

    expect(store.deleteAudioImpl).toHaveBeenCalledWith(
      "haru-stt-job/stale-remote",
    );
    expect(store.deleteAudioImpl).toHaveBeenCalledWith(
      "haru-stt-job/malformed-remote",
    );
    expect(localStorage.getItem(staleKey)).toBeNull();
    expect(localStorage.getItem(malformedKey)).toBeNull();
  });

  it("keeps a blocking fence when a live remote writer never settles", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T00:00:00.000Z"));
    const store = fakeAudioStore();
    const markerKey = intentStorageKey("memory-story", "hung-remote");
    store.blobs.set("haru-stt-job/hung-remote", audio());
    localStorage.setItem(
      markerKey,
      JSON.stringify({
        version: 1,
        token: "hung-tab",
        kind: "memory-story",
        objectKey: "haru-stt-job/hung-remote",
        state: "writing",
        startedAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
    );

    const deleting = clearSttJobsByTargetKind("memory-story", {
      deleteAudioImpl: store.deleteAudioImpl,
    });
    await vi.advanceTimersByTimeAsync(2_100);

    await expect(deleting).resolves.toBe(false);
    expect(localStorage.getItem(markerKey)).not.toBeNull();
    expect(localStorage.getItem(fenceStorageKey("memory-story"))).toContain(
      '"state":"blocked"',
    );
    expect(store.deleteAudioImpl).toHaveBeenCalledWith(
      "haru-stt-job/hung-remote",
    );
  });

  it("reports verified queue or audio deletion failure", async () => {
    const store = fakeAudioStore();
    await enqueueSttJob(
      audio(),
      { kind: "memory-story", memoryCardId: "blocked" },
      { createId: () => "blocked", storeAudioImpl: store.storeAudioImpl },
    );
    const originalRemoveItem = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (
      this: Storage,
      key,
    ) {
      if (key === STT_JOB_OUTBOX_STORAGE_KEY) return;
      originalRemoveItem.call(this, key);
    });

    await expect(
      clearSttJobQueue({
        deleteAudioImpl: vi.fn(async () => {
          throw new Error("indexeddb blocked");
        }),
      }),
    ).resolves.toBe(false);
    expect(localStorage.getItem(STT_JOB_OUTBOX_STORAGE_KEY)).not.toBeNull();
  });
});
