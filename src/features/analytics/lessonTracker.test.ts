import { describe, expect, it, vi } from "vitest";
import { HaruLessonTelemetryTracker } from "@/features/analytics/lessonTracker";
import type { HaruActivitySessionInput } from "@/features/profile/haruDataApi";

describe("Haru lesson telemetry tracker", () => {
  it("records presentation, first interaction, changed choices, confirmation, and active timing", async () => {
    let nowMs = 1_000;
    const capture = vi.fn(async () => true);
    const submitSession = vi.fn(async () => true);
    const submitAttempt = vi.fn(async () => true);
    const tracker = new HaruLessonTelemetryTracker({
      nowMs: () => nowMs,
      createRoutineSessionId: () => "routine_00112233445566778899aabbccddeeff",
      createQuestionInstanceId: () => "question_00112233445566778899aabbccddeeff",
      capture,
      submitSession,
      submitAttempt,
      contentPackVersion: "jp-2026.08",
      consentRevision: () => "consent-1",
      canStoreActivity: () => true,
    });

    await tracker.startRoutine("haru-week-day-1", 1, 6);
    await tracker.presentQuestion({
      questionId: "D1_Q1",
      exerciseType: "single_choice",
      domain: "dailyFlow",
      ordinal: 1,
      difficulty: "1",
      contentHash: "fnv1a-abcd1234",
    });
    nowMs = 1_900;
    await tracker.recordInteraction("touch");
    await tracker.recordChoice("A", true, 1);
    nowMs = 2_300;
    await tracker.recordChoice("B", true, 1);
    nowMs = 3_100;
    await tracker.confirmAnswer({
      inputMode: "touch",
      responseIds: ["B"],
      result: "correct",
    });
    nowMs = 3_600;
    await tracker.showFeedback("success");
    nowMs = 4_000;
    await tracker.completeQuestion();

    const captureCalls = capture.mock.calls as unknown as Array<
      [string, unknown, unknown]
    >;
    expect(captureCalls.map(([name]) => name)).toEqual([
      "routine_started",
      "question_presented",
      "question_first_interaction",
      "choice_changed",
      "choice_changed",
      "answer_confirmed",
      "feedback_shown",
      "question_completed",
    ]);
    expect(capture).toHaveBeenCalledWith(
      "answer_confirmed",
      expect.objectContaining({
        responseIds: ["B"],
        responseTimeMs: 2100,
        activeResponseTimeMs: 2100,
        selectionChangeCount: 2,
      }),
      expect.objectContaining({
        routineSessionId: "routine_00112233445566778899aabbccddeeff",
        questionInstanceId: "question_00112233445566778899aabbccddeeff",
      }),
    );
    expect(submitAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        firstInteractionMs: 900,
        confirmationLatencyMs: 1200,
        response: expect.objectContaining({ selectedOptionIds: ["B"], isCorrect: true }),
      }),
    );
  });

  it("excludes hidden and idle time and records exact dropoff location", async () => {
    let nowMs = 0;
    const capture = vi.fn(async () => true);
    const submitSession = vi.fn(async () => true);
    const tracker = new HaruLessonTelemetryTracker({
      nowMs: () => nowMs,
      createRoutineSessionId: () => "routine_00112233445566778899aabbccddeeff",
      createQuestionInstanceId: () => "question_00112233445566778899aabbccddeeff",
      capture,
      submitSession,
      submitAttempt: vi.fn(async () => true),
      contentPackVersion: "kr-2026.08",
      consentRevision: () => "consent-1",
      canStoreActivity: () => true,
    });
    await tracker.startRoutine("haru-week-day-2", 2, 6);
    await tracker.presentQuestion({
      questionId: "D2_Q3",
      exerciseType: "voice",
      domain: "memory",
      ordinal: 3,
      difficulty: "2",
      contentHash: "fnv1a-abcd5678",
    });
    nowMs = 10_000;
    tracker.setVisible(false);
    nowMs = 70_000;
    tracker.setVisible(true);
    await tracker.exit("pagehide");

    expect(submitSession).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: "exit_observed",
        lastQuestionInstanceId: "question_00112233445566778899aabbccddeeff",
        activeDurationMs: 10_000,
        wallDurationMs: 70_000,
      }),
    );
  });

  it("records coded voice outcomes against the active question instance", async () => {
    const capture = vi.fn(async () => true);
    const tracker = new HaruLessonTelemetryTracker({
      nowMs: () => 1_000,
      createRoutineSessionId: () => "routine_00112233445566778899aabbccddeeff",
      createQuestionInstanceId: () => "question_00112233445566778899aabbccddeeff",
      capture,
      submitSession: vi.fn(async () => true),
      submitAttempt: vi.fn(async () => true),
      contentPackVersion: "kr-2026.08",
      consentRevision: () => "consent-1",
      canStoreActivity: () => true,
    });
    await tracker.startRoutine("haru-week-day-1", 1, 6);
    await tracker.presentQuestion({
      questionId: "D1_Q5",
      exerciseType: "voice",
      domain: "daily_memory",
      ordinal: 5,
      difficulty: "1",
      contentHash: "fnv1a-voice0001",
      voiceExperience: {
        voiceExperienceVariant: "assist_v2",
        waveformMode: "reactive_red",
        guidanceCopyVersion: "voice-guidance-2026-08-v2",
        sttPipelineVersion: "haru-qwen3-asr-v2",
      },
    });

    expect(capture).toHaveBeenLastCalledWith(
      "question_presented",
      expect.objectContaining({
        voiceExperienceVariant: "assist_v2",
        waveformMode: "reactive_red",
        guidanceCopyVersion: "voice-guidance-2026-08-v2",
      }),
      expect.any(Object),
    );

    await tracker.recordVoiceCaptureStatus({
      phase: "completed",
      durationMs: 8_000,
      sttStatus: "no_speech",
      noSpeech: true,
      voiceExperienceVariant: "assist_v2",
      waveformMode: "reactive_red",
      guidanceCopyVersion: "voice-guidance-2026-08-v2",
      sttPipelineVersion: "haru-qwen3-asr-v2",
      outcomeReason: "no_speech",
    });

    expect(capture).toHaveBeenLastCalledWith(
      "voice_capture_status",
      expect.objectContaining({
        voiceExperienceVariant: "assist_v2",
        waveformMode: "reactive_red",
        outcomeReason: "no_speech",
      }),
      {
        routineSessionId: "routine_00112233445566778899aabbccddeeff",
        questionInstanceId: "question_00112233445566778899aabbccddeeff",
      },
    );
  });

  it("never posts activity records without longitudinal consent", async () => {
    const submitSession = vi.fn(async () => true);
    const tracker = new HaruLessonTelemetryTracker({
      nowMs: () => 0,
      createRoutineSessionId: () => "routine_00112233445566778899aabbccddeeff",
      createQuestionInstanceId: () => "question_00112233445566778899aabbccddeeff",
      capture: vi.fn(async () => false),
      submitSession,
      submitAttempt: vi.fn(async () => true),
      contentPackVersion: "kr-2026.08",
      consentRevision: () => "consent-1",
      canStoreActivity: () => false,
    });
    await tracker.startRoutine("haru-week-day-1", 1, 6);
    await tracker.exit("user");
    expect(submitSession).not.toHaveBeenCalled();
  });

  it("records a saved-session return once and persists the resumed state", async () => {
    const capture = vi.fn(async () => true);
    const submitSession = vi.fn(async () => true);
    const tracker = new HaruLessonTelemetryTracker({
      nowMs: () => 5_000,
      createRoutineSessionId: () => "routine_00112233445566778899aabbccddeeff",
      createQuestionInstanceId: () => "question_00112233445566778899aabbccddeeff",
      capture,
      submitSession,
      submitAttempt: vi.fn(async () => true),
      contentPackVersion: "jp-2026.08",
      consentRevision: () => "consent-1",
      canStoreActivity: () => true,
    });

    await tracker.startRoutine("haru-week-day-3", 3, 6);
    await tracker.resumeFromDropoff();
    await tracker.resumeFromDropoff();

    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenLastCalledWith(
      "routine_resumed",
      { resumeKind: "after_dropoff" },
      expect.objectContaining({ routineSessionId: expect.any(String) }),
    );
    const sessionCalls = submitSession.mock.calls as unknown as Array<
      [HaruActivitySessionInput]
    >;
    expect(sessionCalls.map(([input]) => input.state)).toEqual([
      "started",
      "resumed",
    ]);
  });

  it("deduplicates background pause/resume and never emits exit after completion", async () => {
    const capture = vi.fn(async () => true);
    const submitSession = vi.fn(async () => true);
    const tracker = new HaruLessonTelemetryTracker({
      nowMs: () => 5_000,
      createRoutineSessionId: () => "routine_00112233445566778899aabbccddeeff",
      createQuestionInstanceId: () => "question_00112233445566778899aabbccddeeff",
      capture,
      submitSession,
      submitAttempt: vi.fn(async () => true),
      contentPackVersion: "kr-2026.08",
      consentRevision: () => "consent-1",
      canStoreActivity: () => true,
    });

    await tracker.startRoutine("haru-week-day-4", 4, 6);
    await tracker.pause("background");
    await tracker.pause("background");
    await tracker.resume();
    await tracker.resume();
    await tracker.completeRoutine();
    await tracker.completeRoutine();
    await tracker.exit("pagehide");

    const captureCalls = capture.mock.calls as unknown as Array<[string]>;
    expect(captureCalls.map(([name]) => name)).toEqual([
      "routine_started",
      "routine_paused",
      "routine_resumed",
      "routine_completed",
    ]);
    const sessionCalls = submitSession.mock.calls as unknown as Array<
      [HaruActivitySessionInput]
    >;
    expect(sessionCalls.map(([input]) => input.state)).toEqual([
      "started",
      "paused",
      "resumed",
      "completed",
    ]);
  });
});
