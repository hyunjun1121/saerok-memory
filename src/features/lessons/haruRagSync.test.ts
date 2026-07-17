import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getHaruAdminUsageRecord,
  startHaruAdminUsageSession,
  type HaruAdminQuestionRecord,
} from "@/features/lessons/haruAdminUsageRecordStorage";
import {
  authorizeHaruRagReenrollment,
  enqueueHaruRagUserDeletion,
  enqueueHaruRagRecord,
  flushHaruRagOutbox,
  getHaruRagDeletionOutbox,
  getHaruRagOutbox,
  getHaruRagSyncGeneration,
  HARU_RAG_SYNC_GENERATION_STORAGE_KEY,
  haruRagContentHash,
  startHaruRagSync,
} from "@/features/lessons/haruRagSync";
import { updateHaruConsent } from "@/features/profile/haruConsentStorage";

type FetchLike = typeof fetch;

function currentRecord() {
  startHaruAdminUsageSession(1, new Date("2026-07-20T01:00:00.000Z"));
  const record = getHaruAdminUsageRecord();
  if (!record) throw new Error("missing test admin record");
  return record;
}

function okFetch() {
  return vi.fn(async () => ({ ok: true, status: 200 })) as unknown as FetchLike;
}

function completeDeletionFetch() {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      complete: true,
      sqlite_deleted: true,
      neo4j_deleted: true,
      generation: 1,
    }),
  })) as unknown as FetchLike;
}

function addVoiceQuestion(record: ReturnType<typeof currentRecord>): void {
  record.sessions[0].question_records = [
    {
      presentation: {
        presented_at: "2026-07-20T01:00:00.000Z",
        screen_state: "question",
        character_message: null,
      },
      question: {
        question_id: "VOICE",
        order: 1,
        domain: "daily",
        response_type: "voice",
        prompt_text: "voice",
        prompt_audio_text: "voice",
        scored: false,
        choices: null,
        correct_answer: null,
        personalization_source_note: null,
        max_response_seconds: null,
      },
      response: null,
      system_feedback: null,
    },
  ];
  enqueueHaruRagRecord(record);
}

describe("Haru RAG sync outbox", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts canonical full JSON with idempotency headers and clears on success", async () => {
    vi.stubEnv("VITE_RAG_API_TOKEN", "local-secret");
    const record = currentRecord();
    const fetchImpl = okFetch();

    expect(getHaruRagOutbox()).toHaveLength(1);
    await flushHaruRagOutbox({ fetchImpl, force: true });

    expect(getHaruRagOutbox()).toHaveLength(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://127.0.0.1:8000/api/ingest/json");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
        "Idempotency-Key": `haru-${haruRagContentHash(record)}`,
        "X-Haru-Content-Hash": haruRagContentHash(record),
        Authorization: "Bearer local-secret",
      }),
    );
    expect(JSON.parse(String(init.body))).toEqual(record);
    expect(localStorage.getItem("haruRagSyncOutbox") ?? "").not.toContain("local-secret");
  });

  it("keeps an offline write and retries the same payload later", async () => {
    currentRecord();
    const offline = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as FetchLike;

    await flushHaruRagOutbox({ fetchImpl: offline, force: true, now: () => 1_000 });

    expect(getHaruRagOutbox()).toEqual([
      expect.objectContaining({ attempts: 1, nextAttemptAt: 3_000 }),
    ]);

    const online = okFetch();
    await flushHaruRagOutbox({ fetchImpl: online, force: true, now: () => 3_000 });
    expect(online).toHaveBeenCalledTimes(1);
    expect(getHaruRagOutbox()).toHaveLength(0);
  });

  it("coalesces newer snapshots per dataset/user and hashes canonical key order", () => {
    const first = currentRecord();
    const firstHash = getHaruRagOutbox()[0].contentHash;
    const next = structuredClone(first);
    next.dataset.generated_at = "2026-07-20T10:00:01+09:00";

    enqueueHaruRagRecord(next, new Date("2026-07-20T01:00:01.000Z"));

    expect(getHaruRagOutbox()).toHaveLength(1);
    expect(getHaruRagOutbox()[0]).toEqual(
      expect.objectContaining({
        contentHash: haruRagContentHash(next),
        attempts: 0,
      }),
    );
    expect(getHaruRagOutbox()[0].contentHash).not.toBe(firstHash);
    expect(JSON.parse(getHaruRagOutbox()[0].payload)).toEqual(next);
    expect(haruRagContentHash({ b: 2, a: 1 })).toBe(haruRagContentHash({ a: 1, b: 2 }));
  });

  it("drops queued data instead of sending after longitudinal consent is false", async () => {
    const record = currentRecord();
    const withdrawn = structuredClone(record);
    withdrawn.user.consents.longitudinal_usage_storage = false;

    enqueueHaruRagRecord(withdrawn);
    const fetchImpl = completeDeletionFetch();
    await flushHaruRagOutbox({ fetchImpl, force: true });

    expect(getHaruRagOutbox()).toHaveLength(0);
    expect(getHaruRagDeletionOutbox()).toHaveLength(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/users/USR-000001",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("queues a voice-free partial snapshot after voice or STT withdrawal", () => {
    const record = currentRecord();
    const question = (id: string, responseType: "voice" | "single_choice") =>
      ({
        presentation: {
          presented_at: "2026-07-20T01:00:00.000Z",
          screen_state: "question",
          character_message: null,
        },
        question: {
          question_id: id,
          order: 1,
          domain: "daily",
          response_type: responseType,
          prompt_text: id,
          prompt_audio_text: id,
          scored: false,
          choices: null,
          correct_answer: null,
          personalization_source_note: null,
          max_response_seconds: null,
        },
        response: null,
        system_feedback: null,
      }) satisfies HaruAdminQuestionRecord;
    record.sessions[0].question_records = [
      question("VOICE", "voice"),
      question("SAFE", "single_choice"),
    ];
    record.user.consents.stt_processing = false;

    expect(enqueueHaruRagRecord(record)).toBe(true);

    const payload = JSON.parse(getHaruRagOutbox()[0].payload) as typeof record;
    expect(payload.sessions[0].question_records.map((item) => item.question.question_id)).toEqual([
      "SAFE",
    ]);
    expect(record.sessions[0].question_records).toHaveLength(2);
  });

  it("re-sanitizes a stale queued voice payload immediately before POST", async () => {
    const record = currentRecord();
    addVoiceQuestion(record);
    expect(JSON.parse(getHaruRagOutbox()[0].payload).sessions[0].question_records).toHaveLength(
      1,
    );
    updateHaruConsent({ sttProcessing: false });
    const fetchImpl = okFetch();

    await flushHaruRagOutbox({ fetchImpl, force: true });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const posted = JSON.parse(String(init.body)) as typeof record;
    expect(posted.user.consents.stt_processing).toBe(false);
    expect(posted.sessions[0].question_records).toEqual([]);
    expect(init.headers).toEqual(
      expect.objectContaining({
        "Idempotency-Key": `haru-${haruRagContentHash(posted)}`,
        "X-Haru-Content-Hash": haruRagContentHash(posted),
      }),
    );
  });

  it("turns a stale queued payload into a deletion before any POST", async () => {
    currentRecord();
    updateHaruConsent({ longitudinalUsageStorage: false });
    const fetchImpl = completeDeletionFetch();

    await flushHaruRagOutbox({ fetchImpl, force: true });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://127.0.0.1:8000/api/users/USR-000001");
    expect(init.method).toBe("DELETE");
    expect(getHaruRagOutbox()).toEqual([]);
  });

  it("aborts an active stale POST and retries with current consent", async () => {
    const record = currentRecord();
    addVoiceQuestion(record);
    let firstSignal: AbortSignal | undefined;
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce((_url: string, init: RequestInit) => {
        firstSignal = init.signal as AbortSignal;
        return new Promise((resolve) => {
          firstSignal?.addEventListener(
            "abort",
            () => resolve({ ok: false, status: 0 }),
            { once: true },
          );
        });
      })
      .mockResolvedValue({ ok: true, status: 200 }) as unknown as FetchLike;
    const stop = startHaruRagSync({ fetchImpl });
    await vi.waitFor(() =>
      expect(fetchImpl as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1),
    );

    updateHaruConsent({ voiceRecording: false });

    await vi.waitFor(() => expect(firstSignal?.aborted).toBe(true));
    await vi.waitFor(() =>
      expect(fetchImpl as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(2),
    );
    const [, retryInit] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[1] as [
      string,
      RequestInit,
    ];
    const posted = JSON.parse(String(retryInit.body)) as typeof record;
    expect(posted.user.consents.voice_recording).toBe(false);
    expect(posted.sessions[0].question_records).toEqual([]);
    stop();
  });

  it("persists an offline deletion tombstone and never re-ingests that user first", async () => {
    const record = currentRecord();
    expect(enqueueHaruRagUserDeletion(record.user.user_id)).toBe(true);
    expect(getHaruRagOutbox()).toHaveLength(0);

    enqueueHaruRagRecord(record);
    expect(getHaruRagOutbox()).toHaveLength(0);

    const offline = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as FetchLike;
    await flushHaruRagOutbox({ fetchImpl: offline, force: true, now: () => 1_000 });

    expect(getHaruRagDeletionOutbox()).toEqual([
      expect.objectContaining({ userId: "USR-000001", attempts: 1, nextAttemptAt: 3_000 }),
    ]);
    expect(offline).toHaveBeenCalledTimes(1);

    const online = completeDeletionFetch();
    await flushHaruRagOutbox({ fetchImpl: online, force: true, now: () => 3_000 });
    expect(getHaruRagDeletionOutbox()).toHaveLength(0);
    const [url, init] = (online as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://127.0.0.1:8000/api/users/USR-000001");
    expect(init).toEqual(expect.objectContaining({ method: "DELETE" }));
    expect(getHaruRagSyncGeneration("USR-000001")).toEqual(
      expect.objectContaining({
        generation: 1,
        deletionConfirmed: true,
        reenrollmentAuthorized: false,
      }),
    );
  });

  it("requires explicit local re-enrollment and sends the server deletion generation", async () => {
    const record = currentRecord();
    enqueueHaruRagUserDeletion(record.user.user_id);
    await flushHaruRagOutbox({ fetchImpl: completeDeletionFetch(), force: true });

    expect(enqueueHaruRagRecord(record)).toBe(false);
    expect(getHaruRagOutbox()).toHaveLength(0);

    expect(authorizeHaruRagReenrollment(record.user.user_id)).toBe(true);
    expect(enqueueHaruRagRecord(record)).toBe(true);
    const reenroll = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ sync_generation: 1 }),
    })) as unknown as FetchLike;

    await flushHaruRagOutbox({ fetchImpl: reenroll, force: true });

    const [, reenrollInit] = (reenroll as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(reenrollInit.headers).toEqual(
      expect.objectContaining({
        "X-Haru-Sync-Generation": "1",
        "X-Haru-Reenroll": "true",
      }),
    );
    expect(getHaruRagOutbox()).toHaveLength(0);
    expect(getHaruRagSyncGeneration(record.user.user_id)).toEqual(
      expect.objectContaining({
        generation: 1,
        deletionConfirmed: false,
        reenrollmentAuthorized: false,
      }),
    );

    const next = structuredClone(record);
    next.dataset.generated_at = "2026-07-20T10:00:02+09:00";
    expect(enqueueHaruRagRecord(next)).toBe(true);
    const update = okFetch();
    await flushHaruRagOutbox({ fetchImpl: update, force: true });
    const [, updateInit] = (update as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(updateInit.headers).toEqual(
      expect.objectContaining({ "X-Haru-Sync-Generation": "1" }),
    );
    expect(updateInit.headers).not.toEqual(
      expect.objectContaining({ "X-Haru-Reenroll": "true" }),
    );
  });

  it("does not accept deletion completion without a valid generation", async () => {
    const record = currentRecord();
    enqueueHaruRagUserDeletion(record.user.user_id);
    const missingGeneration = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ complete: true }),
    })) as unknown as FetchLike;

    await flushHaruRagOutbox({ fetchImpl: missingGeneration, force: true, now: () => 1_000 });

    expect(getHaruRagDeletionOutbox()).toEqual([
      expect.objectContaining({ attempts: 1, nextAttemptAt: 3_000 }),
    ]);
    expect(getHaruRagSyncGeneration(record.user.user_id)).toEqual(
      expect.objectContaining({ deletionConfirmed: false }),
    );
  });

  it("keeps re-enrollment queued until the accepted generation is durable locally", async () => {
    const record = currentRecord();
    enqueueHaruRagUserDeletion(record.user.user_id);
    await flushHaruRagOutbox({ fetchImpl: completeDeletionFetch(), force: true });
    authorizeHaruRagReenrollment(record.user.user_id);
    enqueueHaruRagRecord(record);

    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === HARU_RAG_SYNC_GENERATION_STORAGE_KEY) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      originalSetItem.call(this, key, value);
    });
    const reenroll = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ sync_generation: 1 }),
    })) as unknown as FetchLike;

    await flushHaruRagOutbox({
      fetchImpl: reenroll,
      force: true,
      now: () => 1_000,
    });

    expect(getHaruRagOutbox()).toEqual([
      expect.objectContaining({ attempts: 1, nextAttemptAt: 3_000 }),
    ]);
    expect(getHaruRagSyncGeneration(record.user.user_id)).toEqual(
      expect.objectContaining({
        deletionConfirmed: true,
        reenrollmentAuthorized: true,
      }),
    );
  });

  it("keeps deletion queued until optional Neo4j cleanup is complete", async () => {
    const record = currentRecord();
    enqueueHaruRagUserDeletion(record.user.user_id);
    const incomplete = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ complete: false, sqlite_deleted: true, neo4j_deleted: false }),
    })) as unknown as FetchLike;

    await flushHaruRagOutbox({ fetchImpl: incomplete, force: true, now: () => 1_000 });

    expect(getHaruRagDeletionOutbox()).toEqual([
      expect.objectContaining({ userId: "USR-000001", attempts: 1, nextAttemptAt: 3_000 }),
    ]);
  });

  it("keeps deletion queued when a successful HTTP response omits completion proof", async () => {
    const record = currentRecord();
    enqueueHaruRagUserDeletion(record.user.user_id);
    const ambiguous = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as FetchLike;

    await flushHaruRagOutbox({ fetchImpl: ambiguous, force: true, now: () => 1_000 });

    expect(getHaruRagDeletionOutbox()).toEqual([
      expect.objectContaining({ userId: "USR-000001", attempts: 1, nextAttemptAt: 3_000 }),
    ]);
  });

  it("does not resurrect another dataset snapshot while consent withdrawal queues deletion", () => {
    const record = currentRecord();
    const otherDataset = structuredClone(record);
    otherDataset.dataset.dataset_id = "haru-demo-other-dataset";
    enqueueHaruRagRecord(otherDataset);
    expect(getHaruRagOutbox()).toHaveLength(2);

    const withdrawn = structuredClone(record);
    withdrawn.user.consents.longitudinal_usage_storage = false;
    expect(enqueueHaruRagRecord(withdrawn)).toBe(true);

    expect(getHaruRagOutbox()).toHaveLength(0);
    expect(getHaruRagDeletionOutbox()).toEqual([
      expect.objectContaining({ userId: "USR-000001" }),
    ]);
  });

  it("reports deletion enqueue failure when the full-payload outbox cannot be purged", () => {
    const record = currentRecord();
    const originalRemoveItem = Storage.prototype.removeItem;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (
      this: Storage,
      key,
    ) {
      if (key === "haruRagSyncOutbox") {
        throw new DOMException("blocked", "SecurityError");
      }
      originalRemoveItem.call(this, key);
    });

    expect(enqueueHaruRagUserDeletion(record.user.user_id)).toBe(false);
    expect(getHaruRagOutbox()).toHaveLength(1);
    expect(getHaruRagDeletionOutbox()).toHaveLength(1);
  });

  it("dead-letters permanent ingest errors instead of retrying forever", async () => {
    currentRecord();
    const unauthorized = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as FetchLike;

    await flushHaruRagOutbox({ fetchImpl: unauthorized, force: true });
    await flushHaruRagOutbox({ fetchImpl: unauthorized, force: true });

    expect(unauthorized).toHaveBeenCalledTimes(1);
    expect(getHaruRagOutbox()).toEqual([
      expect.objectContaining({ attempts: 1, blockedReason: "http-401" }),
    ]);
  });
});
