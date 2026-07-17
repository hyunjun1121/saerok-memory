import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HARU_DEMO_PERSONA,
  HARU_WEEK_QUESTION_META,
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
import type { TranscribeResult } from "@/features/speech/stt";

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
    expect(getHaruSttRetryOutbox()).toEqual([
      expect.objectContaining({
        userId: "USR-000001",
        sessionDate: "2026-07-20",
        questionId: "D1_Q5",
        objectKey: "voice/USR-000001/2026-07-20/D1_Q5.webm",
      }),
    ]);

    const serializedOutbox = JSON.parse(
      localStorage.getItem("haruSttRetryOutbox") ?? "[]",
    ) as Array<Record<string, unknown>>;
    expect(Object.keys(serializedOutbox[0]).sort()).toEqual(
      [
        "attempts",
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
});
