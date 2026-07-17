import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HARU_WEEK_QUESTION_META,
  getHaruWeekPlan,
} from "@/data/haru7DayExercises";
import {
  HARU_DEMO_SESSION_UPDATED_EVENT,
  HARU_DEMO_SESSION_STORAGE_KEY,
  abandonHaruDemoSession,
  clearHaruDemoSessions,
  completeHaruDemoSession,
  getHaruDemoSessions,
  patchHaruDemoVoiceResponse,
  recordHaruDemoResponse,
  scrubHaruDemoVoiceData,
  startHaruDemoSession,
  type HaruDemoResponse,
} from "@/features/lessons/haruDemoSessionStorage";
import { HARU_CONSENT_STORAGE_KEY } from "@/features/profile/haruConsentStorage";
import {
  canonicalHaruResponse,
  seedCompletedHaruDemoDay,
} from "@/test/haruDemoSessionFixtures";

describe("haruDemoSessionStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    getHaruDemoSessions();
  });

  function setLongitudinalConsent(enabled: boolean): void {
    localStorage.setItem(
      HARU_CONSENT_STORAGE_KEY,
      JSON.stringify({
        voiceRecording: true,
        sttProcessing: true,
        longitudinalUsageStorage: enabled,
        personalizedQuestionUse: true,
        consentedAt: "2026-07-18T00:00:00.000Z",
        updatedAt: "2026-07-18T00:00:00.000Z",
      }),
    );
  }

  it("records a complete synthetic-day lifecycle", () => {
    const startedAt = new Date("2026-07-20T01:00:00.000Z");
    const endedAt = new Date("2026-07-20T01:01:42.000Z");

    const questionIds = getHaruWeekPlan(1).exerciseIds;
    expect(startHaruDemoSession(1, questionIds, startedAt)).toEqual(
      expect.objectContaining({
        day: 1,
        status: "in_progress",
        questionCount: 6,
        startedAt: startedAt.toISOString(),
        endedAt: null,
        durationSeconds: null,
      }),
    );

    HARU_WEEK_QUESTION_META.filter((question) => question.day === 1).forEach(
      (question) => recordHaruDemoResponse(1, canonicalHaruResponse(question)),
    );

    const completed = completeHaruDemoSession(
      1,
      "오늘 활동을 모두 마쳤어요.",
      endedAt,
    );

    expect(completed).toEqual(
      expect.objectContaining({
        status: "completed",
        endedAt: endedAt.toISOString(),
        durationSeconds: 102,
        completionMessage: "오늘 활동을 모두 마쳤어요.",
        questionCount: 6,
      }),
    );
    expect(completed?.responses).toHaveLength(6);
    expect(completed?.responses.slice(0, 2)).toEqual([
      {
        questionId: "D1_Q1",
        responseType: "single_choice",
        selectedOptionId: "B",
        responseTimeMs: 6_000,
        isCorrect: null,
      },
      {
        questionId: "D1_Q2",
        responseType: "single_choice",
        selectedOptionId: "A",
        responseTimeMs: 7_000,
        isCorrect: true,
      },
    ]);
    expect(getHaruDemoSessions()).toEqual([completed]);
  });

  it("keeps a day in progress until every expected question has a valid response", () => {
    const questions = HARU_WEEK_QUESTION_META.filter((question) => question.day === 1);
    startHaruDemoSession(1, getHaruWeekPlan(1).exerciseIds);
    questions.slice(0, -1).forEach((question) =>
      recordHaruDemoResponse(1, canonicalHaruResponse(question)),
    );

    expect(completeHaruDemoSession(1, "완료")).toEqual(
      expect.objectContaining({
        status: "in_progress",
        endedAt: null,
        durationSeconds: null,
        completionMessage: null,
      }),
    );
    expect(getHaruDemoSessions()[0].status).toBe("in_progress");

    recordHaruDemoResponse(1, canonicalHaruResponse(questions.at(-1)!));
    expect(completeHaruDemoSession(1, "완료")?.status).toBe("completed");
  });

  it("does not complete a fully answered subset of a canonical day", () => {
    const subset = HARU_WEEK_QUESTION_META.filter(
      (question) => question.day === 1,
    ).slice(0, 2);
    startHaruDemoSession(
      1,
      subset.map((question) => question.exerciseId),
    );
    subset.forEach((question) =>
      recordHaruDemoResponse(1, canonicalHaruResponse(question)),
    );

    expect(completeHaruDemoSession(1, "완료")).toEqual(
      expect.objectContaining({ status: "in_progress" }),
    );
  });

  it("does not complete a canonical day when question order differs", () => {
    const questions = HARU_WEEK_QUESTION_META.filter((question) => question.day === 1);
    startHaruDemoSession(
      1,
      questions.map((question) => question.exerciseId).reverse(),
    );
    questions.forEach((question) =>
      recordHaruDemoResponse(1, canonicalHaruResponse(question)),
    );

    expect(completeHaruDemoSession(1, "완료")).toEqual(
      expect.objectContaining({ status: "in_progress" }),
    );
  });

  it.each([
    ["an empty expected-question list", [], []],
    [
      "a missing response",
      ["D1_Q1", "D1_Q2"],
      [
        {
          questionId: "D1_Q1",
          responseType: "single_choice",
          selectedOptionId: "B",
          responseTimeMs: 6_000,
          isCorrect: null,
        },
      ],
    ],
    [
      "duplicate responses",
      ["D1_Q1"],
      [
        {
          questionId: "D1_Q1",
          responseType: "single_choice",
          selectedOptionId: "B",
          responseTimeMs: 6_000,
          isCorrect: null,
        },
        {
          questionId: "D1_Q1",
          responseType: "single_choice",
          selectedOptionId: "A",
          responseTimeMs: 7_000,
          isCorrect: null,
        },
      ],
    ],
    [
      "an unknown response",
      ["D1_Q1"],
      [
        {
          questionId: "D1_Q1",
          responseType: "single_choice",
          selectedOptionId: "B",
          responseTimeMs: 6_000,
          isCorrect: null,
        },
        {
          questionId: "UNKNOWN_Q1",
          responseType: "single_choice",
          selectedOptionId: "A",
          responseTimeMs: 7_000,
          isCorrect: null,
        },
      ],
    ],
    [
      "an invalid response",
      ["D1_Q1"],
      [
        {
          questionId: "D1_Q1",
          responseType: "single_choice",
          selectedOptionId: "B",
          responseTimeMs: -1,
          isCorrect: null,
        },
      ],
    ],
    [
      "an unknown expected question",
      ["UNKNOWN_Q1"],
      [
        {
          questionId: "UNKNOWN_Q1",
          responseType: "single_choice",
          selectedOptionId: "B",
          responseTimeMs: 6_000,
          isCorrect: null,
        },
      ],
    ],
    [
      "duplicate expected questions",
      ["D1_Q1", "D1_Q1"],
      [
        {
          questionId: "D1_Q1",
          responseType: "single_choice",
          selectedOptionId: "B",
          responseTimeMs: 6_000,
          isCorrect: null,
        },
      ],
    ],
    [
      "a response type that does not match the question",
      ["D1_Q1"],
      [
        {
          questionId: "D1_Q1",
          responseType: "voice",
          responseTimeMs: 6_000,
          isCorrect: null,
          voiceDurationSeconds: 4,
          sttStatus: "completed",
        },
      ],
    ],
  ])("downgrades injected completed data with %s", (_label, questionIds, responses) => {
    localStorage.setItem(
      HARU_DEMO_SESSION_STORAGE_KEY,
      JSON.stringify([
        {
          day: 1,
          status: "completed",
          questionIds,
          questionCount: questionIds.length,
          startedAt: "2026-07-20T01:00:00.000Z",
          endedAt: "2026-07-20T01:01:42.000Z",
          durationSeconds: 102,
          completionMessage: "완료",
          responses,
        },
      ]),
    );

    expect(getHaruDemoSessions()[0]).toEqual(
      expect.objectContaining({
        status: "in_progress",
        endedAt: null,
        durationSeconds: null,
        completionMessage: null,
      }),
    );
  });

  it("clears saved sessions and emits the update event", () => {
    const listener = vi.fn();
    window.addEventListener(HARU_DEMO_SESSION_UPDATED_EVENT, listener);
    startHaruDemoSession(1, ["D1_Q1"]);
    listener.mockClear();

    expect(clearHaruDemoSessions()).toBe(true);

    expect(localStorage.getItem(HARU_DEMO_SESSION_STORAGE_KEY)).toBeNull();
    expect(getHaruDemoSessions()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(HARU_DEMO_SESSION_UPDATED_EVENT, listener);
  });

  it("uses volatile sessions only and purges old persistence without longitudinal consent", () => {
    localStorage.setItem(
      HARU_DEMO_SESSION_STORAGE_KEY,
      JSON.stringify([
        {
          day: 1,
          status: "in_progress",
          questionIds: ["D1_Q1"],
          questionCount: 1,
          startedAt: "2026-07-18T00:00:00.000Z",
          endedAt: null,
          durationSeconds: null,
          completionMessage: null,
          responses: [],
        },
      ]),
    );
    setLongitudinalConsent(false);

    expect(getHaruDemoSessions()).toEqual([]);
    expect(localStorage.getItem(HARU_DEMO_SESSION_STORAGE_KEY)).toBeNull();
    expect(startHaruDemoSession(2, ["D2_Q1"]).day).toBe(2);
    expect(getHaruDemoSessions()).toEqual([
      expect.objectContaining({ day: 2, status: "in_progress" }),
    ]);
    expect(localStorage.getItem(HARU_DEMO_SESSION_STORAGE_KEY)).toBeNull();

    setLongitudinalConsent(true);
    expect(getHaruDemoSessions()).toEqual([]);
    expect(localStorage.getItem(HARU_DEMO_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("scrubs voice-derived response data without changing session completion", () => {
    const completed = seedCompletedHaruDemoDay(1, {
      responseOverrides: {
        D1_Q5: {
          sttStatus: "completed",
          sttLanguage: "ko-KR",
          sttConfidence: 0.92,
          sttEngine: "qwen3-asr",
          sttModel: "Qwen/Qwen3-ASR-1.7B",
          sttModelRevision: "model-revision",
          sttAlignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
          sttAlignerRevision: "aligner-revision",
          sttPreprocessingVersion: "haru-audio-v1",
          recognitionError: "none",
          derivedAnnotations: [{ entityType: "장소", value: "비밀 산책로" }],
        },
      },
    });
    expect(completed?.status).toBe("completed");

    expect(scrubHaruDemoVoiceData()).toBe(true);

    const session = getHaruDemoSessions()[0];
    const voice = session.responses.find((response) => response.questionId === "D1_Q5");
    expect(session.status).toBe("completed");
    expect(session.endedAt).toBe(completed?.endedAt);
    expect(voice).toEqual({
      questionId: "D1_Q5",
      responseType: "voice",
      responseTimeMs: expect.any(Number),
      isCorrect: null,
      voiceDurationSeconds: expect.any(Number),
      voiceDataScrubbed: true,
    });
    expect(localStorage.getItem(HARU_DEMO_SESSION_STORAGE_KEY)).not.toMatch(
      /비밀 산책로|qwen3-asr|Qwen3-ASR|sttStatus|sttLanguage|sttConfidence|sttEngine|sttModel|sttAligner|sttPreprocessing|recognitionError|derivedAnnotations/,
    );
  });

  it("returns false when clearing persisted sessions cannot be verified", () => {
    startHaruDemoSession(1, ["D1_Q1"]);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(clearHaruDemoSessions()).toBe(false);
  });

  it("keeps one response per question and replaces the earlier record", () => {
    startHaruDemoSession(4, ["D4_Q5"]);
    recordHaruDemoResponse(4, {
      questionId: "D4_Q5",
      responseType: "voice",
      responseTimeMs: 10_000,
      isCorrect: null,
      voiceDurationSeconds: 8,
      sttStatus: "failed",
      recognitionError: "transcribe-failed",
    });
    recordHaruDemoResponse(4, {
      questionId: "D4_Q5",
      responseType: "voice",
      responseTimeMs: 17_200,
      isCorrect: null,
      voiceDurationSeconds: 14.2,
      sttStatus: "completed",
      sttLanguage: "ko-KR",
      derivedAnnotations: [
        { entityType: "장소", value: "갑천 산책로" },
        { entityType: "음료", value: "보리차" },
      ],
    });

    expect(getHaruDemoSessions()[0].responses).toEqual([
      {
        questionId: "D4_Q5",
        responseType: "voice",
        responseTimeMs: 17_200,
        isCorrect: null,
        voiceDurationSeconds: 14.2,
        sttStatus: "completed",
        sttLanguage: "ko-KR",
        derivedAnnotations: [
          { entityType: "장소", value: "갑천 산책로" },
          { entityType: "음료", value: "보리차" },
        ],
      },
    ]);
  });

  it("patches STT success onto an existing voice response without storing raw transcript", () => {
    startHaruDemoSession(4, ["D4_Q5"]);
    recordHaruDemoResponse(4, {
      questionId: "D4_Q5",
      responseType: "voice",
      responseTimeMs: 10_000,
      isCorrect: null,
      voiceDurationSeconds: 8,
      sttStatus: "failed",
      recognitionError: "stt-pending",
    });

    expect(
      patchHaruDemoVoiceResponse(4, "D4_Q5", {
        transcript: "원문은 안전 저장소에 남기지 않습니다",
        derivedAnnotations: [{ entityType: "장소", value: "갑천 산책로" }],
        sttLanguage: "ko-KR",
        sttConfidence: 0.91,
        sttEngine: "qwen3-asr",
        sttModel: "Qwen/Qwen3-ASR-1.7B",
        sttModelRevision: "model-revision",
        sttAlignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
        sttAlignerRevision: "aligner-revision",
        sttPreprocessingVersion: "haru-audio-v1",
      }),
    ).toBe(true);

    expect(getHaruDemoSessions()[0].responses[0]).toEqual({
      questionId: "D4_Q5",
      responseType: "voice",
      responseTimeMs: 10_000,
      isCorrect: null,
      voiceDurationSeconds: 8,
      sttStatus: "completed",
      sttLanguage: "ko-KR",
      sttConfidence: 0.91,
      sttEngine: "qwen3-asr",
      sttModel: "Qwen/Qwen3-ASR-1.7B",
      sttModelRevision: "model-revision",
      sttAlignerModel: "Qwen/Qwen3-ForcedAligner-0.6B",
      sttAlignerRevision: "aligner-revision",
      sttPreprocessingVersion: "haru-audio-v1",
      derivedAnnotations: [{ entityType: "장소", value: "갑천 산책로" }],
    });
    expect(localStorage.getItem(HARU_DEMO_SESSION_STORAGE_KEY)).not.toContain(
      "원문은 안전 저장소에 남기지 않습니다",
    );
  });

  it("never upserts a missing or deleted voice response during STT patch", () => {
    startHaruDemoSession(4, ["D4_Q4", "D4_Q5"]);
    recordHaruDemoResponse(4, {
      questionId: "D4_Q4",
      responseType: "single_choice",
      selectedOptionId: "A",
      responseTimeMs: 2_000,
      isCorrect: true,
    });

    expect(
      patchHaruDemoVoiceResponse(4, "D4_Q5", {
        transcript: "missing target",
        derivedAnnotations: [],
        sttLanguage: "ko-KR",
      }),
    ).toBe(false);
    expect(
      patchHaruDemoVoiceResponse(4, "D4_Q4", {
        transcript: "wrong type",
        derivedAnnotations: [],
        sttLanguage: "ko-KR",
      }),
    ).toBe(false);

    expect(clearHaruDemoSessions()).toBe(true);
    expect(
      patchHaruDemoVoiceResponse(4, "D4_Q5", {
        transcript: "deleted target",
        derivedAnnotations: [],
        sttLanguage: "ko-KR",
      }),
    ).toBe(false);
    expect(getHaruDemoSessions()).toEqual([]);
  });

  it("resumes the same day without deleting recorded answers", () => {
    const startedAt = new Date("2026-07-20T01:00:00.000Z");
    startHaruDemoSession(1, ["D1_Q1", "D1_Q2"], startedAt);
    recordHaruDemoResponse(1, {
      questionId: "D1_Q1",
      responseType: "single_choice",
      selectedOptionId: "B",
      responseTimeMs: 6_000,
      isCorrect: null,
      personalization: { kind: "none" },
    });

    const resumed = startHaruDemoSession(
      1,
      ["D1_Q1", "D1_Q2"],
      new Date("2026-07-20T01:00:30.000Z"),
    );

    expect(resumed.startedAt).toBe(startedAt.toISOString());
    expect(resumed.responses).toEqual([
      expect.objectContaining({ questionId: "D1_Q1", selectedOptionId: "B" }),
    ]);
  });

  it("does not implicitly restart or erase a completed day", () => {
    const startedAt = new Date("2026-07-20T01:00:00.000Z");
    const completed = seedCompletedHaruDemoDay(1, {
      startedAt,
      endedAt: new Date("2026-07-20T01:00:10.000Z"),
    });

    expect(startHaruDemoSession(1, getHaruWeekPlan(1).exerciseIds)).toEqual(
      completed,
    );
    expect(getHaruDemoSessions()).toEqual([completed]);
  });

  it("marks an unfinished session abandoned and stops accepting responses", () => {
    const startedAt = new Date("2026-07-23T01:00:00.000Z");
    const endedAt = new Date("2026-07-23T01:00:09.000Z");
    startHaruDemoSession(4, ["D4_Q1"], startedAt);

    expect(abandonHaruDemoSession(4, endedAt)).toEqual(
      expect.objectContaining({
        status: "abandoned",
        endedAt: endedAt.toISOString(),
        durationSeconds: 9,
        completionMessage: null,
      }),
    );
    expect(
      recordHaruDemoResponse(4, {
        questionId: "D4_Q1",
        responseType: "single_choice",
        selectedOptionId: "B",
        responseTimeMs: 6_000,
        isCorrect: null,
      }),
    ).toBeNull();
  });

  it("returns an empty list for invalid JSON and can start cleanly afterward", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    localStorage.setItem(HARU_DEMO_SESSION_STORAGE_KEY, "{invalid json");

    expect(getHaruDemoSessions()).toEqual([]);
    expect(startHaruDemoSession(2, ["D2_Q1"]).day).toBe(2);
    expect(getHaruDemoSessions()).toHaveLength(1);
    expect(consoleError).toHaveBeenCalled();
  });

  it("serializes only allowlisted response fields", () => {
    startHaruDemoSession(7, ["D7_Q6"]);
    const unsafeResponse = {
      questionId: "D7_Q6",
      responseType: "voice",
      domain: "personal_memory",
      promptText: "오늘 있었던 개인 이야기를 말씀해 주세요.",
      scored: false,
      personalizationSourceNote: "복약시간 기반 개인화 문구",
      feedbackText: "개인화된 피드백",
      responseTimeMs: 20_700,
      isCorrect: null,
      voiceDurationSeconds: 17.7,
      sttStatus: "completed",
      sttLanguage: "ko-KR",
      recognitionError: "none",
      derivedAnnotations: [
        { entityType: "활동", value: "화분에 물 주기" },
        { entityType: "음식", value: "김치전" },
      ],
      personalization: {
        kind: "prior_response",
        sourceQuestionIds: ["D5_Q6"],
      },
      rawTranscript: "원문 음성 비밀",
      rawUserUtteranceTranscript: "다른 원문 비밀",
      audioAssetUrl: "blob:private-audio",
      audioObjectKey: "voice/private/D7_Q6.wav",
      buttonEventTimestamp: "2026-07-26T10:01:21+09:00",
      buttonEvents: [{ pressedAt: "2026-07-26T10:01:22+09:00" }],
    } as HaruDemoResponse & Record<string, unknown>;

    recordHaruDemoResponse(7, unsafeResponse);

    const raw = localStorage.getItem(HARU_DEMO_SESSION_STORAGE_KEY) ?? "";
    expect(raw).not.toContain("rawTranscript");
    expect(raw).not.toContain("rawUserUtteranceTranscript");
    expect(raw).not.toContain("원문 음성 비밀");
    expect(raw).not.toContain("audioAssetUrl");
    expect(raw).not.toContain("audioObjectKey");
    expect(raw).not.toContain("blob:private-audio");
    expect(raw).not.toContain("voice/private");
    expect(raw).not.toContain("buttonEventTimestamp");
    expect(raw).not.toContain("buttonEvents");
    expect(raw).not.toContain("pressedAt");
    expect(raw).not.toContain("promptText");
    expect(raw).not.toContain("personalizationSourceNote");
    expect(raw).not.toContain("복약시간 기반 개인화 문구");
    expect(raw).not.toContain("feedbackText");
    expect(JSON.parse(raw)[0].responses[0]).toEqual({
      questionId: "D7_Q6",
      responseType: "voice",
      responseTimeMs: 20_700,
      isCorrect: null,
      voiceDurationSeconds: 17.7,
      sttStatus: "completed",
      sttLanguage: "ko-KR",
      recognitionError: "none",
      derivedAnnotations: [
        { entityType: "활동", value: "화분에 물 주기" },
        { entityType: "음식", value: "김치전" },
      ],
      personalization: {
        kind: "prior_response",
        sourceQuestionIds: ["D5_Q6"],
      },
    });
  });

  it("returns null when a completed session cannot be persisted", () => {
    startHaruDemoSession(1, getHaruWeekPlan(1).exerciseIds);
    HARU_WEEK_QUESTION_META.filter((question) => question.day === 1).forEach(
      (question) => recordHaruDemoResponse(1, canonicalHaruResponse(question)),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(completeHaruDemoSession(1, "완료")).toBeNull();
    expect(getHaruDemoSessions()[0]).toEqual(
      expect.objectContaining({
        status: "in_progress",
        endedAt: null,
        completionMessage: null,
      }),
    );
    expect(consoleError).toHaveBeenCalled();
  });

  it("tolerates localStorage read and write failures", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(getHaruDemoSessions()).toEqual([]);
    expect(() => startHaruDemoSession(3, ["D3_Q1"])).not.toThrow();
    expect(consoleError).toHaveBeenCalled();
  });
});
