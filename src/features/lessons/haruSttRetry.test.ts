import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HARU_DEMO_PERSONA,
  HARU_WEEK_QUESTION_META,
  getHaruWeekPlan,
  haru7DayExercises,
} from "@/data/haru7DayExercises";
import {
  HARU_ADMIN_USAGE_RECORD_STORAGE_KEY,
  clearHaruAdminUsageRecords,
  getHaruAdminUsageRecord,
  patchHaruAdminVoiceSttSuccess,
  presentHaruAdminQuestion,
  recordHaruAdminResponse,
} from "@/features/lessons/haruAdminUsageRecordStorage";
import {
  clearHaruRagOutbox,
  getHaruRagOutbox,
} from "@/features/lessons/haruRagSync";
import {
  flushHaruSttRetryOutbox,
  getHaruSttRetryOutbox,
  startHaruSttRetry,
} from "@/features/lessons/haruSttRetry";
import {
  completeHaruDemoSession,
  getHaruDemoSessions,
  recordHaruDemoResponse,
  startHaruDemoSession,
} from "@/features/lessons/haruDemoSessionStorage";
import { resolveHaruExercise } from "@/features/lessons/haruLivePersonalization";
import { canonicalHaruResponse } from "@/test/haruDemoSessionFixtures";
import type { TranscribeResult } from "@/features/speech/stt";
import { updateHaruConsent } from "@/features/profile/haruConsentStorage";

const audioMocks = vi.hoisted(() => ({
  store: vi.fn(async () => "stored" as const),
  read: vi.fn(async () => null as Blob | null),
  delete: vi.fn(async () => undefined),
  clear: vi.fn(async () => undefined),
}));

vi.mock("@/features/lessons/haruAdminAudioStorage", () => ({
  storeHaruAdminAudio: audioMocks.store,
  readHaruAdminAudio: audioMocks.read,
  deleteHaruAdminAudio: audioMocks.delete,
  clearHaruAdminAudioStorage: audioMocks.clear,
}));

function setConsent(
  key: "voiceRecording" | "sttProcessing" | "longitudinalUsageStorage",
  value: boolean,
): void {
  Object.defineProperty(HARU_DEMO_PERSONA.consents, key, {
    configurable: true,
    writable: true,
    value,
  });
}

function voiceScenario() {
  const exercise = haru7DayExercises.find((candidate) => candidate.id === "D1_Q5");
  const question = HARU_WEEK_QUESTION_META.find(
    (candidate) => candidate.exerciseId === "D1_Q5",
  );
  if (!exercise || !question) throw new Error("missing D1_Q5 scenario");
  return { exercise, question };
}

async function saveFailedVoice(options: { noSpeech?: boolean } = {}): Promise<Blob> {
  const { exercise } = voiceScenario();
  const audio = new Blob(["voice-bytes"], { type: "audio/webm;codecs=opus" });
  presentHaruAdminQuestion(1, exercise, "ko");
  await recordHaruAdminResponse(1, exercise, "ko", {
    questionId: exercise.id,
    responseType: "voice",
    responseTimeMs: 4_500,
    isCorrect: null,
    feedback: "응답 완료",
    voiceDurationSeconds: 3.2,
    audioBlob: audio,
    sttStatus: "failed",
    sttNoSpeech: options.noSpeech,
  });
  return audio;
}

function qwenSuccess(): TranscribeResult {
  return {
    text: "유성시장에서 애호박과 대파를 샀어요.",
    noSpeech: false,
    language: "ko-KR",
    durationSec: 3.2,
    confidence: null,
    engine: "qwen3-asr",
    model: "Qwen/Qwen3-ASR-1.7B",
    modelRevision: "qwen-revision",
    alignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
    alignerRevision: "aligner-revision",
    preprocessingVersion: "ffmpeg-16k-mono-v1",
    segments: [
      {
        id: 0,
        start: 0,
        end: 3.2,
        text: "유성시장에서 애호박과 대파를 샀어요.",
      },
    ],
  };
}

describe("durable Haru STT retry", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setConsent("voiceRecording", true);
    setConsent("sttProcessing", true);
    setConsent("longitudinalUsageStorage", true);
  });

  it("survives failure and patches the same response with full Qwen provenance on restart", async () => {
    const audio = await saveFailedVoice();
    const before = getHaruAdminUsageRecord()?.sessions[0].question_records[0].response;
    expect(before?.input_mode).toBe("voice");
    const responseId = before?.response_id;
    const objectKey = before?.input_mode === "voice"
      ? before.audio_storage.object_key
      : "";
    expect(objectKey).toMatch(
      /^voice\/USR-000001\/2026-07-20\/g-\d+-\d+\/D1_Q5-[A-Za-z0-9-]+\.webm$/,
    );
    expect(getHaruSttRetryOutbox()).toEqual([
      expect.objectContaining({
        userId: "USR-000001",
        sessionDate: "2026-07-20",
        questionId: "D1_Q5",
        objectKey,
      }),
    ]);

    const serializedOutbox = JSON.parse(
      localStorage.getItem("haruSttRetryOutbox") ?? "[]",
    ) as Array<Record<string, unknown>>;
    expect(Object.keys(serializedOutbox[0]).sort()).toEqual(
      [
        "attempts",
        "consentRevision",
        "createdAt",
        "key",
        "nextAttemptAt",
        "objectKey",
        "questionId",
        "sessionDate",
        "updatedAt",
        "userId",
      ].sort(),
    );

    await flushHaruSttRetryOutbox({
      patchResponse: patchHaruAdminVoiceSttSuccess,
      readAudioImpl: async () => audio,
      transcribeImpl: async () => null,
      now: () => 1_000,
      force: true,
    });
    expect(getHaruSttRetryOutbox()).toEqual([
      expect.objectContaining({ attempts: 1, nextAttemptAt: 3_000 }),
    ]);

    clearHaruRagOutbox();
    const stop = startHaruSttRetry(patchHaruAdminVoiceSttSuccess, {
      readAudioImpl: async () => audio,
      transcribeImpl: async () => qwenSuccess(),
      now: () => 4_000,
    });
    await vi.waitFor(() => expect(getHaruSttRetryOutbox()).toHaveLength(0));
    stop();

    const after = getHaruAdminUsageRecord()?.sessions[0].question_records[0].response;
    expect(after).toEqual(
      expect.objectContaining({
        response_id: responseId,
        input_mode: "voice",
        raw_user_utterance_transcript: "유성시장에서 애호박과 대파를 샀어요.",
        stt: expect.objectContaining({
          status: "completed",
          no_speech: false,
          engine: "qwen3-asr:Qwen/Qwen3-ASR-1.7B@qwen-revision",
          model: "Qwen/Qwen3-ASR-1.7B",
          model_revision: "qwen-revision",
          aligner_model: "Qwen/Qwen3-ForcedAligner-0.6B",
          aligner_revision: "aligner-revision",
          preprocessing_version: "ffmpeg-16k-mono-v1",
          segments: [
            expect.objectContaining({ id: 0, start: 0, end: 3.2 }),
          ],
        }),
        derived_annotations: expect.objectContaining({
          status: "completed",
          items: expect.arrayContaining([
            { entity_type: "장소", value: "유성시장" },
            { entity_type: "구매물품", value: "애호박" },
          ]),
        }),
      }),
    );
    expect(getHaruRagOutbox()).toHaveLength(1);
    expect(JSON.parse(getHaruRagOutbox()[0].payload)).toEqual(
      getHaruAdminUsageRecord(),
    );
  });

  it("projects successful canonical STT facts into the existing safe demo response", async () => {
    const audio = await saveFailedVoice();
    startHaruDemoSession(1, getHaruWeekPlan(1).exerciseIds);
    HARU_WEEK_QUESTION_META.filter((question) => question.day === 1).forEach(
      (question) =>
        recordHaruDemoResponse(
          1,
          question.exerciseId === "D1_Q5"
            ? {
                questionId: "D1_Q5",
                responseType: "voice",
                responseTimeMs: 4_500,
                isCorrect: null,
                voiceDurationSeconds: 3.2,
                sttStatus: "failed",
                recognitionError: "stt-pending",
              }
            : canonicalHaruResponse(question),
        ),
    );

    await flushHaruSttRetryOutbox({
      patchResponse: patchHaruAdminVoiceSttSuccess,
      readAudioImpl: async () => audio,
      transcribeImpl: async () => qwenSuccess(),
      force: true,
    });

    const response = getHaruDemoSessions()[0].responses.find(
      (candidate) => candidate.questionId === "D1_Q5",
    );
    expect(response).toEqual(
      expect.objectContaining({
        sttStatus: "completed",
        sttModel: "Qwen/Qwen3-ASR-1.7B",
        sttModelRevision: "qwen-revision",
        derivedAnnotations: expect.arrayContaining([
          { entityType: "장소", value: "유성시장" },
          { entityType: "구매물품", value: "애호박" },
        ]),
      }),
    );
    expect(JSON.stringify(response)).not.toContain("유성시장에서 애호박과 대파를 샀어요");
    expect(completeHaruDemoSession(1, "완료")?.status).toBe("completed");
    const nextExercise = haru7DayExercises.find(
      (candidate) => candidate.id === "D2_Q3",
    );
    expect(nextExercise).toBeDefined();
    expect(
      resolveHaruExercise(nextExercise!, getHaruDemoSessions()).personalization,
    ).toEqual({
      kind: "prior_response",
      sourceQuestionIds: ["D1_Q5"],
    });
  });

  it("drops a retry entry when its IndexedDB audio is missing", async () => {
    await saveFailedVoice();
    const transcribeImpl = vi.fn(async () => qwenSuccess());

    await flushHaruSttRetryOutbox({
      patchResponse: patchHaruAdminVoiceSttSuccess,
      readAudioImpl: async () => null,
      transcribeImpl,
      force: true,
    });

    expect(getHaruSttRetryOutbox()).toHaveLength(0);
    expect(transcribeImpl).not.toHaveBeenCalled();
  });

  it("patches an explicit Qwen no-speech result before removing its retry", async () => {
    const audio = await saveFailedVoice();
    const patchResponse = vi.fn(patchHaruAdminVoiceSttSuccess);

    await flushHaruSttRetryOutbox({
      patchResponse,
      readAudioImpl: async () => audio,
      transcribeImpl: async () => ({
        ...qwenSuccess(),
        text: "그러니까.",
        noSpeech: true,
      }),
      force: true,
    });

    expect(getHaruSttRetryOutbox()).toHaveLength(0);
    expect(patchResponse).toHaveBeenCalledTimes(1);
    const response = getHaruAdminUsageRecord()?.sessions[0].question_records[0]
      .response;
    expect(response).toEqual(
      expect.objectContaining({
        input_mode: "voice",
        raw_user_utterance_transcript: null,
        stt: expect.objectContaining({
          status: "failed",
          no_speech: true,
          transcript: null,
          engine: "qwen3-asr:Qwen/Qwen3-ASR-1.7B@qwen-revision",
          model: "Qwen/Qwen3-ASR-1.7B",
          model_revision: "qwen-revision",
          aligner_model: "Qwen/Qwen3-ForcedAligner-0.6B",
          aligner_revision: "aligner-revision",
          preprocessing_version: "ffmpeg-16k-mono-v1",
          segments: [],
        }),
        derived_annotations: expect.objectContaining({
          status: "empty",
          items: [],
        }),
      }),
    );
  });

  it("removes stale retries and backs off only retryable patches", async () => {
    const audio = await saveFailedVoice();
    const stalePatch = vi.fn(async () => "stale" as const);

    await flushHaruSttRetryOutbox({
      patchResponse: stalePatch,
      readAudioImpl: async () => audio,
      transcribeImpl: async () => qwenSuccess(),
      force: true,
    });
    expect(stalePatch).toHaveBeenCalledTimes(1);
    expect(getHaruSttRetryOutbox()).toHaveLength(0);

    localStorage.clear();
    await saveFailedVoice();
    const retryPatch = vi.fn(async () => "retry" as const);
    await flushHaruSttRetryOutbox({
      patchResponse: retryPatch,
      readAudioImpl: async () => audio,
      transcribeImpl: async () => qwenSuccess(),
      now: () => 10_000,
      force: true,
    });

    expect(retryPatch).toHaveBeenCalledTimes(1);
    expect(getHaruSttRetryOutbox()).toEqual([
      expect.objectContaining({ attempts: 1, nextAttemptAt: 12_000 }),
    ]);
  });

  it("does not enqueue explicit no-speech audio and clears retries on activity deletion", async () => {
    await saveFailedVoice({ noSpeech: true });
    expect(getHaruSttRetryOutbox()).toHaveLength(0);

    localStorage.clear();
    await saveFailedVoice();
    expect(getHaruSttRetryOutbox()).toHaveLength(1);
    await clearHaruAdminUsageRecords();

    expect(getHaruSttRetryOutbox()).toHaveLength(0);
    expect(localStorage.getItem(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY)).toBeNull();
    expect(audioMocks.clear).toHaveBeenCalledTimes(1);
  });

  it("purges queued work without sending audio after runtime consent withdrawal", async () => {
    const audio = await saveFailedVoice();
    updateHaruConsent({ sttProcessing: false });
    const transcribeImpl = vi.fn(async () => qwenSuccess());

    await flushHaruSttRetryOutbox({
      patchResponse: patchHaruAdminVoiceSttSuccess,
      readAudioImpl: async () => audio,
      transcribeImpl,
      force: true,
    });

    expect(transcribeImpl).not.toHaveBeenCalled();
    expect(getHaruSttRetryOutbox()).toHaveLength(0);
  });

  it("aborts active Qwen work when another tab withdraws consent", async () => {
    const audio = await saveFailedVoice();
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
    const patchResponse = vi.fn(patchHaruAdminVoiceSttSuccess);
    const stop = startHaruSttRetry(patchResponse, {
      readAudioImpl: async () => audio,
      transcribeImpl,
    });
    await vi.waitFor(() => expect(transcribeImpl).toHaveBeenCalledTimes(1));

    updateHaruConsent({ voiceRecording: false });

    await vi.waitFor(() => expect(observedSignal?.aborted).toBe(true));
    await vi.waitFor(() => expect(getHaruSttRetryOutbox()).toHaveLength(0));
    expect(patchResponse).not.toHaveBeenCalled();
    stop();
  });

  it("never patches an old transcription after withdrawal and quick re-consent", async () => {
    const audio = await saveFailedVoice();
    let finishTranscription: ((result: TranscribeResult) => void) | undefined;
    const transcribeImpl = vi.fn(
      () =>
        new Promise<TranscribeResult>((resolve) => {
          finishTranscription = resolve;
        }),
    );
    const patchResponse = vi.fn(patchHaruAdminVoiceSttSuccess);
    const stop = startHaruSttRetry(patchResponse, {
      readAudioImpl: async () => audio,
      transcribeImpl,
    });
    await vi.waitFor(() => expect(transcribeImpl).toHaveBeenCalledTimes(1));

    updateHaruConsent(
      { voiceRecording: false },
      new Date("2026-07-20T01:00:01.000Z"),
    );
    updateHaruConsent(
      { voiceRecording: true },
      new Date("2026-07-20T01:00:02.000Z"),
    );
    finishTranscription?.(qwenSuccess());

    await vi.waitFor(() => expect(getHaruSttRetryOutbox()).toHaveLength(0));
    await Promise.resolve();
    expect(patchResponse).not.toHaveBeenCalled();
    stop();
  });
});
