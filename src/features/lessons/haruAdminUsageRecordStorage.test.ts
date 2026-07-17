import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HARU_DEMO_PERSONA,
  HARU_WEEK_PLAN,
  HARU_WEEK_QUESTION_META,
  haru7DayExercises,
} from "@/data/haru7DayExercises";
import {
  HARU_ADMIN_USAGE_RECORD_STORAGE_KEY,
  abandonHaruAdminUsageSession,
  clearHaruAdminUsageRecords,
  completeHaruAdminUsageSession,
  getHaruAdminUsageRecord,
  presentHaruAdminQuestion,
  recordHaruAdminResponse,
  startHaruAdminUsageSession,
} from "@/features/lessons/haruAdminUsageRecordStorage";
import { getHaruRagDeletionOutbox } from "@/features/lessons/haruRagSync";
import { getHaruSttRetryOutbox } from "@/features/lessons/haruSttRetry";

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

function scenario(id: string) {
  const exercise = haru7DayExercises.find((candidate) => candidate.id === id);
  const question = HARU_WEEK_QUESTION_META.find(
    (candidate) => candidate.exerciseId === id,
  );
  if (!exercise || !question) throw new Error(`Missing scenario ${id}`);
  return { exercise, question };
}

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

async function answerDayOne(): Promise<void> {
  for (const question of HARU_WEEK_QUESTION_META.filter((candidate) => candidate.day === 1)) {
    const { exercise } = scenario(question.exerciseId);
    presentHaruAdminQuestion(1, exercise, "ko", { kind: "none" });
    if (question.responseType === "single_choice") {
      await recordHaruAdminResponse(1, exercise, "ko", {
        questionId: question.exerciseId,
        responseType: "single_choice",
        selectedOptionId: exercise.payload.options?.[0].id,
        responseTimeMs: 1_000,
        isCorrect: exercise.correctAnswer === exercise.payload.options?.[0].id,
        feedback: "응답 완료",
        inputMode: "touch",
      });
    } else if (question.responseType === "button_sequence") {
      const submittedSequence = exercise.payload.items?.slice(0, 3).map((item) => item.id);
      await recordHaruAdminResponse(1, exercise, "ko", {
        questionId: question.exerciseId,
        responseType: "button_sequence",
        submittedSequence,
        responseTimeMs: 2_000,
        isCorrect: true,
        feedback: "응답 완료",
      });
    } else {
      await recordHaruAdminResponse(1, exercise, "ko", {
        questionId: question.exerciseId,
        responseType: "voice",
        responseTimeMs: 3_000,
        isCorrect: null,
        feedback: "응답 완료",
        voiceDurationSeconds: 2,
        sttStatus: "failed",
      });
    }
  }
}

describe("haruAdminUsageRecordStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setConsent("voiceRecording", true);
    setConsent("sttProcessing", true);
    setConsent("longitudinalUsageStorage", true);
  });

  it("creates the JSON contract root, synthetic persona, device, and session", () => {
    const startedAt = new Date("2026-07-20T01:00:00.000Z");
    startHaruAdminUsageSession(1, startedAt);

    const record = getHaruAdminUsageRecord();
    expect(Object.keys(record ?? {})).toEqual([
      "schema",
      "dataset",
      "user",
      "device",
      "sessions",
    ]);
    expect(record).toEqual(
      expect.objectContaining({
        schema: expect.objectContaining({
          name: "haru_kiosk_usage_record",
          version: "1.0.0",
        }),
        dataset: expect.objectContaining({
          dataset_id: "HARU-DEMO-USER-001-WEEK-01",
          is_synthetic: true,
          period: { start: "2026-07-20", end: "2026-07-26" },
        }),
        user: expect.objectContaining({
          user_id: "USR-000001",
          display_name: "박영자",
          birth_year: 1952,
          age_at_period_start: 74,
          registered_profile_fields: expect.objectContaining({
            고향: "부산 영도",
            과거직업: "초등학교 급식 조리사",
            딸: "김민지",
          }),
          consents: expect.objectContaining({
            voice_recording: true,
            stt_processing: true,
            longitudinal_usage_storage: true,
          }),
        }),
        device: expect.objectContaining({
          button_layout: {
            A: { position: "왼쪽 위", color: "빨강" },
            B: { position: "오른쪽 위", color: "노랑" },
            C: { position: "왼쪽 아래", color: "초록" },
            D: { position: "오른쪽 아래", color: "파랑" },
          },
        }),
      }),
    );
    expect(record?.sessions[0]).toEqual(
      expect.objectContaining({
        session_id: "SES-20260720-USR000001",
        session_date: "2026-07-20",
        weekday: "월요일",
        completion_status: "in_progress",
        question_count: 6,
        question_records: [],
      }),
    );
  });

  it("stores the actual personalized question snapshot and JSON button mapping", () => {
    const base = scenario("D2_Q3").exercise;
    const personalized = {
      ...base,
      prompt: { ko: "어제 시장에서 산 가지는 무엇이었나요?", ja: "", en: "" },
      payload: {
        ...base.payload,
        audioText: { ko: "어제 시장에서 산 가지는 무엇이었나요?", ja: "", en: "" },
        options: base.payload.options?.map((option, index) =>
          index === 0 ? { ...option, label: { ko: "가지", ja: "", en: "" } } : option,
        ),
      },
    };

    const stored = presentHaruAdminQuestion(
      2,
      personalized,
      "ko",
      { kind: "prior_response", sourceQuestionIds: ["D1_Q5"] },
      new Date("2026-07-21T01:00:12.000Z"),
    );

    expect(stored?.question).toEqual(
      expect.objectContaining({
        question_id: "D2_Q3",
        prompt_text: "어제 시장에서 산 가지는 무엇이었나요?",
        prompt_audio_text: "어제 시장에서 산 가지는 무엇이었나요?",
        personalization_source_note: expect.stringContaining("1일차 음성 답변"),
        choices: [
          expect.objectContaining({ button: "A", color: "빨강", label: "가지" }),
          expect.objectContaining({ button: "B", color: "노랑" }),
          expect.objectContaining({ button: "C", color: "초록" }),
          expect.objectContaining({ button: "D", color: "파랑" }),
        ],
      }),
    );
  });

  it("records confirmed choice and sequence input events, not mere presentation", async () => {
    const single = scenario("D1_Q1").exercise;
    presentHaruAdminQuestion(1, single, "ko");
    expect(getHaruAdminUsageRecord()?.sessions[0].question_records[0].response).toBeNull();

    await recordHaruAdminResponse(1, single, "ko", {
      questionId: "D1_Q1",
      responseType: "single_choice",
      selectedOptionId: "B",
      responseTimeMs: 6_000,
      isCorrect: null,
      feedback: "오늘 기분을 알려주셔서 고마워요.",
      inputMode: "physical_button",
      buttonPressedAt: "2026-07-20T01:00:18.000Z",
      respondedAt: "2026-07-20T01:00:20.000Z",
    });

    const singleRecord = getHaruAdminUsageRecord()?.sessions[0].question_records[0];
    expect(singleRecord?.response).toEqual(
      expect.objectContaining({
        response_id: "RES-D1_Q1",
        input_mode: "physical_button",
        button_event: expect.objectContaining({
          button: "B",
          position: "오른쪽 위",
          color: "노랑",
        }),
        selected_choice: { button: "B", label: "좋음" },
        evaluation: { is_correct: null, score: null },
        is_valid: true,
      }),
    );

    const sequence = scenario("D1_Q6").exercise;
    presentHaruAdminQuestion(1, sequence, "ko");
    await recordHaruAdminResponse(1, sequence, "ko", {
      questionId: "D1_Q6",
      responseType: "button_sequence",
      submittedSequence: ["A", "B", "C"],
      responseTimeMs: 8_200,
      isCorrect: true,
      feedback: "세 단어를 순서대로 잘 기억하셨어요.",
      respondedAt: "2026-07-20T01:01:35.000Z",
      sequenceButtonEvents: [
        {
          optionId: "A",
          inputMode: "physical_button",
          pressedAt: "2026-07-20T01:01:31.000Z",
          elapsedMsFromQuestion: 4_000,
        },
        {
          optionId: "B",
          inputMode: "physical_button",
          pressedAt: "2026-07-20T01:01:32.000Z",
          elapsedMsFromQuestion: 5_400,
        },
        {
          optionId: "C",
          inputMode: "physical_button",
          pressedAt: "2026-07-20T01:01:34.000Z",
          elapsedMsFromQuestion: 6_800,
        },
      ],
    });

    const sequenceRecord = getHaruAdminUsageRecord()?.sessions[0].question_records.find(
      (record) => record.question.question_id === "D1_Q6",
    );
    expect(sequenceRecord?.response).toEqual(
      expect.objectContaining({
        input_mode: "physical_button_sequence",
        submitted_sequence: ["A", "B", "C"],
        submitted_labels: ["사과", "우산", "버스"],
        button_events: [
          expect.objectContaining({ sequence_index: 1, button: "A", elapsed_ms_from_question: 4_000 }),
          expect.objectContaining({ sequence_index: 2, button: "B", elapsed_ms_from_question: 5_400 }),
          expect.objectContaining({ sequence_index: 3, button: "C", elapsed_ms_from_question: 6_800 }),
        ],
      }),
    );
  });

  it("stores consented raw STT and actual audio metadata only in the admin record", async () => {
    const exercise = scenario("D1_Q5").exercise;
    const audioBlob = new Blob(["audio"], { type: "audio/webm;codecs=opus" });
    presentHaruAdminQuestion(1, exercise, "ko");
    await recordHaruAdminResponse(1, exercise, "ko", {
      questionId: "D1_Q5",
      responseType: "voice",
      responseTimeMs: 16_300,
      isCorrect: null,
      feedback: "시장에 다녀오셨군요.",
      recordingStartedAt: "2026-07-20T01:01:07.000Z",
      recordingEndedAt: "2026-07-20T01:01:20.000Z",
      respondedAt: "2026-07-20T01:01:22.000Z",
      voiceDurationSeconds: 13.3,
      audioBlob,
      audioSampleRateHz: 16_000,
      audioChannelCount: 1,
      sttStatus: "completed",
      sttNoSpeech: false,
      sttEngine: "qwen3-asr:Qwen/Qwen3-ASR-1.7B@a1b2c3d4",
      sttModel: "Qwen/Qwen3-ASR-1.7B",
      sttModelRevision: "a1b2c3d4",
      sttAlignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
      sttAlignerRevision: "aligner-revision",
      sttPreprocessingVersion: "haru-dc-hp80-rms-v1",
      sttSegments: [
        { id: 0, start: 0, end: 13.3, text: "유성시장에서 애호박과 대파를 샀어요." },
      ],
      sttLanguage: "ko-KR",
      sttConfidence: 0.91,
      sttProcessedAt: "2026-07-20T01:01:22.000Z",
      rawUserUtteranceTranscript: "유성시장에서 애호박과 대파를 샀어요.",
      derivedAnnotations: [
        { entityType: "장소", value: "유성시장" },
        { entityType: "구매물품", value: "애호박" },
      ],
    });

    const response = getHaruAdminUsageRecord()?.sessions[0].question_records[0].response;
    expect(response).toEqual(
      expect.objectContaining({
        input_mode: "voice",
        audio_duration_seconds: 13.3,
        audio_storage: {
          object_key: "voice/USR-000001/2026-07-20/D1_Q5.webm",
          mime_type: "audio/webm;codecs=opus",
          sample_rate_hz: 16_000,
          channels: 1,
          retention_status: "stored",
        },
        raw_user_utterance_transcript: "유성시장에서 애호박과 대파를 샀어요.",
        stt: expect.objectContaining({
          engine: "qwen3-asr:Qwen/Qwen3-ASR-1.7B@a1b2c3d4",
          status: "completed",
          no_speech: false,
          transcript: "유성시장에서 애호박과 대파를 샀어요.",
          model: "Qwen/Qwen3-ASR-1.7B",
          model_revision: "a1b2c3d4",
          aligner_model: "Qwen/Qwen3-ForcedAligner-0.6B",
          aligner_revision: "aligner-revision",
          preprocessing_version: "haru-dc-hp80-rms-v1",
          segments: [
            {
              id: 0,
              start: 0,
              end: 13.3,
              text: "유성시장에서 애호박과 대파를 샀어요.",
            },
          ],
        }),
        derived_annotations: expect.objectContaining({
          status: "completed",
          items: [
            { entity_type: "장소", value: "유성시장" },
            { entity_type: "구매물품", value: "애호박" },
          ],
        }),
      }),
    );
    expect(audioMocks.store).toHaveBeenCalledWith(
      "voice/USR-000001/2026-07-20/D1_Q5.webm",
      audioBlob,
      expect.any(String),
    );
    expect(localStorage.getItem("haruDemoSessions")).toBeNull();
  });

  it("stores explicit no-speech without filler transcript, segments, or facts", async () => {
    const exercise = scenario("D1_Q5").exercise;
    presentHaruAdminQuestion(1, exercise, "ko");
    await recordHaruAdminResponse(1, exercise, "ko", {
      questionId: "D1_Q5",
      responseType: "voice",
      responseTimeMs: 30_000,
      isCorrect: null,
      feedback: "응답 완료",
      voiceDurationSeconds: 30,
      audioBlob: new Blob(["silence"], { type: "audio/webm" }),
      audioSampleRateHz: 48_000,
      audioChannelCount: 1,
      sttStatus: "completed",
      sttNoSpeech: true,
      sttEngine: "qwen3-asr:Qwen/Qwen3-ASR-1.7B@revision",
      sttModel: "Qwen/Qwen3-ASR-1.7B",
      sttModelRevision: "revision",
      sttAlignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
      sttAlignerRevision: "aligner-revision",
      sttPreprocessingVersion: "haru-dc-hp80-rms-v1",
      sttSegments: [{ id: 0, start: 0, end: 0.2, text: "그러니까" }],
      rawUserUtteranceTranscript: "그러니까.",
      derivedAnnotations: [{ entityType: "허구", value: "저장 금지" }],
    });

    const response = getHaruAdminUsageRecord()?.sessions[0].question_records[0].response;
    expect(response).toEqual(
      expect.objectContaining({
        raw_user_utterance_transcript: null,
        audio_storage: expect.objectContaining({ sample_rate_hz: 48_000, channels: 1 }),
        stt: expect.objectContaining({
          status: "failed",
          no_speech: true,
          transcript: null,
          model_revision: "revision",
          aligner_revision: "aligner-revision",
          preprocessing_version: "haru-dc-hp80-rms-v1",
          segments: [],
        }),
        derived_annotations: expect.objectContaining({ status: "empty", items: [] }),
      }),
    );
    expect(JSON.stringify(response)).not.toContain("그러니까");
    expect(JSON.stringify(response)).not.toContain("저장 금지");
  });

  it("refuses completion before all six valid records and builds a null-safe summary", async () => {
    const first = scenario("D1_Q1").exercise;
    presentHaruAdminQuestion(1, first, "ko");
    await recordHaruAdminResponse(1, first, "ko", {
      questionId: "D1_Q1",
      responseType: "single_choice",
      selectedOptionId: "B",
      responseTimeMs: 1_000,
      isCorrect: null,
      feedback: "응답 완료",
    });
    expect(completeHaruAdminUsageSession(1, "완료")).toBeNull();
    expect(getHaruAdminUsageRecord()?.sessions[0].completion_status).toBe("in_progress");

    localStorage.clear();
    startHaruAdminUsageSession(1, new Date("2026-07-20T01:00:00.000Z"));
    await answerDayOne();
    const completed = completeHaruAdminUsageSession(
      1,
      "오늘 활동을 모두 마쳤어요.",
      new Date("2026-07-20T01:01:42.000Z"),
    );

    expect(completed).toEqual(
      expect.objectContaining({
        completion_status: "completed",
        question_count: 6,
        question_records: expect.arrayContaining([
          expect.objectContaining({ response: expect.objectContaining({ is_valid: true }) }),
        ]),
        session_summary: expect.objectContaining({
          duration_seconds: 102,
          scored_question_count: 4,
          clinical_interpretation: null,
          risk_classification: null,
        }),
      }),
    );
    expect(completed?.question_records).toHaveLength(6);
  });

  it("preserves partial raw records when an abandoned day resumes", async () => {
    const first = scenario("D1_Q1").exercise;
    presentHaruAdminQuestion(1, first, "ko");
    await recordHaruAdminResponse(1, first, "ko", {
      questionId: "D1_Q1",
      responseType: "single_choice",
      selectedOptionId: "B",
      responseTimeMs: 1_000,
      isCorrect: null,
      feedback: "응답 완료",
    });
    abandonHaruAdminUsageSession(1, new Date("2026-07-20T01:00:10.000Z"));

    const resumed = startHaruAdminUsageSession(
      1,
      new Date("2026-07-20T01:05:00.000Z"),
    );

    expect(resumed).toEqual(
      expect.objectContaining({
        completion_status: "in_progress",
        session_completed_at: null,
        question_records: [
          expect.objectContaining({
            question: expect.objectContaining({ question_id: "D1_Q1" }),
            response: expect.objectContaining({ is_valid: true }),
          }),
        ],
      }),
    );
    await answerDayOne();
    expect(completeHaruAdminUsageSession(1, "완료")?.completion_status).toBe(
      "completed",
    );
  });

  it("does not report completion when the completed admin record cannot persist", async () => {
    startHaruAdminUsageSession(1);
    await answerDayOne();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "QuotaExceededError");
    });

    try {
      expect(completeHaruAdminUsageSession(1, "완료")).toBeNull();
    } finally {
      setItem.mockRestore();
      consoleError.mockRestore();
    }

    expect(getHaruAdminUsageRecord()?.sessions[0]?.completion_status).toBe(
      "in_progress",
    );
  });

  it("removes a voice blob if the session is abandoned while storage is pending", async () => {
    let releaseStore: ((status: "stored") => void) | undefined;
    audioMocks.store.mockReturnValueOnce(
      new Promise<"stored">((resolve) => {
        releaseStore = resolve;
      }),
    );
    const exercise = scenario("D1_Q5").exercise;
    presentHaruAdminQuestion(1, exercise, "ko");
    const pendingWrite = recordHaruAdminResponse(1, exercise, "ko", {
      questionId: "D1_Q5",
      responseType: "voice",
      responseTimeMs: 5_000,
      isCorrect: null,
      feedback: "응답 완료",
      voiceDurationSeconds: 3,
      audioBlob: new Blob(["audio"], { type: "audio/webm" }),
      sttStatus: "failed",
    });
    await vi.waitFor(() => expect(audioMocks.store).toHaveBeenCalledTimes(1));
    abandonHaruAdminUsageSession(1);
    releaseStore?.("stored");

    expect(await pendingWrite).toBeNull();
    expect(audioMocks.delete).toHaveBeenCalledWith(
      "voice/USR-000001/2026-07-20/D1_Q5.webm",
    );
    expect(
      getHaruAdminUsageRecord()?.sessions[0].question_records[0].response,
    ).toBeNull();
  });

  it("clears raw metadata and IndexedDB audio together", async () => {
    startHaruAdminUsageSession(1);
    expect(localStorage.getItem(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY)).not.toBeNull();

    await clearHaruAdminUsageRecords();

    expect(localStorage.getItem(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY)).toBeNull();
    expect(audioMocks.clear).toHaveBeenCalledTimes(1);
    expect(getHaruSttRetryOutbox()).toHaveLength(0);
    expect(getHaruRagDeletionOutbox()).toEqual([
      expect.objectContaining({ userId: "USR-000001" }),
    ]);
  });

  it("keeps raw metadata when IndexedDB audio deletion is blocked", async () => {
    startHaruAdminUsageSession(1);
    audioMocks.clear.mockRejectedValueOnce(new Error("indexeddb-delete-database-blocked"));

    await expect(clearHaruAdminUsageRecords()).rejects.toThrow(
      "indexeddb-delete-database-blocked",
    );
    expect(getHaruAdminUsageRecord()).not.toBeNull();
  });

  it("does not create raw records after longitudinal storage consent is withdrawn", () => {
    setConsent("longitudinalUsageStorage", false);

    expect(startHaruAdminUsageSession(1)).toBeNull();
    expect(localStorage.getItem(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY)).toBeNull();
  });

  it("keeps transcript and STT text out when STT processing is not consented", async () => {
    setConsent("sttProcessing", false);
    const exercise = scenario("D1_Q5").exercise;
    presentHaruAdminQuestion(1, exercise, "ko");
    await recordHaruAdminResponse(1, exercise, "ko", {
      questionId: "D1_Q5",
      responseType: "voice",
      responseTimeMs: 5_000,
      isCorrect: null,
      feedback: "응답 완료",
      voiceDurationSeconds: 3,
      audioBlob: new Blob(["audio"], { type: "audio/webm" }),
      sttStatus: "completed",
      rawUserUtteranceTranscript: "저장하면 안 되는 원문",
      derivedAnnotations: [{ entityType: "인물", value: "저장하면 안 되는 이름" }],
    });

    const serialized = localStorage.getItem(HARU_ADMIN_USAGE_RECORD_STORAGE_KEY) ?? "";
    expect(serialized).not.toContain("저장하면 안 되는 원문");
    expect(serialized).not.toContain("저장하면 안 되는 이름");
    const response = getHaruAdminUsageRecord()?.sessions[0].question_records[0].response;
    expect(response).toEqual(
      expect.objectContaining({
        raw_user_utterance_transcript: null,
        stt: expect.objectContaining({ transcript: null }),
        derived_annotations: expect.objectContaining({ status: "empty", items: [] }),
      }),
    );
  });

  it("ignores malformed storage without throwing", () => {
    localStorage.setItem(
      HARU_ADMIN_USAGE_RECORD_STORAGE_KEY,
      JSON.stringify({ schema: { name: "haru_kiosk_usage_record", version: "1.0.0" } }),
    );
    expect(getHaruAdminUsageRecord()).toBeNull();
    expect(() => startHaruAdminUsageSession(1)).not.toThrow();
    expect(getHaruAdminUsageRecord()?.sessions).toHaveLength(1);
  });

  it("matches the canonical seven-day question count contract", () => {
    expect(HARU_WEEK_PLAN).toHaveLength(7);
    expect(HARU_WEEK_PLAN.every((plan) => plan.exerciseIds.length === 6)).toBe(true);
    expect(HARU_WEEK_QUESTION_META).toHaveLength(42);
    expect(HARU_DEMO_PERSONA.isSynthetic).toBe(true);
  });
});
